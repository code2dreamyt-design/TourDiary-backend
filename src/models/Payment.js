import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        user:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"User",
            required:true
        },
        provider:{type:String,enum:["razorpay"],required:true},
        providerPaymentId:{type:String,required:true},
        plan:{type:String,enum:["monthly","yearly"],required:true},
        amount:{type:Number,required:true},
        currency:{type:String,default:"INR",required:true}
    },
    { timestamps: true }
);

paymentSchema.index({provider:1,providerPaymentId:1},{unique:true});
const Payment = mongoose.model("Payment",paymentSchema);
export default Payment;