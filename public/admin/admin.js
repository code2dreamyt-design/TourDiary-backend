"use strict";
const $ = (s) => document.querySelector(s);
// Tiny DOM builder. Everything is inserted as text nodes, so user-supplied names/emails can never inject HTML.
const h = (t, p, ...k) => {
  const e = document.createElement(t); let val;
  for (const [n, v] of Object.entries(p || {})) {
    if (v == null || v === false) continue;
    if (n.startsWith("on")) e.addEventListener(n.slice(2), v);
    else if (n === "value") val = v;
    else if (n === "checked") e.checked = !!v;
    else e.setAttribute(n, v === true ? "" : v);
  }
  const add = (c) => { if (c == null || c === false) return; Array.isArray(c) ? c.forEach(add) : e.append(c.nodeType ? c : document.createTextNode(String(c))); };
  k.forEach(add);
  if (val !== undefined) e.value = val;
  return e;
};
const dt = (d) => d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "—";
const inr = (n) => n == null ? "n/a" : "₹" + Number(n).toLocaleString("en-IN");
const toast = (m) => { const t = $("#toast"); t.textContent = m; t.className = "on"; setTimeout(() => (t.className = ""), 2600); };

let token = sessionStorage.getItem("at");
async function api(path, o = {}) {
  const r = await fetch("/api/admin" + path, {
    method: o.method || "GET",
    headers: { ...(token && { Authorization: "Bearer " + token }), ...(o.body && { "Content-Type": "application/json" }) },
    body: o.body && JSON.stringify(o.body),
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== "/login") { logout(); throw new Error("Session expired"); }
  if (!r.ok) {
    const f = d.errors ? Object.entries(d.errors).map(([k, v]) => `${k}: ${v}`).join("; ") : "";
    throw new Error((d.message || "Error") + (f ? " — " + f : ""));
  }
  return d;
}
const act = async (fn, ok) => { try { const r = await fn(); if (ok) toast(ok); return r; } catch (e) { toast(e.message); } };

function logout() { token = null; sessionStorage.removeItem("at"); $("#app").hidden = true; $("#login").hidden = false; }
function showApp() { $("#login").hidden = true; $("#app").hidden = false; go("Overview"); }
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault(); $("#loginErr").textContent = "";
  try {
    const d = await api("/login", { method: "POST", body: { email: $("#email").value, password: $("#password").value } });
    token = d.token; sessionStorage.setItem("at", token); $("#password").value = ""; showApp();
  } catch (err) { $("#loginErr").textContent = err.message; }
});
$("#logout").addEventListener("click", logout);

// ---------- shell ----------
const TABS = { Overview: overview, Users: users, Banners: banners, Logs: logs };
function go(name) {
  closeDrawer();
  $("#tabs").replaceChildren(...Object.keys(TABS).map((t) => h("button", { class: t === name ? "on" : "", onclick: () => go(t) }, t)));
  // Fresh container per navigation: a slow response from the previous tab writes into a detached node and can't overwrite this one.
  const v = h("div", {}, h("p", { class: "mute" }, "Loading…")); $("#view").replaceChildren(v);
  TABS[name](v).catch((e) => v.replaceChildren(h("p", { class: "err" }, e.message)));
}
const openDrawer = (...c) => { const d = $("#drawer"); d.replaceChildren(h("button", { class: "btn sm", onclick: closeDrawer }, "✕ Close"), ...c); d.hidden = false; };
const closeDrawer = () => ($("#drawer").hidden = true);

// ---------- overview ----------
const bars = (rows) => { const m = Math.max(1, ...rows.map((r) => r[1])); return rows.map(([l, n]) => h("div", { class: "bar" }, h("span", {}, l), h("i", { style: `width:${Math.round((n / m) * 100)}%` }), h("span", {}, n))); };
const stat = (v, l, s) => h("div", { class: "card stat" }, h("b", {}, v ?? "n/a"), h("span", {}, l), s && h("small", {}, s));
const box = (title, body) => h("div", { class: "card" }, h("h3", {}, title), body || h("p", { class: "mute" }, "unavailable"));

async function overview(v) {
  const load = (fresh) => api("/dashboard" + (fresh ? "?fresh=1" : ""));
  const d = await load();
  const u = d.users || {}, s = d.subs || {}, r = d.revenue || {}, a = d.alerts || {}, f = d.funnel;
  v.replaceChildren(
    h("div", { class: "row" }, h("h2", {}, "Overview"), h("span", { class: "mute" }, "updated " + dt(d.generatedAt)), h("button", { class: "btn sm", onclick: () => go("Overview") }, "Refresh")),
    h("div", { class: "grid" },
      stat(u.installs, "Installs (devices seen)"), stat(u.signups, "Signups", u.signupsToday != null && `${u.signupsToday} today · ${u.signupsYesterday} yesterday`),
      stat(u.dau, "Active today"), stat(u.wau, "Active 7 days"), stat(u.mau, "Active 30 days"), stat(u.inactive30d, "Inactive 30d+", "likely uninstalled"),
      stat(s.paid, "Paid active"), stat(s.trial, "Trial active"), stat(s.expired, "Expired"), stat(s.expiringIn7d, "Expiring in 7 days"),
      stat(inr(r.todayInr), "Revenue today", r.paymentsToday != null && r.paymentsToday + " payments"), stat(inr(r.thisMonthInr), "Revenue this month", r.paymentsThisMonth != null && r.paymentsThisMonth + " payments"),
      stat(a.lockedAccounts, "Locked accounts"), stat(a.adminLoginFailed24h, "Failed admin logins 24h")),
    h("div", { class: "grid two" },
      box("Funnel", f && bars([["Installed", f.installed], ["Signed up", f.signedUp], ["Email verified", f.verified], ["Profile done", f.profileDone], ["Trial claimed", f.trialClaimed], ["Paid", f.paid]])),
      box("Subscriptions", d.subs && bars([["Monthly (paid)", s.monthly], ["Yearly (paid)", s.yearly], ["Never subscribed", s.neverSubscribed]])),
      box("Signups, last 14 days", d.series && h("div", { class: "spark" }, ...d.series.signupsPerDay.map(([day, n]) => { const m = Math.max(1, ...d.series.signupsPerDay.map((x) => x[1])); return h("div", { title: `${day}: ${n}`, style: `height:${Math.max(2, (n / m) * 100)}%` }); }))),
      box("App versions", d.versions && (d.versions.length ? bars(d.versions.map((x) => [x.version, x.count])) : h("p", { class: "mute" }, "No devices yet — the app must call /api/devices/ping."))),
      box("Designation", d.audience && bars(Object.entries(d.audience)))));
}

// ---------- users ----------
const US = { q: "", filter: "all", page: 1 };
const FILTERS = [["all", "All users"], ["subscribed", "Paid"], ["trial", "On trial"], ["expiring", "Expiring in 7d"], ["expired", "Expired"], ["free", "Never subscribed"], ["unverified", "Email not verified"], ["incomplete", "Profile incomplete"], ["inactive", "Inactive 30d+"], ["locked", "Locked"]];
async function users(v) {
  const d = await api(`/users?q=${encodeURIComponent(US.q)}&filter=${US.filter}&page=${US.page}`);
  let t; const reload = () => { US.page = 1; users(v); };
  const search = h("input", { placeholder: "Search name or email…", value: US.q, oninput: (e) => { US.q = e.target.value; clearTimeout(t); t = setTimeout(reload, 350); } });
  const sel = h("select", { value: US.filter, onchange: (e) => { US.filter = e.target.value; reload(); } }, FILTERS.map(([k, l]) => h("option", { value: k }, l)));
  v.replaceChildren(
    h("h2", {}, `Users (${d.total})`), h("div", { class: "bar-row" }, search, sel),
    h("div", { class: "card tw" }, h("table", {}, h("tr", {}, ["Name", "Email", "Role", "Subscription", "Last seen", "Joined"].map((x) => h("th", {}, x))),
      d.users.map((x) => h("tr", { class: "click", onclick: () => userDetail(x.id) },
        h("td", {}, x.name), h("td", {}, x.email, !x.isEmailVerified && h("span", { class: "tag" }, "unverified")), h("td", {}, x.designation || "—"),
        h("td", {}, x.subscription ? [h("span", { class: "tag " + x.subscription.state }, x.subscription.state), " until " + dt(x.subscription.paidUntil)] : h("span", { class: "mute" }, "none")),
        h("td", {}, dt(x.lastSeenAt)), h("td", {}, dt(x.createdAt)))))),
    !d.users.length && h("p", { class: "mute" }, "No users match."),
    pager(d, (p) => { US.page = p; users(v); }));
  search.focus(); search.setSelectionRange(US.q.length, US.q.length);
}
const pager = (d, to) => h("div", { class: "pager" }, h("button", { class: "btn sm", disabled: d.page <= 1, onclick: () => to(d.page - 1) }, "‹ Prev"), `Page ${d.page} of ${d.pages}`, h("button", { class: "btn sm", disabled: d.page >= d.pages, onclick: () => to(d.page + 1) }, "Next ›"));
const kv = (rows) => h("table", {}, rows.map(([k, val]) => h("tr", {}, h("th", {}, k), h("td", {}, val ?? "—"))));

async function userDetail(id) {
  const d = await act(() => api("/users/" + id)); if (!d) return;
  const u = d.user, s = d.subscription, days = h("input", { type: "number", value: 30, min: 1, max: 366, style: "width:80px" });
  const after = (fn, ok) => async () => { if (await act(fn, ok)) userDetail(id); };
  openDrawer(
    h("h2", {}, u.name), h("p", { class: "mute" }, u.email),
    h("div", { class: "row" },
      days, h("button", { class: "btn primary sm", onclick: after(() => api(`/users/${id}/extend`, { method: "POST", body: { days: +days.value } }), "Subscription extended") }, "Add days"),
      u.locked && h("button", { class: "btn sm", onclick: after(() => api(`/users/${id}/unlock`, { method: "POST" }), "Unlocked") }, "Unlock account"),
      h("button", { class: "btn danger sm", onclick: () => confirm("Log this user out of every device?") && after(() => api(`/users/${id}/revoke-sessions`, { method: "POST" }), "Sessions revoked")() }, `Revoke sessions (${d.activeSessions})`)),
    h("h2", {}, "Profile"), kv([["Email verified", u.isEmailVerified ? "yes" : "no"], ["Designation", u.designation], ["Tour start", u.usualTourStart], ["Beat", u.beatName], ["Block", u.forestBlock], ["Range", u.forestRange], ["DOB", u.dob && dt(u.dob).split(",").slice(0, 2).join(",")], ["Joined", dt(u.createdAt)], ["Locked", u.locked ? "yes, until " + dt(u.lockUntil) : "no"]]),
    h("h2", {}, "Subscription"), s ? kv([["State", h("span", { class: "tag " + s.state }, s.state)], ["Plan", s.plan], ["Source", s.provider], ["Paid until", dt(s.paidUntil)]]) : h("p", { class: "mute" }, "None"),
    h("h2", {}, `Payments (${d.payments.length})`), d.payments.length ? kv(d.payments.map((p) => [dt(p.createdAt), `${inr(p.amount / 100)} · ${p.plan} · ${p.providerPaymentId}`])) : h("p", { class: "mute" }, "None"),
    h("h2", {}, "Devices"), d.devices.length ? kv(d.devices.map((x) => [x.platform + " " + (x.appVersion || ""), "seen " + dt(x.lastSeenAt)])) : h("p", { class: "mute" }, "None"),
    h("h2", {}, "Recent events"), d.events.length ? kv(d.events.map((x) => [dt(x.createdAt), x.type])) : h("p", { class: "mute" }, "None"));
}

// ---------- banners ----------
const TEMPLATES = {
  update: { name: "App update", type: "update", title: "New update available", message: "Faster sync and bug fixes.", buttons: [{ label: "Update now", action: "open_url", url: "https://", style: "primary" }, { label: "Later", action: "dismiss", style: "secondary" }] },
  offer: { name: "Offer", type: "offer", title: "Special offer", message: "Claim your offer before it ends.", buttons: [{ label: "Claim offer", action: "open_url", url: "https://", style: "primary" }, { label: "Not now", action: "dismiss", style: "secondary" }] },
  reminder: { name: "Subscription reminder", type: "reminder", title: "Subscription ending soon", message: "Your subscription ends in {daysLeft} days ({paidUntil}).", audience: "expiring", buttons: [{ label: "Renew", action: "deeplink", url: "forestapp://subscription", style: "primary" }, { label: "Later", action: "dismiss", style: "secondary" }] },
};
const BLANK = { name: "", active: false, type: "info", title: "", message: "", dismissible: true, showAgain: "once", priority: 0, audience: "all", platform: "all", buttons: [] };
const payload = (b) => ({ name: b.name, active: b.active, type: b.type, title: b.title, message: b.message, dismissible: b.dismissible, showAgain: b.showAgain, priority: b.priority, startsAt: b.startsAt ? new Date(b.startsAt).toISOString() : null, endsAt: b.endsAt ? new Date(b.endsAt).toISOString() : null, audience: b.audience, platform: b.platform, minVersion: b.minVersion || "", maxVersion: b.maxVersion || "", buttons: (b.buttons || []).map((x) => ({ label: x.label, action: x.action, style: x.style || "primary", ...(x.action !== "dismiss" && { url: x.url }) })) });

async function banners(v) {
  const d = await api("/banners");
  v.replaceChildren(
    h("div", { class: "row" }, h("h2", {}, "Banners"), h("button", { class: "btn primary sm", onclick: () => bannerForm(v, BLANK) }, "+ New banner"),
      ...Object.entries(TEMPLATES).map(([k, t]) => h("button", { class: "btn sm", onclick: () => bannerForm(v, { ...BLANK, ...t }) }, "+ " + t.name)),
      h("button", { class: "btn danger sm", onclick: async () => { if (confirm("Turn OFF every banner right now?")) { const r = await act(() => api("/banners/kill-switch", { method: "POST" })); if (r) { toast(`${r.turnedOff} banner(s) turned off`); banners(v); } } } }, "⛔ Turn all off")),
    d.banners.length ? h("div", { class: "card tw" }, h("table", {}, h("tr", {}, ["Name", "Status", "Audience", "Window", "Shown / Clicked / Dismissed", ""].map((x) => h("th", {}, x))),
      d.banners.map((b) => h("tr", {}, h("td", {}, b.name, h("div", { class: "mute" }, b.title)), h("td", {}, h("span", { class: "tag " + b.status }, b.status)), h("td", {}, `${b.audience} · ${b.platform}`),
        h("td", {}, b.startsAt || b.endsAt ? `${dt(b.startsAt)} → ${dt(b.endsAt)}` : "always"), h("td", {}, `${b.stats?.shown || 0} / ${b.stats?.clicked || 0} / ${b.stats?.dismissed || 0}`),
        h("td", { class: "row" },
          h("button", { class: "btn sm", onclick: async () => { if (await act(() => api("/banners/" + b._id, { method: "PUT", body: { ...payload(b), active: !b.active } }), b.active ? "Turned off" : "Turned on")) banners(v); } }, b.active ? "Turn off" : "Turn on"),
          h("button", { class: "btn sm", onclick: () => bannerForm(v, b) }, "Edit"),
          h("button", { class: "btn danger sm", onclick: async () => { if (confirm("Delete this banner?") && (await act(() => api("/banners/" + b._id, { method: "DELETE" }), "Deleted"))) banners(v); } }, "Delete")))))) : h("p", { class: "mute" }, "No banners yet. The app gets { banner: null } and shows nothing."));
}

const localInput = (iso) => { if (!iso) return ""; const d = new Date(iso); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
function bannerForm(v, b) {
  const L = (label, el, cls) => h("div", { class: cls || "" }, h("label", {}, label), el);
  const opts = (arr) => arr.map((x) => h("option", { value: x }, x));
  const I = {
    name: h("input", { value: b.name, maxlength: 80 }), title: h("input", { value: b.title, maxlength: 80 }),
    message: h("textarea", { maxlength: 300 }, b.message),
    type: h("select", { value: b.type }, opts(["info", "update", "offer", "reminder"])), audience: h("select", { value: b.audience }, opts(["all", "free", "trial", "subscribed", "expiring", "expired"])),
    platform: h("select", { value: b.platform }, opts(["all", "android", "ios"])), showAgain: h("select", { value: b.showAgain }, opts(["once", "every_launch"])),
    priority: h("input", { type: "number", value: b.priority, min: -100, max: 100 }), startsAt: h("input", { type: "datetime-local", value: localInput(b.startsAt) }), endsAt: h("input", { type: "datetime-local", value: localInput(b.endsAt) }),
    minVersion: h("input", { value: b.minVersion || "", placeholder: "e.g. 1.0.0" }), maxVersion: h("input", { value: b.maxVersion || "", placeholder: "e.g. 1.3.9" }),
    active: h("input", { type: "checkbox", checked: b.active }), dismissible: h("input", { type: "checkbox", checked: b.dismissible }),
  };
  const BR = [0, 1, 2].map((i) => { const x = (b.buttons || [])[i] || {}; return {
    label: h("input", { value: x.label || "", placeholder: `Button ${i + 1} label`, maxlength: 30 }), action: h("select", { value: x.action || "open_url" }, opts(["open_url", "deeplink", "dismiss"])),
    url: h("input", { value: x.url || "", placeholder: "https://… or myapp://screen" }), style: h("select", { value: x.style || (i ? "secondary" : "primary") }, opts(["primary", "secondary"])) }; });
  const prev = h("div", { class: "prev" });
  const read = () => ({ ...b, ...Object.fromEntries(["name", "title", "message", "type", "audience", "platform", "showAgain", "startsAt", "endsAt", "minVersion", "maxVersion"].map((k) => [k, I[k].value || (k.endsWith("At") ? null : "")])),
    priority: parseInt(I.priority.value) || 0, active: I.active.checked, dismissible: I.dismissible.checked,
    buttons: BR.filter((r) => r.label.value.trim()).map((r) => ({ label: r.label.value.trim(), action: r.action.value, url: r.url.value.trim(), style: r.style.value })) });
  const draw = () => { const x = read(); prev.replaceChildren(x.dismissible && h("span", { class: "x" }, "✕"), h("b", {}, x.title || "Title"), h("div", {}, x.message || "Message"), h("div", { class: "pb" }, x.buttons.map((q) => h("span", { class: q.style }, q.label)))); };
  const wrapEl = h("div", {}, h("h2", {}, b._id ? "Edit banner" : "New banner"),
    h("div", { class: "f" }, L("Internal name", I.name), L("Type (icon/colour only)", I.type), L("Title", I.title, "full"), L("Message — you can use {daysLeft} and {paidUntil}", I.message, "full"),
      L("Who sees it", I.audience), L("Platform", I.platform), L("Show again", I.showAgain), L("Priority (higher wins)", I.priority),
      L("Starts (IST)", I.startsAt), L("Ends (IST)", I.endsAt), L("Min app version", I.minVersion), L("Max app version", I.maxVersion),
      h("label", { class: "chk" }, I.dismissible, "Show ✕ close button"), h("label", { class: "chk" }, I.active, "Active (live)")),
    h("h2", {}, "Buttons (max 3)"), BR.map((r) => h("div", { class: "btnrow" }, r.label, r.action, r.url, r.style)),
    h("h2", {}, "Preview"), prev,
    h("div", { class: "row", style: "margin-top:16px" }, h("button", { class: "btn primary", onclick: async () => {
      const x = payload(read());
      if (await act(() => api(b._id ? "/banners/" + b._id : "/banners", { method: b._id ? "PUT" : "POST", body: x }), "Saved")) { closeDrawer(); banners(v); }
    } }, "Save"), h("button", { class: "btn", onclick: closeDrawer }, "Cancel")));
  wrapEl.addEventListener("input", draw); wrapEl.addEventListener("change", draw);
  openDrawer(wrapEl); draw();
}

// ---------- logs ----------
const LS = { type: "", page: 1 };
async function logs(v) {
  const d = await api(`/events?type=${encodeURIComponent(LS.type)}&page=${LS.page}`);
  const sel = h("select", { value: LS.type, onchange: (e) => { LS.type = e.target.value; LS.page = 1; logs(v); } }, h("option", { value: "" }, "All events"), d.types.map((t) => h("option", { value: t }, t)));
  v.replaceChildren(h("h2", {}, `Logs (${d.total})`), h("p", { class: "mute" }, "Admin actions and security events. Entries are deleted automatically after 90 days."), h("div", { class: "bar-row" }, sel),
    h("div", { class: "card tw" }, h("table", {}, h("tr", {}, ["When", "Event", "User", "Details"].map((x) => h("th", {}, x))),
      d.events.map((e) => h("tr", {}, h("td", {}, dt(e.createdAt)), h("td", {}, e.type), h("td", {}, e.user?.email || "—"), h("td", { class: "mute" }, e.meta ? JSON.stringify(e.meta) : ""))))),
    pager(d, (p) => { LS.page = p; logs(v); }));
}

// ---------- boot ----------
if (token) api("/me").then(showApp).catch(() => ($("#login").hidden = false)); else $("#login").hidden = false;
