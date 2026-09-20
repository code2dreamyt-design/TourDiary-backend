import express from "express";
import {
  signup,
  login,
  refresh,
  logout,
  getMe,
  resendEmail,
  forgetPassword,
  resetPassword,
  changePassword,
  verifyEmail,
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import {
  forgotPasswordLimiter,
  loginLimiter,
  resendLimiter,
  signupLimiter,
} from "../middlewares/rateLimiter.js";
import { validate } from "../middlewares/validate.js";
import {
  changePasswordSchema,
  forgetPasswordSchema,
  loginSchema,
  refrshSchema,
  resetPasswordSchema,
  signUpSchema,
} from "../validations/auth.validation.js";

const authRoute = express.Router();

authRoute.post("/signup", signupLimiter, validate(signUpSchema), signup);
authRoute.post("/login", loginLimiter, validate(loginSchema), login);
authRoute.post("/refresh",validate(refrshSchema), refresh);
authRoute.post("/logout",validate(refrshSchema), logout);
authRoute.get("/getme", authMiddleware, getMe);
authRoute.post("/resend", resendLimiter, authMiddleware, resendEmail);
authRoute.post("/verify-email/:token", verifyEmail);
authRoute.post(
  "/forget-password",
  validate(forgetPasswordSchema),
  forgotPasswordLimiter,
  forgetPassword,
);
authRoute.post(
  "/reset-password/:rawPassResetToken",
  validate(resetPasswordSchema),
  resetPassword,
);
authRoute.post(
  "/change-password",
  validate(changePasswordSchema),
  authMiddleware,
  changePassword,
);

export default authRoute;
