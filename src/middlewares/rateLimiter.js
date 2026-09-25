import rateLimit from "express-rate-limit";

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many login attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const signupLimiter = rateLimit({
    windowMs:  60 * 60 * 1000,
    max:5,
    message:{message:"Too many signup attemptss, Please try again later"},
    standardHeaders:true,
    legacyHeaders:false
});

export const forgotPasswordLimiter = rateLimit({
    windowMs:  60 * 60 * 1000,
    max:5,
    message:{message:"Too many attemptss, Please try again later"},
    standardHeaders:true,
    legacyHeaders:false
});

export const resendLimiter = rateLimit({
    windowMs:  60 * 60 * 1000,
    max:5,
    message:{message:"Too many attemptss, Please try again later"},
    standardHeaders:true,
    legacyHeaders:false
});
export const profilePicLimiter = rateLimit({
    windowMs: 7 * 24 * 60 * 60 * 1000,
    max: 3,
    keyGenerator: (req) => req.userId,
    skipFailedRequests: true,
    message: { message: "You can only update your profile picture 3 times per week. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

export const removeProfilePicLimiter = rateLimit({
    windowMs: 7 * 24 * 60 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.userId,
    skipFailedRequests: true,
    message: { message: "Too many attempts. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});
export const nameUpdateLimiter = rateLimit({
    windowMs: 20 * 24 * 60 * 60 * 1000,
    max: 2,
    keyGenerator: (req) => req.userId,
    skipFailedRequests: true,
    message: { message: "Too many attempts. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});
export const designationLimiter = rateLimit({
    windowMs: 20 * 24 * 60 * 60 * 1000,
    max: 3,
    keyGenerator: (req) => req.userId,
    skipFailedRequests: true,
    message: { message: "Too many attempts. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

export const dobUpdateLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.userId,
    skipFailedRequests: true,
    message: { message: "Too many attempts. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});