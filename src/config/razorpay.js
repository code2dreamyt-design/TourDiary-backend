import Razorpay from "razorpay";
import { razorPayApiKey, razorPaySecret } from "./env.js";

const razorpay = new Razorpay({
    key_id:razorPayApiKey,
    key_secret:razorPaySecret,
});

export default razorpay;