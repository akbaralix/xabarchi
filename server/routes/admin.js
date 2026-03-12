import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Post from "../models/Post.js";
import Report from "../models/Report.js";
import { verifyToken } from "../middleware/auth.js";

const adminRouter = express.Router();
const ADMIN_CHAT_ID = Number(process.env.ADMIN_CHAT_ID || 907402803);
const ACTIVE_WINDOW_DAYS = 7;

const adminOnly = (req, res, next) => {
  if (req.user?.chatId !== ADMIN_CHAT_ID) {
    return res.status(403).json({ message: "Ruxsat berilmagan." });
  }
  return next();
};

adminRouter.use(verifyToken, adminOnly);

adminRouter.get("/admin/stats", async (_req, res) => {
  try {
    const activeSince = new Date(
      Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const [totalUsers, totalPosts, activeUsers, openReports] =
      await Promise.all([
        User.countDocuments(),
        Post.countDocuments(),
        User.countDocuments({ lastActiveAt: { $gte: activeSince } }),
        Report.countDocuments({ status: "open" }),
      ]);

    return res.json({
      totalUsers,
      totalPosts,
      activeUsers,
      openReports,
      activeWindowDays: ACTIVE_WINDOW_DAYS,
    });
  } catch (error) {
    console.log("Admin stats xatoligi:", error);
    return res.status(500).json({ message: "Statistika olishda xatolik." });
  }
});

adminRouter.get("/admin/users", async (req, res) => {
  const search = String(req.query.search || "").trim().toLowerCase();
  const filter = {};

  if (search) {
    const chatId = Number(search);
    if (Number.isInteger(chatId)) {
      filter.chatId = chatId;
    } else {
      filter.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
      ];
    }
  }

  try {
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const chatIds = users.map((user) => user.chatId);
    const postCounts = await Post.aggregate([
      { $match: { authorChatId: { $in: chatIds } } },
      { $group: { _id: "$authorChatId", count: { $sum: 1 } } },
    ]);
    const postCountMap = new Map(
      postCounts.map((item) => [item._id, item.count]),
    );

    const prepared = users.map((user) => ({
      chatId: user.chatId,
      username: user.username || "",
      firstName: user.firstName || "",
      email: user.email || "",
      profilePic: user.profilePic || "",
      followersCount: Array.isArray(user.followerChatIds)
        ? user.followerChatIds.length
        : 0,
      followingCount: Array.isArray(user.followingChatIds)
        ? user.followingChatIds.length
        : 0,
      postCount: postCountMap.get(user.chatId) || 0,
      isBlocked: Boolean(user.isBlocked),
      blockedReason: user.blockedReason || "",
      blockedAt: user.blockedAt || null,
      lastActiveAt: user.lastActiveAt || null,
      createdAt: user.createdAt,
    }));

    return res.json(prepared);
  } catch (error) {
    console.log("Admin users xatoligi:", error);
    return res.status(500).json({ message: "Userlar ro'yxati xatoligi." });
  }
});

adminRouter.patch("/admin/users/:chatId/block", async (req, res) => {
  const chatId = Number(req.params.chatId);
  if (!Number.isInteger(chatId)) {
    return res.status(400).json({ message: "chatId noto'g'ri formatda!" });
  }

  const blocked = Boolean(req.body?.blocked);
  const reason =
    typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

  try {
    const updates = blocked
      ? {
          isBlocked: true,
          blockedReason: reason,
          blockedAt: new Date(),
          blockedBy: req.user.chatId,
        }
      : {
          isBlocked: false,
          blockedReason: "",
          blockedAt: null,
          blockedBy: null,
        };

    const user = await User.findOneAndUpdate(
      { chatId },
      { $set: updates },
      { new: true },
    ).select("chatId username firstName isBlocked blockedReason blockedAt");

    if (!user) return res.status(404).json({ message: "User topilmadi!" });
    return res.json(user);
  } catch (error) {
    console.log("Block xatoligi:", error);
    return res.status(500).json({ message: "Bloklashda xatolik." });
  }
});

adminRouter.delete("/admin/posts/:postId", async (req, res) => {
  const { postId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ message: "postId noto'g'ri!" });
  }

  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post topilmadi!" });

    await Post.deleteOne({ _id: post._id });
    await Report.updateMany(
      { postId: post._id, status: "open" },
      {
        $set: {
          status: "resolved",
          resolvedAt: new Date(),
          resolvedBy: req.user.chatId,
          action: "post_deleted",
        },
      },
    );

    return res.json({ message: "Post o'chirildi." });
  } catch (error) {
    console.log("Post o'chirish xatoligi:", error);
    return res.status(500).json({ message: "Postni o'chirishda xatolik." });
  }
});

adminRouter.get("/admin/reports", async (req, res) => {
  const status = String(req.query.status || "open").toLowerCase();
  const filter = status === "all" ? {} : { status };

  try {
    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const chatIds = new Set();
    reports.forEach((report) => {
      if (report.reporterChatId) chatIds.add(report.reporterChatId);
      if (report.postAuthorChatId) chatIds.add(report.postAuthorChatId);
    });

    const users = await User.find({ chatId: { $in: [...chatIds] } })
      .select("chatId username firstName profilePic isBlocked")
      .lean();
    const userMap = new Map(users.map((user) => [user.chatId, user]));

    const prepared = reports.map((report) => ({
      _id: report._id,
      postId: report.postId,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt,
      resolvedAt: report.resolvedAt || null,
      action: report.action || "",
      postSnapshot: report.postSnapshot || {},
      reporter: userMap.get(report.reporterChatId) || null,
      author: userMap.get(report.postAuthorChatId) || null,
    }));

    return res.json(prepared);
  } catch (error) {
    console.log("Report list xatoligi:", error);
    return res.status(500).json({ message: "Shikoyatlar olishda xatolik." });
  }
});

adminRouter.patch("/admin/reports/:reportId/resolve", async (req, res) => {
  const { reportId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(reportId)) {
    return res.status(400).json({ message: "reportId noto'g'ri!" });
  }

  try {
    const updated = await Report.findOneAndUpdate(
      { _id: reportId },
      {
        $set: {
          status: "resolved",
          resolvedAt: new Date(),
          resolvedBy: req.user.chatId,
          action: "resolved",
        },
      },
      { new: true },
    ).lean();

    if (!updated) {
      return res.status(404).json({ message: "Shikoyat topilmadi!" });
    }

    return res.json({ message: "Shikoyat yopildi." });
  } catch (error) {
    console.log("Report resolve xatoligi:", error);
    return res.status(500).json({ message: "Shikoyatni yopishda xatolik." });
  }
});

export default adminRouter;
