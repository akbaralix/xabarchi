import mongoose from "mongoose";

const OTPSchema = new mongoose.Schema({
  chatId: { type: Number, required: true },
  otp: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 },
  verified: { type: Boolean, default: false },
});
const OTP = mongoose.model("OTP", OTPSchema);

export default OTP;
