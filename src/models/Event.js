import mongoose from "mongoose";

// Admin audit trail + operational events. Auto-deleted after 90 days.
const eventSchema = new mongoose.Schema({
  type: { type: String, required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  meta: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, index: { expires: "90d" } },
});

export default mongoose.model("Event", eventSchema);
