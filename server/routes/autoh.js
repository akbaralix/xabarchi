/* global process */
import express from "express";
import OTP from "../models/OTP.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

const router = express.Router();

const buildToken = (chatId) =>
  jwt.sign({ chatId }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });

const loginWithCode = async (code, res) => {
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: "JWT_SECRET sozlanmagan!" });
  }

  const normalizedCode = Number(code);
  if (!Number.isInteger(normalizedCode) || String(normalizedCode).length !== 6) {
    return res.status(400).json({ message: "6 xonali kod kiriting!" });
  }

  try {
    const otp = await OTP.findOne({ code: normalizedCode }).sort({ createdAt: -1 });
    if (!otp) {
      return res.status(404).json({ message: "Kod topilmadi yoki eskirgan!" });
    }

    const token = buildToken(otp.chatId);
    let user = await User.findOne({ chatId: otp.chatId });

    if (!user) {
      user = await User.create({
        firstName: otp.firstName,
        chatId: otp.chatId,
        jwtToken: token,
      });
    } else {
      user.jwtToken = token;
      await user.save();
    }

    await OTP.deleteOne({ _id: otp._id });

    return res.json({
      message: "Login muvaffaqiyatli!",
      token,
      user: {
        firstName: user.firstName,
        chatId: user.chatId,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Serverda xatolik yuz berdi!" });
  }
};

router.post("/api/auth/login", async (req, res) => {
  const { code } = req.body || {};
  if (!code) {
    return res.status(400).json({ message: "Kod kiritilishi kerak!" });
  }

  return loginWithCode(code, res);
});

// Backward compatibility for existing frontend usage.
router.get("/import-code", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ message: "Kod kiritilishi kerak!" });
  }

  return loginWithCode(code, res);
});

export default router;





