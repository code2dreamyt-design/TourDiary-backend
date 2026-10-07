import Event from "../models/Event.js";

// Fire-and-forget: logging must never break a request.
export const logEvent = (type, { user, meta } = {}) => {
  Event.create({ type, user, meta }).catch((e) => console.error("logEvent failed:", e.message));
};
