import jwt from "jsonwebtoken";
import { adminJwtSecret } from "../config/env.js";

export const adminAuth = (req, res, next) => {
  if (!adminJwtSecret) return res.status(503).json({ message: "Admin portal is not configured" });
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Not authenticated" });
  try {
    const p = jwt.verify(token, adminJwtSecret);
    if (p.role !== "admin") throw new Error("bad role");
    req.admin = p.sub;
    next();
  } catch {
    res.status(401).json({ message: "Session expired, please log in again" });
  }
};
