import mongoose from "mongoose";

const buttonSchema = new mongoose.Schema({
  label: { type: String, required: true, maxlength: 30 },
  action: { type: String, enum: ["open_url", "deeplink", "dismiss"], required: true },
  url: { type: String, maxlength: 500 },
  style: { type: String, enum: ["primary", "secondary"], default: "primary" },
}, { _id: false });

const bannerSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 80 }, // admin-only label
  active: { type: Boolean, default: false },
  type: { type: String, enum: ["update", "offer", "reminder", "info"], default: "info" },
  title: { type: String, required: true, maxlength: 80 },
  message: { type: String, required: true, maxlength: 300 }, // may contain {daysLeft} / {paidUntil}
  dismissible: { type: Boolean, default: true },
  showAgain: { type: String, enum: ["once", "every_launch"], default: "once" },
  priority: { type: Number, default: 0 },
  startsAt: { type: Date },
  endsAt: { type: Date },
  audience: { type: String, enum: ["all", "free", "trial", "subscribed", "expiring", "expired"], default: "all" },
  platform: { type: String, enum: ["all", "android", "ios"], default: "all" },
  minVersion: { type: String, maxlength: 20 },
  maxVersion: { type: String, maxlength: 20 },
  buttons: { type: [buttonSchema], validate: (v) => v.length <= 3 },
  stats: {
    shown: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    dismissed: { type: Number, default: 0 },
  },
}, { timestamps: true });

export default mongoose.model("Banner", bannerSchema);
