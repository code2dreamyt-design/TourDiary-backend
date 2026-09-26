import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Subscription from "../models/Subscription.js"

export const hasActiveSubscription = async (userId)=>{
    try {
        const checkStatus = await Subscription.findOne(
            {
                user:userId,
                paidUntil:{$gt:new Date()}
            }
        );
        if(!checkStatus){
            return false;
        }
        return true;
    } catch (error) {
        throw error
    }
};

export const calculateNewPaidUntil =  (currentPaidUntil,plan)=>{
    const today = new Date();
    if(plan==="monthly"|| plan==="yearly"){
    const baseDate = (currentPaidUntil && new Date(currentPaidUntil) > today) ? new Date(currentPaidUntil): new Date(today);
    console.log(baseDate)
    const daysToAdd = plan==="monthly" ? 30:365;

    baseDate.setUTCDate(baseDate.getUTCDate()+daysToAdd);
    console.log(baseDate)
    return baseDate;
    }
    throw new Error("Not a valid plan")
}

export const applySuccessfulPayment = async ( { userId, plan, provider, providerPaymentId, amount }) =>{
    const session =await mongoose.startSession();

    try {
        let paidUntil;
        await session.withTransaction(async ()=>{
            await Payment.create([{user:userId,plan,provider,providerPaymentId,amount}],{session});

            const existing = await Subscription.findOne({user:userId}).session(session);

            paidUntil = calculateNewPaidUntil(existing?.paidUntil,plan);
            console.log(paidUntil);
            await Subscription.findOneAndUpdate(
                {user:userId},
                {$set:{
                    plan,
                    paidUntil,
                    provider,
                }},
                {
                    upsert:true,
                    returnDocument: "after",
                    runValidators:true,
                    session
                }
            )
        });

        return {applied:true,paidUntil}
    } catch (error) {
        if(error.code===11000 && error.keyPattern?.providerPaymentId){
            return { applied: false, reason: "duplicate" };
        }
        throw error;
    }
    finally{
        await session.endSession();
    }
}
export const getPaidUntil = async (userId) => {
  const subscription = await Subscription.findOne({ user: userId });
  return subscription?.paidUntil ?? null;
};
