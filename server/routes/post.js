import express from "express";
import mongoose from "mongoose";
import Post from "../models/Post.js";
import Notification from "../models/Notification.js";
import PostComment from "../models/PostComment.js";
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

const attachProfilePics = async (posts) => {
  if (!Array.isArray(posts) || posts.length === 0) return [];
  const chatIds = [...new Set(posts.map((post) => post.authorChatId).filter(Boolean))];
  if (chatIds.length === 0) return posts;

  const users = await User.find({ chatId: { $in: chatIds } })
    .select("chatId profilePic")
    .lean();

  const userPicMap = new Map(users.map((user) => [user.chatId, user.profilePic || ""]));
  return posts.map((post) => ({
    ...post,
    profilePic: userPicMap.get(post.authorChatId) || post.profilePic || "",
  }));
};

const createNotification = async ({
  req,
  toChatId,
  fromChatId,
  type,
  postId,
  commentId,
  text,
}) => {
  if (!toChatId || !fromChatId || toChatId === fromChatId) return null;
  const fromUser = await User.findOne({ chatId: fromChatId })
    .select("username firstName profilePic")
    .lean();
  const payload = {
    toChatId,
    fromChatId,
    type,
    postId,
    commentId,
    text: text || "",
    fromUsername: fromUser?.username || fromUser?.firstName || "",
    fromProfilePic: fromUser?.profilePic || "",
  };
  const created = await Notification.create(payload);

  const io = req.app.get("io");
  if (io) {
    io.to(`user:${toChatId}`).emit("notification:new", {
      _id: created._id,
      ...payload,
      isRead: created.isRead,
      createdAt: created.createdAt,
    });
  }

  return created;
};

const createPost = async (req, res) => {
  if (!requireDbConnection(res)) return;

  try {
    const rawTitle = req.body?.title;
    const rawImageUrl = req.body?.imageUrl || req.body?.image;
    const rawImageUrls = Array.isArray(req.body?.imageUrls)
      ? req.body.imageUrls
      : rawImageUrl
        ? [rawImageUrl]
        : [];

    const title =
      typeof rawTitle === "string" && rawTitle.trim()
        ? rawTitle.trim()
        : "Yangi post";
    if (title.length > 5000) {
      return res.status(400).json({ message: "Izoh 5000 belgidan oshmasligi kerak." });
    }

    if (!rawImageUrls.length || rawImageUrls.length > 10) {
      return res.status(400).json({
        message: "Bir post uchun 1 tadan 10 tagacha rasm yuborish mumkin.",
      });
    }

    const normalizedImageUrls = rawImageUrls
      .map((url) => (typeof url === "string" ? url.trim() : ""))
      .filter(Boolean);

    if (
      normalizedImageUrls.length !== rawImageUrls.length ||
      normalizedImageUrls.some((url) => !isValidHttpUrl(url))
    ) {
      return res.status(400).json({
        message:
          "imageUrl/imageUrls noto'g'ri. Faqat Supabase/public HTTP(S) URL yuboring.",
      });
    }

    const user = await User.findOne({ chatId: req.user.chatId })
      .select("firstName chatId username profilePic")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi!" });
    }

    const newPost = await Post.create({
      title,
      imageUrl: normalizedImageUrls[0],
      imageUrls: normalizedImageUrls,
      userName: user.username || user.firstName || "Noma'lum",
      authorChatId: user.chatId,
      profilePic: user.profilePic || "",
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
    const postsWithProfilePic = await attachProfilePics(dbPosts);
    const prepared = postsWithProfilePic.map((post) => {
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
    const postsWithProfilePic = await attachProfilePics(dbPosts);
    const prepared = postsWithProfilePic.map((post) => ({
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

    if (!hasLiked && post.authorChatId !== req.user.chatId) {
      await createNotification({
        req,
        toChatId: post.authorChatId,
        fromChatId: req.user.chatId,
        type: "like",
        postId: post._id,
      });
    }

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

const getComments = async (req, res) => {
  if (!requireDbConnection(res)) return;
  const { postId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ message: "postId noto'g'ri!" });
  }

  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const comments = await PostComment.find({ postId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const chatIds = [...new Set(comments.map((c) => c.authorChatId))];
    const users = await User.find({ chatId: { $in: chatIds } })
      .select("chatId username firstName profilePic")
      .lean();
    const userMap = new Map(users.map((u) => [u.chatId, u]));

    const prepared = comments
      .map((comment) => {
        const author = userMap.get(comment.authorChatId);
        return {
          ...comment,
          author: author
            ? {
                chatId: author.chatId,
                username: author.username || author.firstName || "",
                profilePic: author.profilePic || "",
              }
            : null,
        };
      })
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return res.json(prepared);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Kommentlarni olishda xatolik" });
  }
};

const addComment = async (req, res) => {
  if (!requireDbConnection(res)) return;
  const { postId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ message: "postId noto'g'ri!" });
  }

  try {
    const text = String(req.body?.text || "").trim();
    if (!text) {
      return res.status(400).json({ message: "Komment matni bo'sh" });
    }
    if (text.length > 1000) {
      return res.status(400).json({ message: "Komment 1000 belgidan oshmasin" });
    }

    const post = await Post.findById(postId).lean();
    if (!post) return res.status(404).json({ message: "Post topilmadi!" });

    const comment = await PostComment.create({
      postId,
      authorChatId: req.user.chatId,
      text,
    });

    await createNotification({
      req,
      toChatId: post.authorChatId,
      fromChatId: req.user.chatId,
      type: "comment",
      postId: post._id,
      commentId: comment._id,
      text,
    });

    return res.status(201).json(comment);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Komment qo'shishda xatolik" });
  }
};

const deleteComment = async (req, res) => {
  if (!requireDbConnection(res)) return;
  const { postId, commentId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ message: "postId noto'g'ri!" });
  }
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    return res.status(400).json({ message: "commentId noto'g'ri!" });
  }

  try {
    const comment = await PostComment.findOne({ _id: commentId, postId });
    if (!comment) {
      return res.status(404).json({ message: "Komment topilmadi" });
    }
    if (comment.authorChatId !== req.user.chatId) {
      return res.status(403).json({ message: "Faqat o'zingiz kommentini o'chira olasiz" });
    }

    await PostComment.deleteOne({ _id: comment._id });
    return res.json({ ok: true, commentId: String(comment._id), postId: String(postId) });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Kommentni o'chirishda xatolik" });
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

const getPostById = async (req, res) => {
  if (!requireDbConnection(res)) return;
  const { postId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ message: "postId noto'g'ri!" });
  }

  try {
    const viewerChatId = req.user?.chatId || null;
    const dbPost = await Post.findById(postId).lean();
    if (!dbPost) return res.status(404).json({ message: "Post topilmadi!" });
    const [prepared] = await attachProfilePics([dbPost]);
    const likedBy = Array.isArray(prepared.likedByChatIds)
      ? prepared.likedByChatIds
      : [];
    const viewedBy = Array.isArray(prepared.viewedByChatIds)
      ? prepared.viewedByChatIds
      : [];

    return res.json({
      ...prepared,
      likes: likedBy.length,
      views: viewedBy.length,
      viewerHasLiked: viewerChatId ? likedBy.includes(viewerChatId) : false,
      likedByChatIds: undefined,
      viewedByChatIds: undefined,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Postni olishda xatolik" });
  }
};

postRouter.get("/posts", optionalVerifyToken, getPosts);
postRouter.get("/posts/me", verifyToken, getMyPosts);
postRouter.get("/posts/:postId", optionalVerifyToken, getPostById);
postRouter.post("/posts", verifyToken, createPost);
postRouter.post("/add", verifyToken, createPost);
postRouter.delete("/posts/:postId", verifyToken, deletePost);
postRouter.post("/posts/:postId/like", verifyToken, toggleLike);
postRouter.post("/posts/:postId/view", verifyToken, addView);
postRouter.get("/posts/:postId/comments", optionalVerifyToken, getComments);
postRouter.post("/posts/:postId/comments", verifyToken, addComment);
postRouter.delete(
  "/posts/:postId/comments/:commentId",
  verifyToken,
  deleteComment,
);

export default postRouter;
