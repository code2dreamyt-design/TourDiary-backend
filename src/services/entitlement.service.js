import jwt from "jsonwebtoken";
import { entitlementPrivateKey } from "../config/env.js";

export const signEntitlement = (userId, paidUntil) => {
    console.log("ajdd")
  const payload = {
    sub: userId.toString(),
    paidUntil: paidUntil ? new Date(paidUntil).toISOString() : null,
  };
  return jwt.sign(payload, entitlementPrivateKey, {
    algorithm: "ES256",
    expiresIn: "30d", // forces a re-check with the server at least monthly, even for a yearly plan
  });
};