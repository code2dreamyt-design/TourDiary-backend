import express from "express";
import { resetPasswordBridge, verifyEmailBridge } from "../controllers/deeplink.controller.js";

const deeplinkRouter = express.Router();

// Plain GET, unauthenticated, no DB access — see deeplink.controller.js.
deeplinkRouter.get("/verify-email/:token", verifyEmailBridge);
deeplinkRouter.get("/reset-password/:rawPassResetToken", resetPasswordBridge);

export default deeplinkRouter;
