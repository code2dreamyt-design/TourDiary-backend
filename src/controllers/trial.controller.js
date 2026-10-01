import User from "../models/User.js";
import Subscription from "../models/Subscription.js";
import { TRIAL_DAYS, TRIAL_OFFER_ENDS_AT, isTrialOfferOpen } from "../config/trial.js";
import { signEntitlement } from "../services/entitlement.service.js";

const JUST_SIGNED_UP_WINDOW_MS = 24 * 60 * 60 * 1000; // matches the 24h verification link validity

const formatDate = (date) =>
  date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

// POST /api/subscription/claim-trial   (auth required)
export const claimTrial = async (req, res) => {
  try {
    const userId = req.userId;
    const now = new Date();

    if (!isTrialOfferOpen(now)) {
      return res.status(403).json({
        code: "OFFER_CLOSED",
        message: "Sorry, this free-trial offer has ended. You can subscribe any time to enjoy Forest App.",
      });
    }

    const user = await User.findById(userId).select("isEmailVerified createdAt");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Only accounts created before the offer ended are eligible
    if (user.createdAt >= TRIAL_OFFER_ENDS_AT) {
      return res.status(403).json({
        code: "OFFER_CLOSED",
        message: "Sorry, this free-trial offer was only for users who joined before it ended.",
      });
    }

    if (!user.isEmailVerified) {
      const justSignedUp = now - user.createdAt < JUST_SIGNED_UP_WINDOW_MS;
      return res.status(403).json({
        code: "EMAIL_NOT_VERIFIED",
        justSignedUp,
        message: justSignedUp
          ? "Almost there! We've already sent a verification link to your email. Please verify your email and then come back to claim your 30 days free."
          : "Please verify your email to claim your 30 days free. Go to your Profile section to verify your email, then claim the offer.",
      });
    }

    // One trial per account. Any existing subscription row (trial or paid) means no trial.
    const result = await Subscription.updateOne(
      { user: userId },
      {
        $setOnInsert: {
          user: userId,
          plan: "monthly",
          paidUntil: new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
          provider: "trial",
        },
      },
      { upsert: true, runValidators: true },
    );

    if (result.upsertedCount !== 1) {
      return res.status(409).json({
        code: "ALREADY_CLAIMED",
        message: "You have already used your free trial or have an active subscription.",
      });
    }

    const subscription = await Subscription.findOne({ user: userId });
    const paidUntil = subscription.paidUntil;
    return res.status(200).json({
      granted: true,
      days: TRIAL_DAYS,
      paidUntil,
      entitlement: signEntitlement(userId, paidUntil),
      title: "🎉 Your 30 days free have started!",
      message:
        `Thank you for joining Forest App during our launch offer! ` +
        `You now have ${TRIAL_DAYS} days of full access, completely free. ` +
        `Your free access runs until ${formatDate(paidUntil)}. ` +
        `If you love it, subscribe any time - your remaining free days are never lost.`,
    });
  } catch (error) {
    if (error.code === 11000) {
      // two quick taps raced each other; the other one already created the trial
      return res.status(409).json({
        code: "ALREADY_CLAIMED",
        message: "You have already used your free trial or have an active subscription.",
      });
    }
    console.log(error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
