import Setting from "../models/Setting.js";
import { TRIAL_OFFER_ENDS_AT as DEFAULT_ENDS_AT, TRIAL_DAYS } from "../config/trial.js";

// The launch-offer end moment is stored in the database so the admin portal can
// change it at any time (Admin -> Offer). If nothing has been saved yet, or the
// database cannot be read, the date in config/trial.js is used instead.
const KEY = "trialOffer";
const CACHE_MS = 15 * 1000; // keeps the claim endpoint from hitting the DB on every request

let cache = null; // { endsAt: Date, at: number }

const valid = (d) => d instanceof Date && !Number.isNaN(d.getTime());

export async function getOfferEndsAt() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.endsAt;
  let endsAt = DEFAULT_ENDS_AT;
  try {
    const doc = await Setting.findOne({ key: KEY }).lean();
    const saved = doc?.value?.endsAt ? new Date(doc.value.endsAt) : null;
    if (valid(saved)) endsAt = saved;
  } catch (e) {
    console.error("offer: could not read setting, using", cache ? "last known value" : "default", e.message);
    if (cache) return cache.endsAt;
  }
  cache = { endsAt, at: Date.now() };
  return endsAt;
}

export async function setOfferEndsAt(endsAt, admin) {
  await Setting.findOneAndUpdate(
    { key: KEY },
    { $set: { value: { endsAt, updatedBy: admin || null, updatedAt: new Date() } } },
    { upsert: true }
  );
  cache = { endsAt, at: Date.now() };
}

export async function getOfferInfo(now = new Date()) {
  const endsAt = await getOfferEndsAt();
  return { endsAt: endsAt.toISOString(), open: now < endsAt, days: TRIAL_DAYS, serverTime: now.toISOString() };
}
