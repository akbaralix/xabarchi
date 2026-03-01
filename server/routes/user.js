import express from "express";
import User from "../models/User.js";
import { verifyToken } from "../middleware/auth.js"; // Middleware'ni chaqiramiz

const userRouter = express.Router();

// Bu route endi xavfsiz! Faqat to'g'ri tokeni borlar kira oladi
userRouter.get("/me", verifyToken, async (req, res) => {
  try {
    // req.user endi verifyToken'dan kelmoqda
    const user = await User.findOne({ chatId: req.user.chatId });

    if (!user)
      return res.status(404).json({ message: "Foydalanuvchi topilmadi!" });

    res.json(user);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Serverda xatolik yuz berdi!" });
  }
});

userRouter.get("/user/:chatId", verifyToken, async (req, res) => {
  try {
    const requestedChatId = Number(req.params.chatId);
    if (!Number.isInteger(requestedChatId)) {
      return res.status(400).json({ message: "chatId noto'g'ri formatda!" });
    }

    if (requestedChatId !== req.user.chatId) {
      return res.status(403).json({ message: "Ruxsat berilmagan!" });
    }

    const user = await User.findOne({ chatId: requestedChatId }).select(
      "firstName chatId username",
    );
    if (!user) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi!" });
    }

    return res.json(user);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Serverda xatolik yuz berdi!" });
  }
});

export default userRouter;
