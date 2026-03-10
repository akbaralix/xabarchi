import express from "express";
import OTP from "../models/OTP.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

const USERNAME_REGEX = /^[a-zA-Z0-9_]{4,24}$/;
const MIN_PASSWORD_LENGTH = 6;

const normalizeUsername = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const validateUsername = (value) => USERNAME_REGEX.test(value);

const validatePassword = (value) =>
  typeof value === "string" && value.length >= MIN_PASSWORD_LENGTH;
const normalizePassword = (value) => String(value || "").trim();

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.resolve(__dirname, "..", "serviceAccountKey.json");

const ensureFirebaseAuth = () => {
  if (admin.apps.length) {
    return { auth: admin.auth(), missing: [] };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const missing = [];

  if (!projectId) missing.push("FIREBASE_PROJECT_ID");
  if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
  if (!privateKey) missing.push("FIREBASE_PRIVATE_KEY");

  if (missing.length) {
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      return { auth: admin.auth(), missing: [] };
    }
    return { auth: null, missing };
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });

  return { auth: admin.auth(), missing: [] };
};

const generateRandomPassword = (length = 10) =>
  crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);

const generateUniqueChatId = async () => {
  for (let i = 0; i < 20; i += 1) {
    const candidate = Math.floor(100000000 + Math.random() * 900000000);
    const exists = await User.exists({ chatId: candidate });
    if (!exists) return candidate;
  }

  let fallback = Number(String(Date.now()).slice(-9));
  while (await User.exists({ chatId: fallback })) {
    fallback = Math.floor(100000000 + Math.random() * 900000000);
  }
  return fallback;
};

const generateAvailableUsername = async (seed) => {
  const base = normalizeUsername(seed).replace(/[^a-z0-9_]/g, "");
  const fallbackBase = base && base.length >= 4 ? base : "user";

  for (let i = 0; i < 20; i += 1) {
    const suffix =
      i === 0 ? "" : String(Math.floor(1000 + Math.random() * 9000));
    const candidate = `${fallbackBase}${suffix}`;
    if (!validateUsername(candidate)) continue;
    const exists = await User.exists({ username: candidate });
    if (!exists) return candidate;
  }

  return `user${Math.floor(100000 + Math.random() * 900000)}`;
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

const buildGoogleSetupToken = ({ uid, email, name, picture }) =>
  jwt.sign(
    {
      uid,
      email: email || null,
      name: name || null,
      picture: picture || null,
      purpose: "google-signup-setup",
    },
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

router.post("/api/auth/login-password", async (req, res) => {
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: "JWT_SECRET sozlanmagan!" });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username va password talab qilinadi!" });
  }

  const normalizedUsername = normalizeUsername(username);
  const normalizedPassword = normalizePassword(password);

  try {
    let user = await User.findOne({ username: normalizedUsername });
    if (!user) {
      user = await User.findOne({ email: normalizeEmail(normalizedUsername) });
    }

    if (!user || !user.passwordHash || !user.passwordSalt) {
      return res.status(401).json({ message: "Login yoki parol noto'g'ri." });
    }

    const isValid =
      verifyPassword(normalizedPassword, user.passwordSalt, user.passwordHash) ||
      verifyPassword(
        normalizedPassword.toLowerCase(),
        user.passwordSalt,
        user.passwordHash,
      );

    if (!isValid) {
      return res.status(401).json({ message: "Login yoki parol noto'g'ri." });
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
      message: "Username 4-24 belgidan iborat bo'lsin (faqat harf, raqam, _).",
    });
  }
  if (!validatePassword(normalizedPassword)) {
    return res.status(400).json({
      message: `Parol kamida ${MIN_PASSWORD_LENGTH} belgili bo'lsin.`,
    });
  }

  try {
    const payload = jwt.verify(setupToken, process.env.JWT_SECRET);
    if (payload.purpose !== "telegram-signup-setup" || !payload.chatId) {
      return res.status(400).json({ message: "setupToken yaroqsiz!" });
    }

    const existingByUsername = await User.findOne({
      username: normalizedUsername,
    })
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
    if (
      err?.name === "TokenExpiredError" ||
      err?.name === "JsonWebTokenError"
    ) {
      return res
        .status(400)
        .json({ message: "setupToken muddati tugagan yoki noto'g'ri." });
    }
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Bu username band." });
    }
    console.log(err);
    return res.status(500).json({ message: "Serverda xatolik yuz berdi!" });
  }
});

router.post("/api/auth/complete-google-signup", async (req, res) => {
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
      message: "Username 4-24 belgidan iborat bo'lsin (faqat harf, raqam, _).",
    });
  }
  if (!validatePassword(normalizedPassword)) {
    return res.status(400).json({
      message: `Parol kamida ${MIN_PASSWORD_LENGTH} belgili bo'lsin.`,
    });
  }

  try {
    const payload = jwt.verify(setupToken, process.env.JWT_SECRET);
    if (payload.purpose !== "google-signup-setup" || !payload.uid) {
      return res.status(400).json({ message: "setupToken yaroqsiz!" });
    }

    const existingByUsername = await User.findOne({
      username: normalizedUsername,
    })
      .select("_id")
      .lean();
    if (existingByUsername) {
      return res.status(409).json({ message: "Bu username band." });
    }

    let existing = await User.findOne({ googleId: payload.uid });
    if (!existing && payload.email) {
      existing = await User.findOne({ email: normalizeEmail(payload.email) });
    }

    if (existing) {
      if (!existing.googleId) existing.googleId = payload.uid;
      if (!existing.profilePic && payload.picture) {
        existing.profilePic = payload.picture;
      }
      await existing.save();
      const token = await saveLoginToken(existing);
      return res.json({
        message: "Login muvaffaqiyatli!",
        token,
        user: {
          firstName: existing.firstName,
          chatId: existing.chatId,
          username: existing.username || null,
        },
      });
    }

    const { hash, salt } = hashPassword(normalizedPassword);
    const chatId = await generateUniqueChatId();
    const created = await User.create({
      googleId: payload.uid,
      email: payload.email ? normalizeEmail(payload.email) : undefined,
      firstName: payload.name || "Google User",
      username: normalizedUsername,
      chatId,
      profilePic: payload.picture || "",
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
    if (
      err?.name === "TokenExpiredError" ||
      err?.name === "JsonWebTokenError"
    ) {
      return res
        .status(400)
        .json({ message: "setupToken muddati tugagan yoki noto'g'ri." });
    }
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Bu username band." });
    }
    console.log(err);
    return res.status(500).json({ message: "Serverda xatolik yuz berdi!" });
  }
});

router.post("/api/auth/login-google", async (req, res) => {
  const { auth, missing } = ensureFirebaseAuth();
  if (!auth) {
    const detail = missing.length
      ? `Missing env: ${missing.join(", ")}`
      : "Firebase Admin SDK sozlanmagan.";
    return res.status(503).json({ message: detail });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: "JWT_SECRET sozlanmagan!" });
  }

  const { token, idToken } = req.body || {};
  const firebaseToken = token || idToken;
  if (!firebaseToken) {
    return res
      .status(400)
      .json({ message: "Google ID token yuborilishi kerak." });
  }

  try {
    const decodedToken = await auth.verifyIdToken(firebaseToken);
    const { uid, email, name, picture } = decodedToken;

    let user = await User.findOne({ googleId: uid });

    const normalizedEmail = email ? normalizeEmail(email) : null;
    if (!user && normalizedEmail) {
      user = await User.findOne({ email: normalizedEmail });
    }

    if (user) {
      // Foydalanuvchi mavjud, ma'lumotlarini yangilab, tizimga kiritamiz
      if (!user.googleId) user.googleId = uid;
      if (!user.profilePic && picture) user.profilePic = picture;
      await user.save();

      const appToken = await saveLoginToken(user);
      return res.json({ message: "Login muvaffaqiyatli!", token: appToken });
    }

    // Yangi foydalanuvchi: username/parolni o'zi tanlasin
    const setupToken = buildGoogleSetupToken({
      uid,
      email: normalizedEmail,
      name,
      picture,
    });
    return res.status(200).json({
      message: "Username va parolni tanlang",
      needsSetup: true,
      setupToken,
      googleProfile: {
        name: name || null,
        email: normalizedEmail || null,
        picture: picture || null,
      },
    });
  } catch (error) {
    console.error("Google login xatoligi:", error);
    if (
      error.code === "auth/id-token-expired" ||
      error.code === "auth/argument-error"
    ) {
      return res
        .status(401)
        .json({ message: "Google token yaroqsiz yoki muddati o'tgan." });
    }
    return res
      .status(500)
      .json({ message: "Google orqali kirishda server xatoligi." });
  }
});

export default router;
