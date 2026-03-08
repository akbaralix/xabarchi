import express from "express";
import User from "../models/User.js";
import Post from "../models/Post.js";
import { optionalVerifyToken, verifyToken } from "../middleware/auth.js";

const userRouter = express.Router();

const getFollowSummary = (user, viewerChatId) => {
  const followerChatIds = Array.isArray(user?.followerChatIds)
    ? user.followerChatIds
    : [];
  const followingChatIds = Array.isArray(user?.followingChatIds)
    ? user.followingChatIds
    : [];

  return {
    followersCount: followerChatIds.length,
    followingCount: followingChatIds.length,
    viewerIsFollowing:
      typeof viewerChatId === "number" ? followerChatIds.includes(viewerChatId) : false,
  };
};

const isValidHttpUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) return false;
  if (value.startsWith("data:")) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

userRouter.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ chatId: req.user.chatId }).select(
      "firstName chatId username profilePic bio followerChatIds followingChatIds",
    );

    if (!user)
      return res.status(404).json({ message: "Foydalanuvchi topilmadi!" });

    const follow = getFollowSummary(user, req.user.chatId);
    res.json({
      ...user.toObject(),
      ...follow,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Serverda xatolik yuz berdi!" });
  }
});

userRouter.patch("/me/profile", verifyToken, async (req, res) => {
  try {
    const rawBio = typeof req.body?.bio === "string" ? req.body.bio : undefined;
    const rawFirstName =
      typeof req.body?.firstName === "string" ? req.body.firstName : undefined;
    const rawProfilePic =
      typeof req.body?.profilePic === "string" ? req.body.profilePic : undefined;

    if (
      rawBio === undefined &&
      rawProfilePic === undefined &&
      rawFirstName === undefined
    ) {
      return res.status(400).json({ message: "bio, firstName yoki profilePic yuboring." });
    }

    const updates = {};

    if (rawBio !== undefined) {
      const bio = rawBio.trim();
      if (bio.length > 300) {
        return res.status(400).json({ message: "Bio 300 belgidan oshmasin." });
      }
      updates.bio = bio;
    }

    if (rawFirstName !== undefined) {
      const firstName = rawFirstName.trim();
      if (!firstName) {
        return res.status(400).json({ message: "Ism bo'sh bo'lmasligi kerak." });
      }
      if (firstName.length > 120) {
        return res.status(400).json({ message: "Ism 120 belgidan oshmasin." });
      }
      updates.firstName = firstName;
    }

    if (rawProfilePic !== undefined) {
      const profilePic = rawProfilePic.trim();
      if (profilePic && !isValidHttpUrl(profilePic)) {
        return res.status(400).json({ message: "profilePic URL noto'g'ri." });
      }
      updates.profilePic = profilePic;
    }

    const updated = await User.findOneAndUpdate(
      { chatId: req.user.chatId },
      { $set: updates },
      {
        new: true,
        runValidators: true,
      },
    ).select("firstName chatId username profilePic bio");

    if (!updated) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi!" });
    }

    return res.json(updated);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Profilni yangilashda xatolik" });
  }
});

userRouter.get("/profile/:username", optionalVerifyToken, async (req, res) => {
  try {
    const username = String(req.params.username || "")
      .trim()
      .toLowerCase();

    if (!username) {
      return res.status(400).json({ message: "username talab qilinadi." });
    }

    const user = await User.findOne({ username }).select(
      "firstName chatId username profilePic bio followerChatIds followingChatIds",
    );
    if (!user) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi!" });
    }

    const follow = getFollowSummary(
      user,
      Number.isInteger(req.user?.chatId) ? req.user.chatId : null,
    );

    return res.json({
      ...user.toObject(),
      ...follow,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Serverda xatolik yuz berdi!" });
  }
});

userRouter.post("/profile/:username/follow", verifyToken, async (req, res) => {
  try {
    const username = String(req.params.username || "")
      .trim()
      .toLowerCase();

    if (!username) {
      return res.status(400).json({ message: "username talab qilinadi." });
    }

    const me = await User.findOne({ chatId: req.user.chatId }).select(
      "chatId username followingChatIds",
    );
    if (!me) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi!" });
    }

    const target = await User.findOne({ username }).select(
      "chatId username followerChatIds followingChatIds",
    );
    if (!target) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi!" });
    }

    if (target.chatId === me.chatId) {
      return res.status(400).json({ message: "O'zingizni kuzata olmaysiz." });
    }

    await User.updateOne(
      { chatId: me.chatId },
      { $addToSet: { followingChatIds: target.chatId } },
    );
    const updatedTarget = await User.findOneAndUpdate(
      { chatId: target.chatId },
      { $addToSet: { followerChatIds: me.chatId } },
      { new: true },
    ).select("followerChatIds followingChatIds");

    return res.json({
      following: true,
      followersCount: Array.isArray(updatedTarget?.followerChatIds)
        ? updatedTarget.followerChatIds.length
        : 0,
      followingCount: Array.isArray(updatedTarget?.followingChatIds)
        ? updatedTarget.followingChatIds.length
        : 0,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Kuzatishda xatolik yuz berdi!" });
  }
});

userRouter.delete("/profile/:username/follow", verifyToken, async (req, res) => {
  try {
    const username = String(req.params.username || "")
      .trim()
      .toLowerCase();

    if (!username) {
      return res.status(400).json({ message: "username talab qilinadi." });
    }

    const me = await User.findOne({ chatId: req.user.chatId }).select(
      "chatId username followingChatIds",
    );
    if (!me) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi!" });
    }

    const target = await User.findOne({ username }).select(
      "chatId username followerChatIds followingChatIds",
    );
    if (!target) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi!" });
    }

    if (target.chatId === me.chatId) {
      return res.status(400).json({ message: "O'zingizni kuzata olmaysiz." });
    }

    await User.updateOne(
      { chatId: me.chatId },
      { $pull: { followingChatIds: target.chatId } },
    );
    const updatedTarget = await User.findOneAndUpdate(
      { chatId: target.chatId },
      { $pull: { followerChatIds: me.chatId } },
      { new: true },
    ).select("followerChatIds followingChatIds");

    return res.json({
      following: false,
      followersCount: Array.isArray(updatedTarget?.followerChatIds)
        ? updatedTarget.followerChatIds.length
        : 0,
      followingCount: Array.isArray(updatedTarget?.followingChatIds)
        ? updatedTarget.followingChatIds.length
        : 0,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Kuzatishni bekor qilishda xatolik!" });
  }
});

userRouter.get("/profile/:username/posts", async (req, res) => {
  try {
    const username = String(req.params.username || "")
      .trim()
      .toLowerCase();

    if (!username) {
      return res.status(400).json({ message: "username talab qilinadi." });
    }

    const user = await User.findOne({ username }).select(
      "chatId profilePic username firstName",
    );
    if (!user) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi!" });
    }

    const posts = await Post.find({ authorChatId: user.chatId })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const prepared = posts.map((post) => ({
      ...post,
      userName: user.username || user.firstName || post.userName,
      profilePic: user.profilePic || post.profilePic || "",
      likes: Array.isArray(post.likedByChatIds)
        ? post.likedByChatIds.length
        : post.likes || 0,
      views: Array.isArray(post.viewedByChatIds)
        ? post.viewedByChatIds.length
        : post.views || 0,
      likedByChatIds: undefined,
      viewedByChatIds: undefined,
    }));

    return res.json(prepared);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Postlarni olishda xatolik" });
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
      "firstName chatId username profilePic bio",
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
