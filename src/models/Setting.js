import mongoose from "mongoose";

// Small key/value store for settings the admin portal can change at runtime
// (currently only "trialOffer"). One document per key.
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const Setting = mongoose.model("Setting", settingSchema);
export default Setting;
