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
  e2ePublicKey: user.e2ePublicKey || "",
});

const mapMessage = (message, sender) => ({
  _id: message._id,
  conversationId: message.conversationId,
  text: message.text,
  ciphertext: message.ciphertext || "",
  nonce: message.nonce || "",
  e2e: Boolean(message.e2e),
  senderPublicKey: message.senderPublicKey || sender?.e2ePublicKey || "",
  recipientPublicKey: message.recipientPublicKey || "",
  senderChatId: message.senderChatId,
  readByChatIds: Array.isArray(message.readByChatIds)
    ? message.readByChatIds
    : [],
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
      "chatId username firstName profilePic e2ePublicKey",
    );
    if (!me) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
    }

    const target = await User.findOne({ username }).select(
      "chatId username firstName profilePic e2ePublicKey",
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
      .select("chatId username firstName profilePic e2ePublicKey")
      .lean();

    const userMap = new Map(users.map((user) => [user.chatId, user]));
    const conversationIds = conversations.map((conversation) => conversation._id);

    const unreadRows = await Message.aggregate([
      {
        $match: {
          conversationId: { $in: conversationIds },
          senderChatId: { $ne: meChatId },
          readByChatIds: { $ne: meChatId },
        },
      },
      {
        $group: {
          _id: "$conversationId",
          count: { $sum: 1 },
        },
      },
    ]);

    const unreadMap = new Map(
      unreadRows.map((row) => [String(row._id), Number(row.count || 0)]),
    );

    const result = conversations.map((conversation) => {
        const otherChatId = (conversation.participants || []).find(
          (id) => id !== meChatId,
        );
        const otherUser = userMap.get(otherChatId);

        return {
          _id: conversation._id,
          participants: conversation.participants,
          lastMessage: conversation.lastMessage || "",
          lastMessageAt: conversation.lastMessageAt,
          unreadCount: unreadMap.get(String(conversation._id)) || 0,
          otherUser: otherUser ? mapUser(otherUser) : null,
        };
      });

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
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const senderChatIds = [...new Set(messages.map((item) => item.senderChatId))];
    const users = await User.find({ chatId: { $in: senderChatIds } })
      .select("chatId username firstName profilePic e2ePublicKey")
      .lean();
    const userMap = new Map(users.map((user) => [user.chatId, user]));

    Message.updateMany(
      {
        conversationId: conversation._id,
        senderChatId: { $ne: req.user.chatId },
        readByChatIds: { $ne: req.user.chatId },
      },
      { $addToSet: { readByChatIds: req.user.chatId } },
    )
      .then((result) => {
        if ((result.modifiedCount || 0) <= 0) return;
        const io = req.app.get("io");
        io.to(`conversation:${conversation._id}`).emit("chat:messages-read", {
          conversationId: String(conversation._id),
          readerChatId: req.user.chatId,
          readAll: true,
        });
      })
      .catch((error) => {
        console.log("Read status update xatoligi:", error);
      });

    const ordered = messages.reverse();
    return res.json(
      ordered.map((item) => {
        const sender = userMap.get(item.senderChatId);
        const recipientChatId = (conversation.participants || []).find(
          (chatId) => Number(chatId) !== Number(item.senderChatId),
        );
        const recipient = userMap.get(recipientChatId);
        return {
          ...mapMessage(item, sender),
          recipientPublicKey:
            item.recipientPublicKey || recipient?.e2ePublicKey || "",
        };
      }),
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
    const ciphertext = String(req.body?.ciphertext || "").trim();
    const nonce = String(req.body?.nonce || "").trim();
    const e2e = Boolean(req.body?.e2e);
    const clientMessageId = String(req.body?.clientMessageId || "").trim();
    const isEncrypted = e2e || (ciphertext && nonce);
    if (!text && !isEncrypted) {
      return res.status(400).json({ message: "Xabar matni bo'sh" });
    }

    if (isEncrypted && (!ciphertext || !nonce)) {
      return res.status(400).json({ message: "Shifrlangan xabar noto'g'ri" });
    }

    const conversation = await getConversationForUser(conversationId, req.user.chatId);
    if (!conversation) {
      return res.status(404).json({ message: "Chat topilmadi" });
    }

    let senderPublicKey = "";
    let recipientPublicKey = "";
    if (isEncrypted) {
      const participantIds = Array.isArray(conversation.participants)
        ? conversation.participants
        : [];
      const recipientChatId = participantIds.find(
        (chatId) => Number(chatId) !== Number(req.user.chatId),
      );
      const participants = await User.find({
        chatId: { $in: [req.user.chatId, recipientChatId].filter(Boolean) },
      })
        .select("chatId e2ePublicKey")
        .lean();
      const participantMap = new Map(
        participants.map((item) => [Number(item.chatId), item]),
      );
      senderPublicKey =
        participantMap.get(Number(req.user.chatId))?.e2ePublicKey || "";
      recipientPublicKey =
        participantMap.get(Number(recipientChatId))?.e2ePublicKey || "";
    }

    const created = await Message.create({
      conversationId: conversation._id,
      senderChatId: req.user.chatId,
      // Telegram-style cloud sync: always keep the readable message body
      // so the same account can open chats on another device as well.
      text,
      ciphertext: isEncrypted ? ciphertext : "",
      nonce: isEncrypted ? nonce : "",
      e2e: isEncrypted,
      senderPublicKey: isEncrypted ? senderPublicKey : "",
      recipientPublicKey: isEncrypted ? recipientPublicKey : "",
      readByChatIds: [req.user.chatId],
    });

    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessage: text || (isEncrypted ? "Shifrlangan xabar" : ""),
          lastMessageAt: created.createdAt,
        },
      },
    );

    const payload = {
      ...mapMessage(created.toObject(), null),
      clientMessageId: clientMessageId || undefined,
    };

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

chatRouter.delete(
  "/chats/:conversationId/messages/:messageId",
  verifyToken,
  async (req, res) => {
    try {
      const { conversationId, messageId } = req.params;
      const conversation = await getConversationForUser(
        conversationId,
        req.user.chatId,
      );
      if (!conversation) {
        return res.status(404).json({ message: "Chat topilmadi" });
      }

      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return res.status(400).json({ message: "messageId noto'g'ri" });
      }

      const message = await Message.findOne({
        _id: messageId,
        conversationId: conversation._id,
      });
      if (!message) {
        return res.status(404).json({ message: "Xabar topilmadi" });
      }

      if (message.senderChatId !== req.user.chatId) {
        return res
          .status(403)
          .json({ message: "Faqat o'zingiz yuborgan xabarni o'chira olasiz" });
      }

      await Message.deleteOne({ _id: message._id });

      const latest = await Message.findOne({ conversationId: conversation._id })
        .sort({ createdAt: -1 })
        .select("text createdAt e2e")
        .lean();

      const lastMessage = latest?.text || (latest?.e2e ? "Shifrlangan xabar" : "");
      const lastMessageAt = latest?.createdAt || conversation.createdAt;

      await Conversation.updateOne(
        { _id: conversation._id },
        { $set: { lastMessage, lastMessageAt } },
      );

      const io = req.app.get("io");
      io.to(`conversation:${conversation._id}`).emit("chat:message-deleted", {
        conversationId: String(conversation._id),
        messageId: String(message._id),
        lastMessage,
        lastMessageAt,
      });

      conversation.participants.forEach((chatId) => {
        io.to(`user:${chatId}`).emit("chat:conversation-updated", {
          conversationId: String(conversation._id),
        });
      });

      return res.json({
        ok: true,
        conversationId: String(conversation._id),
        messageId: String(message._id),
        lastMessage,
        lastMessageAt,
      });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ message: "Xabarni o'chirishda xatolik" });
    }
  },
);

chatRouter.delete("/chats/:conversationId", verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await getConversationForUser(conversationId, req.user.chatId);
    if (!conversation) {
      return res.status(404).json({ message: "Chat topilmadi" });
    }

    await Message.deleteMany({ conversationId: conversation._id });
    await Conversation.deleteOne({ _id: conversation._id });

    const io = req.app.get("io");
    io.to(`conversation:${conversation._id}`).emit("chat:conversation-deleted", {
      conversationId: String(conversation._id),
    });

    conversation.participants.forEach((chatId) => {
      io.to(`user:${chatId}`).emit("chat:conversation-updated", {
        conversationId: String(conversation._id),
      });
    });

    return res.json({ ok: true, conversationId: String(conversation._id) });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Chatni o'chirishda xatolik" });
  }
});

export default chatRouter;
