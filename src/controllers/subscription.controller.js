import { razorPayApiKey } from "../config/env.js";
import PLAN from "../config/plan.js";
import razorpay from "../config/razorpay.js";
import { signEntitlement } from "../services/entitlement.service.js";
import { getPaidUntil, hasActiveSubscription } from "../services/subscription.service.js";

export const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.userId;
    const [isActive, paidUntil] = await Promise.all([
      hasActiveSubscription(userId),
      getPaidUntil(userId),
    ]);
    const entitlement = signEntitlement(userId, paidUntil);
    return res.status(200).json({ active: isActive,entitlement });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const createCheckoutOrder = async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.userId;
    if (plan !== "monthly" && plan !== "yearly") {
      return res.status(400).json({ message: "Not a valid plan" });
    }
    const order = await razorpay.orders.create({
      amount: PLAN[plan].amount,
      currency: PLAN[plan].currency,
      receipt: `sub_${userId.toString().slice(-8)}_${Date.now()}`,
      notes: { userId: String(userId), plan },
    });
    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorPayApiKey,
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
