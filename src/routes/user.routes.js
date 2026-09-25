import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { uploadProfilePicMiddleware } from "../middlewares/upload.middleware.js";
import { completeOrUpdateDesignation, dobUpdate, nameUpdate, removeProfile, updateProfile } from "../controllers/user.controller.js";
import { designationLimiter, dobUpdateLimiter, nameUpdateLimiter, profilePicLimiter, removeProfilePicLimiter } from "../middlewares/rateLimiter.js";
import { validate } from "../middlewares/validate.js";
import { completeDesignationSchema, dobUpdateSchema, nameUpdateSchema } from "../validations/auth.validation.js";

const userRouter = express.Router();

userRouter.patch("/me/profile",authMiddleware,profilePicLimiter,uploadProfilePicMiddleware,updateProfile);
userRouter.delete("/remove/profile",authMiddleware,removeProfilePicLimiter,removeProfile);

userRouter.patch("/update/name",authMiddleware,validate(nameUpdateSchema),nameUpdateLimiter,nameUpdate);

userRouter.post("/designation",authMiddleware,validate(completeDesignationSchema),designationLimiter,completeOrUpdateDesignation);

userRouter.patch("/dob", authMiddleware, validate(dobUpdateSchema), dobUpdateLimiter, dobUpdate);
export default userRouter;