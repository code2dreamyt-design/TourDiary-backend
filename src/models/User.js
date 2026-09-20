import mongoose from "mongoose";
import bcrypt from "bcrypt";
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: {
    type: String,
    unique:true,
    sparse:true,
    trim: true,
    lowercase: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  isEmailVerified: { type: Boolean, required: true, default: false },
  verificationTokenHash: { type: String },
  verificationExpiry: { type: Date },
  verificationEmailCount: { type: Number, default: 0 },
  verificationEmailCountResetAt: { type: Date },
  password: {
    type: String,
    select: false,
    required: true,
  },
  passwordResetTokenHash: { type: String },
  passwordResetExpiry: { type: Date },
  passwordResetCount: { type: Number, default: 0 },
  passwordResetCountResetAt: { type: Date },
  profilepic: {
    url: { type: String },
    publicId: { type: String },
  },
  dob: { type: Date },
  passwordChangedAt: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.passwordChangedAt;
    delete ret.verificationTokenHash;
    delete ret.passwordResetTokenHash;
    return ret;
  },
});

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = Date.now() - 1000;
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};
const User = mongoose.model("User", userSchema);
export default User;
