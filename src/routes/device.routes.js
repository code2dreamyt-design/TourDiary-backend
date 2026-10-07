import express from "express";
import rateLimit from "express-rate-limit";
import { ping } from "../controllers/device.controller.js";
import { validate } from "../middlewares/validate.js";
import { pingSchema } from "../validations/admin.validation.js";

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
const r = express.Router();
r.post("/ping", limiter, validate(pingSchema), ping);
export default r;
