import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true,
        unique:true
    },
    plan:{
        type:String,
        enum:["monthly","yearly"],
        required:true,
    },
    paidUntil:{type:Date,required:true},
    provider:{type:String,required:true,enum:["razorpay"]}
},
{ timestamps: true }
);

const Subscription = mongoose.model("Subscription",subscriptionSchema);
export default Subscription