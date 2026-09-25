import express from "express";
import authRoute from "./routes/auth.routes.js";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import hpp from "hpp";
import { sanitizeBody } from "./middlewares/sanitize.js";
import { clientUrl, nodeEnv } from "./config/env.js";
import subscriptionRouter from "./routes/subscription.routes.js";
import webhookRouter from "./routes/webhooks.route.js";
import userRouter from "./routes/user.routes.js";

const app = express();
if (nodeEnv === "production") {
  app.set("trust proxy", 1);
}

const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const subscriptionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(helmet());
app.use(cors({ origin: clientUrl, credentials: true }));
app.use("/webhooks/razorpay",express.raw({type:"application/json"}),webhookRouter)
app.use(express.json());
app.use(sanitizeBody);
app.use(hpp());
app.use("/api/auth", globalRateLimit);
app.use("/api/auth", authRoute);
app.use("/api/subscription",subscriptionRateLimit);
app.use("/api/subscription",subscriptionRouter);
app.use("/api/users",userRouter);

export default app;
