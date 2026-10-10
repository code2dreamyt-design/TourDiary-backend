import express from "express";
import rateLimit from "express-rate-limit";
import * as c from "../controllers/admin.controller.js";
import { adminAuth } from "../middlewares/adminAuth.js";
import { validate } from "../middlewares/validate.js";
import { adminLoginSchema, bannerSchema, extendSchema, offerSchema } from "../validations/admin.validation.js";

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, message: { message: "Too many attempts, try again in 15 minutes" } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });

const r = express.Router();
r.post("/login", loginLimiter, validate(adminLoginSchema), c.login);
r.use(apiLimiter, adminAuth); // everything below needs an admin token
r.get("/me", (req, res) => res.json({ admin: req.admin }));
r.get("/dashboard", c.dashboard);
r.get("/users", c.listUsers);
r.get("/users/:id", c.getUser);
r.post("/users/:id/extend", validate(extendSchema), c.extendSubscription);
r.post("/users/:id/unlock", c.unlockUser);
r.post("/users/:id/revoke-sessions", c.revokeSessions);
r.get("/banners", c.listBanners);
r.post("/banners", validate(bannerSchema), c.createBanner);
r.post("/banners/kill-switch", c.killBanners);
r.put("/banners/:id", validate(bannerSchema), c.updateBanner);
r.delete("/banners/:id", c.deleteBanner);
r.get("/offer", c.getOffer);
r.put("/offer", validate(offerSchema), c.setOffer);
r.get("/events", c.listEvents);
export default r;
