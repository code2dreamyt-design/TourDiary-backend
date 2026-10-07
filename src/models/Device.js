import mongoose from "mongoose";

// One document per app install (identified by an app-generated random id, not a hardware id).
const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true, maxlength: 100 },
  platform: { type: String, enum: ["android", "ios"], required: true },
  appVersion: { type: String, maxlength: 20 },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now, index: true },
});

export default mongoose.model("Device", deviceSchema);
