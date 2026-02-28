import TelegramBot from "node-telegram-bot-api";
import connectDB from "../db.js";
import dotenv from "dotenv";
import OTP from "../models/OTP.js";

dotenv.config();
connectDB();
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

const genetareOTP = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

bot.on("message", async (msg) => {
  const otpCode = genetareOTP();

  try {
    await OTP.create({
      chatId: msg.chat.id,
      otp: otpCode,
    });
    console.log("OTP saqlandi:", otpCode);
  } catch (error) {
    console.log(error);
  }
  bot.sendMessage(
    msg.chat.id,
    `Xabar saytga kirish uchun sizni tasdiqlash kodingiz: ${otpCode}`,
  );
});

export default bot;
