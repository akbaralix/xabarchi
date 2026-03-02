import express from "express";
import mongoose from "mongoose";
import Post from "../models/Post.js";
import User from "../models/User.js";
import { optionalVerifyToken, verifyToken } from "../middleware/auth.js";

const postRouter = express.Router();

const isValidHttpUrl = (value) => {
  if (!value || typeof value !== "string") return false;
  if (value.startsWith("data:")) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const requireDbConnection = (res) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      message:
        "MongoDB ulanmagan. Post saqlash uchun DATABASEURL bilan serverni ishga tushiring.",
    });
    return false;
  }

  return true;
};

const createPost = async (req, res) => {
  if (!requireDbConnection(res)) return;

  try {
    const rawTitle = req.body?.title;
    const rawImageUrl = req.body?.imageUrl || req.body?.image;

    const title =
      typeof rawTitle === "string" && rawTitle.trim()
        ? rawTitle.trim()
        : "Yangi post";
    if (title.length > 5000) {
      return res.status(400).json({ message: "Izoh 5000 belgidan oshmasligi kerak." });
    }

    if (!isValidHttpUrl(rawImageUrl)) {
      return res.status(400).json({
        message:
          "imageUrl noto'g'ri. Faqat Supabase/public HTTP(S) URL yuboring.",
      });
    }

    const user = await User.findOne({ chatId: req.user.chatId })
      .select("firstName chatId username")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi!" });
    }

    const newPost = await Post.create({
      title,
      imageUrl: rawImageUrl,
      userName: user.username || user.firstName || "Noma'lum",
      authorChatId: user.chatId,
    });

    return res.status(201).json(newPost);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Post yaratishda xatolik" });
  }
};

const getPosts = async (req, res) => {
  if (!requireDbConnection(res)) return;

  try {
    const viewerChatId = req.user?.chatId || null;
    const dbPosts = await Post.find().sort({ createdAt: -1 }).limit(100).lean();
    const prepared = dbPosts.map((post) => {
      const likedBy = Array.isArray(post.likedByChatIds) ? post.likedByChatIds : [];
      const viewedBy = Array.isArray(post.viewedByChatIds) ? post.viewedByChatIds : [];
      return {
        ...post,
        likes: likedBy.length,
        views: viewedBy.length,
        viewerHasLiked: viewerChatId ? likedBy.includes(viewerChatId) : false,
        likedByChatIds: undefined,
        viewedByChatIds: undefined,
      };
    });
    return res.json(prepared);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Postlarni olishda xatolik" });
  }
};

const getMyPosts = async (req, res) => {
  if (!requireDbConnection(res)) return;

  try {
    const dbPosts = await Post.find({ authorChatId: req.user.chatId })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const prepared = dbPosts.map((post) => ({
      ...post,
      likes: Array.isArray(post.likedByChatIds) ? post.likedByChatIds.length : post.likes || 0,
      views: Array.isArray(post.viewedByChatIds)
        ? post.viewedByChatIds.length
        : post.views || 0,
      viewerHasLiked: Array.isArray(post.likedByChatIds)
        ? post.likedByChatIds.includes(req.user.chatId)
        : false,
      likedByChatIds: undefined,
      viewedByChatIds: undefined,
    }));
    return res.json(prepared);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Postlarni olishda xatolik" });
  }
};

const deletePost = async (req, res) => {
  if (!requireDbConnection(res)) return;
  const { postId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ message: "postId noto'g'ri!" });
  }

  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post topilmadi!" });
    if (post.authorChatId !== req.user.chatId) {
      return res.status(403).json({ message: "Faqat o'zingizning postingizni o'chira olasiz." });
    }

    await Post.deleteOne({ _id: post._id });
    return res.json({ message: "Post o'chirildi." });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Postni o'chirishda xatolik" });
  }
};

const toggleLike = async (req, res) => {
  if (!requireDbConnection(res)) return;
  const { postId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ message: "postId noto'g'ri!" });
  }

  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post topilmadi!" });

    const likedBy = Array.isArray(post.likedByChatIds) ? post.likedByChatIds : [];
    const hasLiked = likedBy.includes(req.user.chatId);
    post.likedByChatIds = hasLiked
      ? likedBy.filter((id) => id !== req.user.chatId)
      : [...likedBy, req.user.chatId];
    post.likes = post.likedByChatIds.length;
    await post.save();

    return res.json({
      postId: post._id,
      liked: !hasLiked,
      likes: post.likes,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Like yangilashda xatolik" });
  }
};

const addView = async (req, res) => {
  if (!requireDbConnection(res)) return;
  const { postId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ message: "postId noto'g'ri!" });
  }

  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post topilmadi!" });

    const viewedBy = Array.isArray(post.viewedByChatIds) ? post.viewedByChatIds : [];
    const alreadyViewed = viewedBy.includes(req.user.chatId);
    if (!alreadyViewed) {
      post.viewedByChatIds = [...viewedBy, req.user.chatId];
      post.views = post.viewedByChatIds.length;
      await post.save();
    }

    return res.json({
      postId: post._id,
      viewed: true,
      views: Array.isArray(post.viewedByChatIds)
        ? post.viewedByChatIds.length
        : post.views || 0,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Viewni yangilashda xatolik" });
  }
};

postRouter.get("/posts", optionalVerifyToken, getPosts);
postRouter.post("/posts", verifyToken, createPost);
postRouter.post("/add", verifyToken, createPost);
postRouter.get("/posts/me", verifyToken, getMyPosts);
postRouter.delete("/posts/:postId", verifyToken, deletePost);
postRouter.post("/posts/:postId/like", verifyToken, toggleLike);
postRouter.post("/posts/:postId/view", verifyToken, addView);

export default postRouter;
