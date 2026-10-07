import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { adminEmail, adminPasswordHash, adminJwtSecret } from "../config/env.js";
import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import Payment from "../models/Payment.js";
import Device from "../models/Device.js";
import Banner from "../models/Banner.js";
import Event from "../models/Event.js";
import RefreshToken from "../models/RefreshToken.js";
import { logEvent } from "../utils/logEvent.js";

const DAY = 864e5;
const bad = (res, m = "Bad id") => res.status(400).json({ message: m });
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) { console.error(e); res.status(500).json({ message: "Internal Server Error" }); }
};

// ---------- auth ----------
export const login = async (req, res) => {
  if (!adminJwtSecret || !adminEmail || !adminPasswordHash) return res.status(503).json({ message: "Admin portal is not configured" });
  const { email, password } = req.body;
  const okPw = await bcrypt.compare(password, adminPasswordHash); // always run: same timing for wrong email
  if (email.toLowerCase() !== adminEmail || !okPw) {
    logEvent("admin_login_failed", { meta: { ip: req.ip } });
    return res.status(401).json({ message: "Wrong email or password" });
  }
  logEvent("admin_login", { meta: { ip: req.ip } });
  res.json({ token: jwt.sign({ sub: adminEmail, role: "admin" }, adminJwtSecret, { expiresIn: "8h" }) });
};

// ---------- dashboard (one call, counts only, cached 45s) ----------
let cache = { at: 0, data: null };
const safe = async (fn) => { try { return await fn(); } catch (e) { console.error("dashboard section failed:", e.message); return null; } };

const buildDashboard = async () => {
  const now = new Date();
  const ago = (d) => new Date(now - d * DAY);
  const istDay = new Date(new Date(now.getTime() + 5.5 * 36e5).setUTCHours(0, 0, 0, 0) - 5.5 * 36e5); // 00:00 IST today
  const monthStart = new Date(new Date(istDay.getTime() + 5.5 * 36e5).setUTCDate(1) - 5.5 * 36e5);
  const live = { paidUntil: { $gt: now } };

  const [users, funnel, subs, revenue, versions, audience, series, alerts] = await Promise.all([
    safe(async () => {
      const [installs, signups, dau, wau, mau, inactive30d] = await Promise.all([
        Device.countDocuments(), User.countDocuments(),
        Device.countDocuments({ lastSeenAt: { $gte: ago(1) } }), Device.countDocuments({ lastSeenAt: { $gte: ago(7) } }),
        Device.countDocuments({ lastSeenAt: { $gte: ago(30) } }), Device.countDocuments({ lastSeenAt: { $lt: ago(30) } }),
      ]);
      const [today, yesterday] = await Promise.all([
        User.countDocuments({ createdAt: { $gte: istDay } }),
        User.countDocuments({ createdAt: { $gte: new Date(istDay - DAY), $lt: istDay } }),
      ]);
      return { installs, signups, dau, wau, mau, inactive30d, signupsToday: today, signupsYesterday: yesterday };
    }),
    safe(async () => {
      const [installed, signedUp, verified, profileDone, trialClaimed, paid] = await Promise.all([
        Device.countDocuments(), User.countDocuments(), User.countDocuments({ isEmailVerified: true }),
        User.countDocuments({ profileCompleted: true }), Subscription.countDocuments({ provider: "trial" }),
        Payment.distinct("user").then((a) => a.length),
      ]);
      return { installed, signedUp, verified, profileDone, trialClaimed, paid };
    }),
    safe(async () => {
      const [paid, trial, expired, expiringIn7d, monthly, yearly, total, totalUsers] = await Promise.all([
        Subscription.countDocuments({ provider: "razorpay", ...live }), Subscription.countDocuments({ provider: "trial", ...live }),
        Subscription.countDocuments({ paidUntil: { $lte: now } }),
        Subscription.countDocuments({ paidUntil: { $gt: now, $lt: new Date(+now + 7 * DAY) } }),
        Subscription.countDocuments({ plan: "monthly", provider: "razorpay", ...live }), Subscription.countDocuments({ plan: "yearly", provider: "razorpay", ...live }),
        Subscription.countDocuments(), User.countDocuments(),
      ]);
      return { paid, trial, expired, expiringIn7d, monthly, yearly, neverSubscribed: Math.max(0, totalUsers - total) };
    }),
    safe(async () => {
      const sum = async (from) => {
        const [agg, n] = await Promise.all([Payment.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: null, t: { $sum: "$amount" } } }]), Payment.countDocuments({ createdAt: { $gte: from } })]);
        return { t: agg[0]?.t || 0, n };
      };
      const [t, m] = await Promise.all([sum(istDay), sum(monthStart)]);
      return { todayInr: t.t / 100, thisMonthInr: m.t / 100, paymentsToday: t.n, paymentsThisMonth: m.n }; // amounts are stored in paise
    }),
    safe(async () => (await Device.aggregate([{ $group: { _id: "$appVersion", count: { $sum: 1 } } }])).map((v) => ({ version: v._id || "unknown", count: v.count })).sort((a, b) => b.count - a.count)),
    safe(async () => {
      const rows = await User.aggregate([{ $group: { _id: "$designation", count: { $sum: 1 } } }]);
      return Object.fromEntries(rows.map((r) => [r._id || "Not set", r.count]));
    }),
    safe(async () => {
      const from = new Date(istDay - 13 * DAY);
      const us = await User.find({ createdAt: { $gte: from } }).select("createdAt").lean();
      const out = Array.from({ length: 14 }, (_, i) => [new Date(+from + i * DAY + 5.5 * 36e5).toISOString().slice(5, 10), 0]);
      for (const u of us) { const i = Math.floor((u.createdAt - from) / DAY); if (out[i]) out[i][1]++; }
      return { signupsPerDay: out };
    }),
    safe(async () => ({
      lockedAccounts: await User.countDocuments({ lockUntil: { $gt: now } }),
      adminLoginFailed24h: await Event.countDocuments({ type: "admin_login_failed", createdAt: { $gte: ago(1) } }),
    })),
  ]);
  return { generatedAt: now, users, funnel, subs, revenue, versions, audience, series, alerts };
};

export const dashboard = wrap(async (req, res) => {
  if (!cache.data || Date.now() - cache.at > 45000 || req.query.fresh === "1") cache = { at: Date.now(), data: await buildDashboard() };
  res.json(cache.data);
});

// ---------- users ----------
const subState = (s, now = new Date()) => !s ? "free" : s.paidUntil <= now ? "expired" : s.provider === "trial" ? "trial" : "subscribed";

export const listUsers = wrap(async (req, res) => {
  const now = new Date();
  const page = Math.max(1, parseInt(req.query.page) || 1), limit = Math.min(100, parseInt(req.query.limit) || 25);
  const q = String(req.query.q || "").trim().slice(0, 80), f = String(req.query.filter || "all");
  const and = [];
  if (q) { const rx = new RegExp(esc(q), "i"); and.push({ $or: [{ email: rx }, { name: rx }] }); }
  const subWhere = {
    subscribed: { provider: "razorpay", paidUntil: { $gt: now } }, trial: { provider: "trial", paidUntil: { $gt: now } },
    expired: { paidUntil: { $lte: now } }, expiring: { paidUntil: { $gt: now, $lt: new Date(+now + 7 * DAY) } },
  }[f];
  if (subWhere) and.push({ _id: { $in: await Subscription.distinct("user", subWhere) } });
  else if (f === "free") and.push({ _id: { $nin: await Subscription.distinct("user") } });
  else if (f === "unverified") and.push({ isEmailVerified: false });
  else if (f === "incomplete") and.push({ profileCompleted: { $ne: true } });
  else if (f === "locked") and.push({ lockUntil: { $gt: now } });
  else if (f === "inactive") and.push({ _id: { $in: await Device.distinct("user", { user: { $ne: null }, lastSeenAt: { $lt: new Date(now - 30 * DAY) } }) } });
  const where = and.length ? { $and: and } : {};

  const [total, users] = await Promise.all([User.countDocuments(where), User.find(where).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean()]);
  const ids = users.map((u) => u._id);
  const [subs, devs] = await Promise.all([Subscription.find({ user: { $in: ids } }).lean(), Device.find({ user: { $in: ids } }).select("user lastSeenAt").lean()]);
  const sMap = new Map(subs.map((s) => [String(s.user), s])), seen = new Map();
  for (const d of devs) { const k = String(d.user); if (!seen.get(k) || d.lastSeenAt > seen.get(k)) seen.set(k, d.lastSeenAt); }
  res.json({
    total, page, pages: Math.max(1, Math.ceil(total / limit)),
    users: users.map((u) => { const s = sMap.get(String(u._id)); return {
      id: u._id, name: u.name, email: u.email, isEmailVerified: u.isEmailVerified, designation: u.designation, forestRange: u.forestRange,
      createdAt: u.createdAt, lastSeenAt: seen.get(String(u._id)) || null,
      subscription: s ? { state: subState(s, now), plan: s.plan, provider: s.provider, paidUntil: s.paidUntil } : null,
    }; }),
  });
});

export const getUser = wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return bad(res);
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ message: "User not found" });
  const [subscription, payments, devices, events, sessions] = await Promise.all([
    Subscription.findOne({ user: u._id }).lean(), Payment.find({ user: u._id }).sort({ createdAt: -1 }).limit(20).lean(),
    Device.find({ user: u._id }).sort({ lastSeenAt: -1 }).lean(), Event.find({ user: u._id }).sort({ createdAt: -1 }).limit(20).lean(),
    RefreshToken.countDocuments({ user: u._id, revoked: false, expiresAt: { $gt: new Date() } }),
  ]);
  const user = u.toJSON();
  user.locked = !!(u.lockUntil && u.lockUntil > new Date());
  res.json({ user, subscription: subscription && { ...subscription, state: subState(subscription) }, payments, devices, events, activeSessions: sessions });
});

export const extendSubscription = wrap(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return bad(res);
  if (!(await User.exists({ _id: id }))) return res.status(404).json({ message: "User not found" });
  const now = new Date(), sub = await Subscription.findOne({ user: id });
  const base = sub && sub.paidUntil > now ? sub.paidUntil : now;
  const paidUntil = new Date(+base + req.body.days * DAY);
  if (sub) { sub.paidUntil = paidUntil; await sub.save(); }
  else await Subscription.create({ user: id, plan: "monthly", provider: "trial", paidUntil }); // admin grants are stored as provider "trial"
  logEvent("admin_extend_subscription", { user: id, meta: { by: req.admin, days: req.body.days, paidUntil } });
  res.json({ paidUntil });
});

export const unlockUser = wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return bad(res);
  await User.updateOne({ _id: req.params.id }, { $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });
  logEvent("admin_unlock_user", { user: req.params.id, meta: { by: req.admin } });
  res.json({ ok: true });
});

export const revokeSessions = wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return bad(res);
  const r = await RefreshToken.updateMany({ user: req.params.id, revoked: false }, { $set: { revoked: true, revokedAt: new Date() } });
  logEvent("admin_revoke_sessions", { user: req.params.id, meta: { by: req.admin } });
  res.json({ revoked: r.modifiedCount });
});

// ---------- banners ----------
const toDoc = (b) => ({ ...b, startsAt: b.startsAt ? new Date(b.startsAt) : null, endsAt: b.endsAt ? new Date(b.endsAt) : null, minVersion: b.minVersion || undefined, maxVersion: b.maxVersion || undefined,
  buttons: b.buttons.map((x) => ({ ...x, url: x.action === "dismiss" ? undefined : x.url })) });
const status = (b, now = new Date()) => !b.active ? "off" : b.startsAt && b.startsAt > now ? "scheduled" : b.endsAt && b.endsAt <= now ? "ended" : "live";

export const listBanners = wrap(async (req, res) => {
  const now = new Date();
  res.json({ banners: (await Banner.find().sort({ createdAt: -1 }).lean()).map((b) => ({ ...b, status: status(b, now) })) });
});
export const createBanner = wrap(async (req, res) => {
  const b = await Banner.create(toDoc(req.body));
  logEvent("admin_banner_create", { meta: { by: req.admin, id: b._id, active: b.active } });
  res.status(201).json({ banner: b });
});
export const updateBanner = wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return bad(res);
  const b = await Banner.findByIdAndUpdate(req.params.id, { $set: toDoc(req.body), $unset: { ...(req.body.minVersion ? {} : { minVersion: 1 }), ...(req.body.maxVersion ? {} : { maxVersion: 1 }) } }, { new: true, runValidators: true });
  if (!b) return res.status(404).json({ message: "Banner not found" });
  logEvent("admin_banner_update", { meta: { by: req.admin, id: b._id, active: b.active } });
  res.json({ banner: b });
});
export const deleteBanner = wrap(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return bad(res);
  await Banner.deleteOne({ _id: req.params.id });
  logEvent("admin_banner_delete", { meta: { by: req.admin, id: req.params.id } });
  res.json({ ok: true });
});
export const killBanners = wrap(async (req, res) => {
  const r = await Banner.updateMany({ active: true }, { $set: { active: false } });
  logEvent("admin_banner_killswitch", { meta: { by: req.admin, turnedOff: r.modifiedCount } });
  res.json({ turnedOff: r.modifiedCount });
});

// ---------- logs ----------
export const listEvents = wrap(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1), limit = 50;
  const where = req.query.type ? { type: String(req.query.type).slice(0, 50) } : {};
  const [total, events, types] = await Promise.all([Event.countDocuments(where), Event.find(where).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("user", "email name").lean(), Event.distinct("type")]);
  res.json({ total, page, pages: Math.max(1, Math.ceil(total / limit)), types: types.sort(), events });
});
