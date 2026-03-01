import mongoose from "mongoose";

const OTPSchema = new mongoose.Schema({
  chatId: { type: Number, required: true },
  code: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 },
  firstName: { type: String, required: true },
  verified: { type: Boolean, default: false },
});
const OTP = mongoose.model("OTP", OTPSchema);

export default OTP;
