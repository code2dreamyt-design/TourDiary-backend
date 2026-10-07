import { z } from "zod";

const iso = z.iso.datetime({ offset: true });
const version = z.string().regex(/^\d+(\.\d+){0,3}$/, "Use a version like 1.4.0");

const button = z.object({
  label: z.string().trim().min(1).max(30),
  action: z.enum(["open_url", "deeplink", "dismiss"]),
  url: z.string().trim().max(500).optional().or(z.literal("")),
  style: z.enum(["primary", "secondary"]).default("primary"),
}).superRefine((b, ctx) => {
  if (b.action === "dismiss") return;
  const u = b.url || "";
  const ok = b.action === "open_url"
    ? /^https:\/\/[^\s]+$/i.test(u)
    : /^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(u) && !/^(javascript|data|file):/i.test(u);
  if (!ok) ctx.addIssue({ code: "custom", path: ["url"], message: b.action === "open_url" ? "Link must start with https://" : "Deeplink must look like myapp://screen" });
});

export const bannerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  active: z.boolean(),
  type: z.enum(["update", "offer", "reminder", "info"]),
  title: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(300),
  dismissible: z.boolean(),
  showAgain: z.enum(["once", "every_launch"]),
  priority: z.number().int().min(-100).max(100),
  startsAt: iso.nullable().optional(),
  endsAt: iso.nullable().optional(),
  audience: z.enum(["all", "free", "trial", "subscribed", "expiring", "expired"]),
  platform: z.enum(["all", "android", "ios"]),
  minVersion: version.optional().or(z.literal("")),
  maxVersion: version.optional().or(z.literal("")),
  buttons: z.array(button).max(3),
});

export const adminLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
});

export const extendSchema = z.object({ days: z.number().int().min(1).max(366) });
export const pingSchema = z.object({
  deviceId: z.string().trim().min(8).max(100),
  platform: z.enum(["android", "ios"]),
  appVersion: version.optional(),
});
export const bannerEventSchema = z.object({ event: z.enum(["shown", "clicked", "dismissed"]) });
