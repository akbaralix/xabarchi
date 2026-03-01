/* global process */
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import OTP from "../models/OTP.js";

dotenv.config();

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

const getUniqueOtpCode = async () => {
  let otpCode = generateOTP();
  // Avoid collisions among active OTP records.
  for (let i = 0; i < 5; i += 1) {
    const exists = await OTP.exists({ code: otpCode });
    if (!exists) return otpCode;
    otpCode = generateOTP();
  }

  return otpCode;
};

let bot;

export const startBot = () => {
  if (bot) return bot;
  if (!process.env.TELEGRAM_TOKEN) {
    throw new Error("TELEGRAM_TOKEN sozlanmagan!");
  }

  bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

  bot.on("message", async (msg) => {
    if (msg.chat.type !== "private") return;

    const otpCode = await getUniqueOtpCode();

    try {
      await OTP.deleteMany({ chatId: msg.chat.id });
      await OTP.create({
        chatId: msg.chat.id,
        code: otpCode,
        firstName: msg.from.first_name || "Telegram User",
      });
      console.log("OTP saqlandi:", otpCode);
      await bot.sendMessage(
        msg.chat.id,
        `Xabar saytga kirish uchun sizni tasdiqlash kodingiz: ${otpCode}`,
      );
    } catch (error) {
      console.log(error);
      await bot.sendMessage(
        msg.chat.id,
        "Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.",
      );
    }
  });

  return bot;
};

export default startBot;





