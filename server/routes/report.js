import express from "express";
import mongoose from "mongoose";
import Report from "../models/Report.js";
import Post from "../models/Post.js";
import { verifyToken } from "../middleware/auth.js";

const reportRouter = express.Router();

reportRouter.post("/reports", verifyToken, async (req, res) => {
  const { postId, reason } = req.body || {};

  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ message: "postId noto'g'ri!" });
  }
  if (!reason || typeof reason !== "string" || reason.trim().length < 2) {
    return res.status(400).json({ message: "Shikoyat sababi talab qilinadi." });
  }

  try {
    const post = await Post.findById(postId).lean();
    if (!post) return res.status(404).json({ message: "Post topilmadi!" });

    const existing = await Report.findOne({
      postId,
      reporterChatId: req.user.chatId,
      status: "open",
    }).lean();
    if (existing) {
      return res.json({ message: "Shikoyat allaqachon yuborilgan." });
    }

    const report = await Report.create({
      postId,
      reporterChatId: req.user.chatId,
      reason: reason.trim(),
      postAuthorChatId: post.authorChatId || null,
      postSnapshot: {
        title: post.title,
        imageUrl: post.imageUrl,
        imageUrls: post.imageUrls,
        userName: post.userName,
        profilePic: post.profilePic || "",
      },
    });

    return res.status(201).json({ message: "Shikoyat qabul qilindi.", report });
  } catch (error) {
    console.log("Shikoyat xatoligi:", error);
    return res.status(500).json({ message: "Shikoyat yuborishda xatolik." });
  }
});

export default reportRouter;
