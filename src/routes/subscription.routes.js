import express from "express";
import { createCheckoutOrder, getSubscriptionStatus } from "../controllers/subscription.controller.js";
import { claimTrial } from "../controllers/trial.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const subscriptionRouter = express.Router();

subscriptionRouter.get("/status",authMiddleware,getSubscriptionStatus);
subscriptionRouter.post("/checkout",authMiddleware,createCheckoutOrder);
subscriptionRouter.post("/claim-trial",authMiddleware,claimTrial);

export default subscriptionRouter;