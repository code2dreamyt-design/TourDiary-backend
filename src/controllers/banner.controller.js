import mongoose from "mongoose";
import Banner from "../models/Banner.js";
import Subscription from "../models/Subscription.js";
import { verifyAccessToken } from "../services/token.service.js";

const DAY = 864e5;

const cmp = (a, b) => {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d;
  }
  return 0;
};

const audienceMatches = (audience, sub, now) => {
  if (audience === "all") return true;
  if (sub === undefined) return false; // not logged in: only "all" banners
  if (audience === "free") return !sub;
  if (!sub) return false;
  const live = sub.paidUntil > now;
  if (audience === "expired") return !live;
  if (!live) return false;
  if (audience === "trial") return sub.provider === "trial";
  if (audience === "subscribed") return sub.provider === "razorpay";
  if (audience === "expiring") return sub.paidUntil - now <= 7 * DAY;
  return false;
};

const fill = (text, sub, now) =>
  text
    .replaceAll("{daysLeft}", sub ? String(Math.max(0, Math.ceil((sub.paidUntil - now) / DAY))) : "0")
    .replaceAll("{paidUntil}", sub ? sub.paidUntil.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "");

// GET /api/banner?platform=android&version=1.3.0   (Bearer token optional)
export const getBanner = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const now = new Date();
    const platform = ["android", "ios"].includes(req.query.platform) ? req.query.platform : null;
    const version = /^\d+(\.\d+){0,3}$/.test(req.query.version || "") ? req.query.version : null;

    let sub; // undefined = anonymous, null = logged in without subscription
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      try {
        const d = verifyAccessToken(token);
        sub = await Subscription.findOne({ user: d.sub }).lean();
      } catch { /* bad/expired token: treat as anonymous */ }
    }

    const live = await Banner.find({ active: true }).sort({ priority: -1, createdAt: -1 }).lean();
    const b = live.find((x) =>
      (!x.startsAt || x.startsAt <= now) &&
      (!x.endsAt || x.endsAt > now) &&
      (x.platform === "all" || x.platform === platform) &&
      (!x.minVersion || (version && cmp(version, x.minVersion) >= 0)) &&
      (!x.maxVersion || (version && cmp(version, x.maxVersion) <= 0)) &&
      audienceMatches(x.audience, sub, now));
    if (!b) return res.json({ banner: null });

    res.json({
      banner: {
        id: b._id,
        type: b.type,
        title: fill(b.title, sub, now),
        message: fill(b.message, sub, now),
        dismissible: b.dismissible,
        showAgain: b.showAgain,
        buttons: b.buttons,
      },
    });
  } catch (e) {
    console.error(e);
    res.json({ banner: null }); // a banner problem must never block the app
  }
};

// POST /api/banner/:id/event  { event: "shown" | "clicked" | "dismissed" }
export const bannerEvent = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Bad id" });
  await Banner.updateOne({ _id: req.params.id }, { $inc: { [`stats.${req.body.event}`]: 1 } }).catch(() => {});
  res.status(204).end();
};
