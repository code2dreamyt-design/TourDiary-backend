import Device from "../models/Device.js";
import { verifyAccessToken } from "../services/token.service.js";

// POST /api/devices/ping  { deviceId, platform, appVersion }   (Bearer token optional)
// Call on every app open: registers the install the first time, refreshes lastSeenAt after.
export const ping = async (req, res) => {
  try {
    const { deviceId, platform, appVersion } = req.body;
    const set = { platform, lastSeenAt: new Date() };
    if (appVersion) set.appVersion = appVersion;
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      try { set.user = verifyAccessToken(token).sub; } catch { /* anonymous ping is fine */ }
    }
    await Device.updateOne({ deviceId }, { $set: set, $setOnInsert: { deviceId, firstSeenAt: new Date() } }, { upsert: true });
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(204).end(); // never fail the app over analytics
  }
};
