import Razorpay from "razorpay";
import { razorpaWebhookSecret } from "../config/env.js";
import { applySuccessfulPayment } from "../services/subscription.service.js";

export const webhookCheck = async (req,res)=>{
    try {
        console.log("i hit the endpoint")
        const signature = req.headers["x-razorpay-signature"];
        const rawBody = req.body;
        if(!signature || !rawBody) return res.status(400).json({message:"No Signature or Body"});
        const verifyWebhook = Razorpay.validateWebhookSignature(rawBody,signature,razorpaWebhookSecret);
        if(!verifyWebhook) return res.status(400).json({message:"Verification Failed"});

        const parsedBody = JSON.parse(req.body);
        console.log(parsedBody);
        if(parsedBody.event==="payment.captured"){
            const savePayment = await applySuccessfulPayment({
                userId:parsedBody.payload.payment.entity.notes.userId,
                plan:parsedBody.payload.payment.entity.notes.plan,
                provider:"razorpay",
                providerPaymentId:parsedBody.payload.payment.entity.id,
                amount:parsedBody.payload.payment.entity.amount
            });
            if(savePayment.applied){
                return res.status(200).json({message:"Saved in Database"});
            }
            return res.status(200).json({message:"Already Saved"});
        }
        return res.status(200).json({message:"Ignored"});
    } catch (error) {
        console.log(error);
        return res.status(500).json({message:"Internal Server Error"})
    }
}