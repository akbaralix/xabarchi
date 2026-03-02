import express from "express";
import OTP from "../models/OTP.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const router = express.Router();

const USERNAME_REGEX = /^[a-zA-Z0-9_]{4,24}$/;
const MIN_PASSWORD_LENGTH = 6;

const normalizeUsername = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const validateUsername = (value) => USERNAME_REGEX.test(value);

const validatePassword = (value) =>
  typeof value === "string" && value.length >= MIN_PASSWORD_LENGTH;
const normalizePassword = (value) => String(value || "").trim().toLowerCase();

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
};

const verifyPassword = (password, salt, expectedHash) => {
  if (!salt || !expectedHash) return false;
  const computed = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(
    Buffer.from(computed, "hex"),
    Buffer.from(expectedHash, "hex"),
  );
};

const buildToken = (chatId) =>
  jwt.sign({ chatId }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });

const buildSetupToken = (chatId, firstName) =>
  jwt.sign(
    { chatId, firstName, purpose: "telegram-signup-setup" },
    process.env.JWT_SECRET,
    { expiresIn: "10m" },
  );

const saveLoginToken = async (user) => {
  const token = buildToken(user.chatId);
  user.jwtToken = token;
  await user.save();
  return token;
};

const loginWithCode = async (code, res) => {
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: "JWT_SECRET sozlanmagan!" });
  }

  const normalizedCode = Number(code);
  if (
    !Number.isInteger(normalizedCode) ||
    String(normalizedCode).length !== 6
  ) {
    return res.status(400).json({ message: "6 xonali kod kiriting!" });
  }

  try {
    const otp = await OTP.findOne({ code: normalizedCode }).sort({
      createdAt: -1,
    });
    if (!otp) {
      return res.status(404).json({ message: "Kod topilmadi yoki eskirgan!" });
    }

    let user = await User.findOne({ chatId: otp.chatId });

    if (user) {
      const token = await saveLoginToken(user);
      await OTP.deleteOne({ _id: otp._id });
      return res.json({
        message: "Login muvaffaqiyatli!",
        needsSetup: false,
        token,
        user: {
          firstName: user.firstName,
          chatId: user.chatId,
          username: user.username || null,
        },
      });
    }

    await OTP.deleteOne({ _id: otp._id });
    const setupToken = buildSetupToken(otp.chatId, otp.firstName);

    return res.json({
      message: "Username va parolni tanlang",
      needsSetup: true,
      setupToken,
      telegramProfile: {
        firstName: otp.firstName,
        chatId: otp.chatId,
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

router.post("/api/auth/complete-telegram-signup", async (req, res) => {
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: "JWT_SECRET sozlanmagan!" });
  }

  const { setupToken, username, password } = req.body || {};
  if (!setupToken || !username || !password) {
    return res
      .status(400)
      .json({ message: "setupToken, username va password talab qilinadi!" });
  }

  const normalizedUsername = normalizeUsername(username);
  const normalizedPassword = normalizePassword(password);
  if (!validateUsername(normalizedUsername)) {
    return res.status(400).json({
      message:
        "Username 4-24 belgidan iborat bo'lsin (faqat harf, raqam, _).",
    });
  }
  if (!validatePassword(normalizedPassword)) {
    return res
      .status(400)
      .json({ message: `Parol kamida ${MIN_PASSWORD_LENGTH} belgili bo'lsin.` });
  }

  try {
    const payload = jwt.verify(setupToken, process.env.JWT_SECRET);
    if (payload.purpose !== "telegram-signup-setup" || !payload.chatId) {
      return res.status(400).json({ message: "setupToken yaroqsiz!" });
    }

    const existingByUsername = await User.findOne({ username: normalizedUsername })
      .select("_id")
      .lean();
    if (existingByUsername) {
      return res.status(409).json({ message: "Bu username band." });
    }

    const existingByChat = await User.findOne({ chatId: payload.chatId });
    if (existingByChat) {
      const token = await saveLoginToken(existingByChat);
      return res.json({
        message: "Login muvaffaqiyatli!",
        token,
        user: {
          firstName: existingByChat.firstName,
          chatId: existingByChat.chatId,
          username: existingByChat.username || null,
        },
      });
    }

    const { hash, salt } = hashPassword(normalizedPassword);
    const created = await User.create({
      firstName: payload.firstName || "Telegram User",
      chatId: payload.chatId,
      username: normalizedUsername,
      passwordHash: hash,
      passwordSalt: salt,
    });

    const token = await saveLoginToken(created);

    return res.status(201).json({
      message: "Hisob yaratildi va login qilindi!",
      token,
      user: {
        firstName: created.firstName,
        chatId: created.chatId,
        username: created.username,
      },
    });
  } catch (err) {
    if (err?.name === "TokenExpiredError" || err?.name === "JsonWebTokenError") {
      return res.status(400).json({ message: "setupToken muddati tugagan yoki noto'g'ri." });
    }
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Bu username band." });
    }
    console.log(err);
    return res.status(500).json({ message: "Serverda xatolik yuz berdi!" });
  }
});

router.post("/api/auth/login-password", async (req, res) => {
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: "JWT_SECRET sozlanmagan!" });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "username va password kiritilishi kerak!" });
  }

  const normalizedUsername = normalizeUsername(username);
  const normalizedPassword = normalizePassword(password);
  if (!validateUsername(normalizedUsername)) {
    return res.status(400).json({ message: "Username formati noto'g'ri." });
  }

  try {
    const user = await User.findOne({ username: normalizedUsername });
    if (!user) {
      return res.status(401).json({ message: "Username yoki parol noto'g'ri." });
    }

    const isValid = verifyPassword(
      normalizedPassword,
      user.passwordSalt,
      user.passwordHash,
    );
    if (!isValid) {
      return res.status(401).json({ message: "Username yoki parol noto'g'ri." });
    }

    const token = await saveLoginToken(user);
    return res.json({
      message: "Login muvaffaqiyatli!",
      token,
      user: {
        firstName: user.firstName,
        chatId: user.chatId,
        username: user.username || null,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Serverda xatolik yuz berdi!" });
  }
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
