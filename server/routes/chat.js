import express from "express";
import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { verifyToken } from "../middleware/auth.js";

const chatRouter = express.Router();

const mapUser = (user) => ({
  chatId: user.chatId,
  username: user.username || null,
  firstName: user.firstName,
  profilePic: user.profilePic || "",
});

const mapMessage = (message, sender) => ({
  _id: message._id,
  conversationId: message.conversationId,
  text: message.text,
  senderChatId: message.senderChatId,
  sender: sender ? mapUser(sender) : null,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

const getConversationForUser = async (conversationId, chatId) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) return null;
  return Conversation.findOne({
    _id: conversationId,
    participants: chatId,
  });
};

chatRouter.post("/chats/start", verifyToken, async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim().toLowerCase();
    if (!username) {
      return res.status(400).json({ message: "username talab qilinadi" });
    }

    const me = await User.findOne({ chatId: req.user.chatId }).select(
      "chatId username firstName profilePic",
    );
    if (!me) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
    }

    const target = await User.findOne({ username }).select(
      "chatId username firstName profilePic",
    );
    if (!target) {
      return res.status(404).json({ message: "Bu username topilmadi" });
    }

    if (target.chatId === me.chatId) {
      return res.status(400).json({ message: "O'zingiz bilan chat ocholmaysiz" });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [me.chatId, target.chatId] },
      $expr: { $eq: [{ $size: "$participants" }, 2] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [me.chatId, target.chatId],
      });
    }

    return res.status(201).json({
      _id: conversation._id,
      participants: conversation.participants,
      lastMessage: conversation.lastMessage || "",
      lastMessageAt: conversation.lastMessageAt,
      otherUser: mapUser(target),
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Chat ochishda xatolik" });
  }
});

chatRouter.get("/chats", verifyToken, async (req, res) => {
  try {
    const meChatId = req.user.chatId;
    const conversations = await Conversation.find({ participants: meChatId })
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .lean();

    const otherChatIds = [
      ...new Set(
        conversations
          .map((conversation) =>
            (conversation.participants || []).find((id) => id !== meChatId),
          )
          .filter(Boolean),
      ),
    ];

    const users = await User.find({ chatId: { $in: otherChatIds } })
      .select("chatId username firstName profilePic")
      .lean();

    const userMap = new Map(users.map((user) => [user.chatId, user]));

    const result = await Promise.all(
      conversations.map(async (conversation) => {
        const otherChatId = (conversation.participants || []).find(
          (id) => id !== meChatId,
        );
        const otherUser = userMap.get(otherChatId);

        const unreadCount = await Message.countDocuments({
          conversationId: conversation._id,
          senderChatId: { $ne: meChatId },
          readByChatIds: { $ne: meChatId },
        });

        return {
          _id: conversation._id,
          participants: conversation.participants,
          lastMessage: conversation.lastMessage || "",
          lastMessageAt: conversation.lastMessageAt,
          unreadCount,
          otherUser: otherUser ? mapUser(otherUser) : null,
        };
      }),
    );

    return res.json(result);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Chat ro'yxatini olishda xatolik" });
  }
});

chatRouter.get("/chats/:conversationId/messages", verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

    const conversation = await getConversationForUser(conversationId, req.user.chatId);
    if (!conversation) {
      return res.status(404).json({ message: "Chat topilmadi" });
    }

    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    const senderChatIds = [...new Set(messages.map((item) => item.senderChatId))];
    const users = await User.find({ chatId: { $in: senderChatIds } })
      .select("chatId username firstName profilePic")
      .lean();
    const userMap = new Map(users.map((user) => [user.chatId, user]));

    await Message.updateMany(
      {
        conversationId: conversation._id,
        senderChatId: { $ne: req.user.chatId },
        readByChatIds: { $ne: req.user.chatId },
      },
      { $addToSet: { readByChatIds: req.user.chatId } },
    );

    return res.json(
      messages.map((item) => mapMessage(item, userMap.get(item.senderChatId))),
    );
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Xabarlarni olishda xatolik" });
  }
});

chatRouter.post("/chats/:conversationId/messages", verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const text = String(req.body?.text || "").trim();
    if (!text) {
      return res.status(400).json({ message: "Xabar matni bo'sh" });
    }

    const conversation = await getConversationForUser(conversationId, req.user.chatId);
    if (!conversation) {
      return res.status(404).json({ message: "Chat topilmadi" });
    }

    const created = await Message.create({
      conversationId: conversation._id,
      senderChatId: req.user.chatId,
      text,
      readByChatIds: [req.user.chatId],
    });

    conversation.lastMessage = text;
    conversation.lastMessageAt = created.createdAt;
    await conversation.save();

    const sender = await User.findOne({ chatId: req.user.chatId }).select(
      "chatId username firstName profilePic",
    );

    const payload = mapMessage(created.toObject(), sender);

    const io = req.app.get("io");
    io.to(`conversation:${conversation._id}`).emit("chat:new-message", payload);

    conversation.participants
      .filter((chatId) => chatId !== req.user.chatId)
      .forEach((chatId) => {
        io.to(`user:${chatId}`).emit("chat:conversation-updated", {
          conversationId: String(conversation._id),
        });
      });

    return res.status(201).json(payload);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Xabar yuborishda xatolik" });
  }
});

export default chatRouter;
