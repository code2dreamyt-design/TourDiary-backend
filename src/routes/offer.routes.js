import express from "express";
import rateLimit from "express-rate-limit";
import { getOffer } from "../controllers/offer.controller.js";

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
const r = express.Router();
r.get("/", limiter, getOffer);
export default r;
