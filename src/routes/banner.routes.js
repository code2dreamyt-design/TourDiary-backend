import express from "express";
import rateLimit from "express-rate-limit";
import { getBanner, bannerEvent } from "../controllers/banner.controller.js";
import { validate } from "../middlewares/validate.js";
import { bannerEventSchema } from "../validations/admin.validation.js";

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
const r = express.Router();
r.use(limiter);
r.get("/", getBanner);
r.post("/:id/event", validate(bannerEventSchema), bannerEvent);
export default r;
