import express from "express";
import { createCheckoutOrder, getSubscriptionStatus } from "../controllers/subscription.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const subscriptionRouter = express.Router();

subscriptionRouter.get("/status",authMiddleware,getSubscriptionStatus);
subscriptionRouter.post("/checkout",authMiddleware,createCheckoutOrder);

export default subscriptionRouter;