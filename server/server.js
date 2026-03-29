import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import connectDB from "./db.js";
import startBot from "./tgbotlogin/bot.js";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import router from "./routes/autoh.js";
import userRouter from "./routes/user.js";
import postRouter from "./routes/post.js";
import chatRouter from "./routes/chat.js";
import reportRouter from "./routes/report.js";
import adminRouter from "./routes/admin.js";
import notificationRouter from "./routes/notification.js";
import Conversation from "./models/Conversation.js";
import Message from "./models/Message.js";
import User from "./models/User.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://ywnfotaahcdwxnkzylbd.supabase.co";

app.use(cors());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const streamSupabaseMedia = async (bucket, path, res) => {
  if (!bucket || !path) {
    return res.status(400).json({ message: "bucket va path talab qilinadi." });
  }

  if (!/^[a-z0-9_-]+$/i.test(bucket)) {
    return res.status(400).json({ message: "bucket noto'g'ri formatda." });
  }

  if (path.includes("..")) {
    return res.status(400).json({ message: "path noto'g'ri." });
  }

  const encodedPath = path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

  const sourceUrl = `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;

  try {
    const upstream = await fetch(sourceUrl);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ message: "Rasm topilmadi." });
    }

    const contentType = upstream.headers.get("content-type");
    const cacheControl = upstream.headers.get("cache-control");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }
    if (cacheControl) {
      res.setHeader("Cache-Control", cacheControl);
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    return res.send(buffer);
  } catch (error) {
    console.error("Media proxy xatoligi:", error);
    return res.status(502).json({ message: "Rasmni yuklashda xatolik." });
  }
};

app.get("/media/:bucket", async (req, res) => {
  const bucket = String(req.params.bucket || "").trim();
  const path = String(req.query.path || "").trim();
  return streamSupabaseMedia(bucket, path, res);
});

app.get("/m/:token", async (req, res) => {
  const token = String(req.params.token || "").trim();
  if (!token) {
    return res.status(400).json({ message: "token talab qilinadi." });
  }

  try {
    const normalized = token.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const slashIndex = decoded.indexOf("/");
    if (slashIndex <= 0) {
      return res.status(400).json({ message: "token noto'g'ri." });
    }

    const bucket = decoded.slice(0, slashIndex);
    const path = decoded.slice(slashIndex + 1);
    return streamSupabaseMedia(bucket, path, res);
  } catch {
    return res.status(400).json({ message: "token noto'g'ri." });
  }
});

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const activeCalls = new Map();

const getConversationForChat = async (conversationId, chatId) => {
  if (!conversationId || !chatId) return null;
  return Conversation.findOne({
    _id: conversationId,
    participants: chatId,
  })
    .select("_id participants")
    .lean();
};

const getPeerChatId = (participants, chatId) =>
  (Array.isArray(participants) ? participants : []).find(
    (item) => Number(item) !== Number(chatId),
  );

const mapCallUser = (user) => ({
  chatId: Number(user?.chatId || 0),
  username: user?.username || "",
  firstName: user?.firstName || "",
  profilePic: user?.profilePic || "",
});

const findActiveCallForChat = (chatId) => {
  for (const call of activeCalls.values()) {
    if (
      call.status !== "ended" &&
      Array.isArray(call.participants) &&
      call.participants.some((item) => Number(item) === Number(chatId))
    ) {
      return call;
    }
  }
  return null;
};

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token || !process.env.JWT_SECRET) {
    return next(new Error("Unauthorized"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    User.findOneAndUpdate(
      { chatId: decoded.chatId },
      { $set: { lastActiveAt: new Date() } },
      { new: false },
    )
      .select("isBlocked")
      .then((user) => {
        if (!user || user.isBlocked) {
          return next(new Error("Unauthorized"));
        }
        socket.user = decoded;
        return next();
      })
      .catch(() => next(new Error("Unauthorized")));
  } catch {
    return next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  const chatId = socket.user?.chatId;
  if (chatId) {
    socket.join(`user:${chatId}`);
  }

  socket.on("chat:join", async ({ conversationId }) => {
    if (!conversationId || !chatId) return;
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: chatId,
    })
      .select("_id")
      .lean();

    if (!conversation) return;
    socket.join(`conversation:${conversationId}`);
  });

  socket.on("chat:leave", ({ conversationId }) => {
    if (!conversationId) return;
    socket.leave(`conversation:${conversationId}`);
  });

  socket.on("chat:typing", ({ conversationId }) => {
    if (!conversationId || !chatId) return;
    const room = `conversation:${conversationId}`;
    if (!socket.rooms.has(room)) return;
    socket.to(room).emit("chat:typing", {
      conversationId: String(conversationId),
      chatId,
    });
  });

  socket.on("chat:stop-typing", ({ conversationId }) => {
    if (!conversationId || !chatId) return;
    const room = `conversation:${conversationId}`;
    if (!socket.rooms.has(room)) return;
    socket.to(room).emit("chat:stop-typing", {
      conversationId: String(conversationId),
      chatId,
    });
  });

  socket.on("chat:read", async ({ conversationId, messageId }) => {
    if (!conversationId || !messageId || !chatId) return;
    const room = `conversation:${conversationId}`;
    if (!socket.rooms.has(room)) return;
    if (!mongoose.Types.ObjectId.isValid(messageId)) return;

    try {
      const result = await Message.updateOne(
        {
          _id: messageId,
          conversationId,
          senderChatId: { $ne: chatId },
          readByChatIds: { $ne: chatId },
        },
        { $addToSet: { readByChatIds: chatId } },
      );

      if ((result.modifiedCount || 0) > 0) {
        io.to(room).emit("chat:messages-read", {
          conversationId: String(conversationId),
          messageIds: [String(messageId)],
          readerChatId: chatId,
        });
      }
    } catch (err) {
      console.log("chat:read xatoligi:", err);
    }
  });

  socket.on("call:start", async ({ conversationId, mode }) => {
    if (!chatId || !conversationId) return;

    try {
      const conversation = await getConversationForChat(conversationId, chatId);
      if (!conversation) {
        socket.emit("call:error", { message: "Chat topilmadi" });
        return;
      }

      const peerChatId = getPeerChatId(conversation.participants, chatId);
      if (!peerChatId) {
        socket.emit("call:error", { message: "Qo'ng'iroq uchun foydalanuvchi topilmadi" });
        return;
      }

      const busyCall =
        findActiveCallForChat(chatId) || findActiveCallForChat(peerChatId);
      if (busyCall) {
        socket.emit("call:declined", {
          callId: busyCall.callId,
          reason: "busy",
        });
        return;
      }

      const caller = await User.findOne({ chatId })
        .select("chatId username firstName profilePic")
        .lean();

      const callId = randomUUID();
      const payload = {
        callId,
        conversationId: String(conversation._id),
        mode: mode === "video" ? "video" : "audio",
        fromChatId: Number(chatId),
        fromUser: mapCallUser(caller),
      };

      activeCalls.set(callId, {
        ...payload,
        participants: conversation.participants,
        status: "ringing",
      });

      socket.emit("call:ringing", payload);
      io.to(`user:${peerChatId}`).emit("call:incoming", payload);
    } catch (error) {
      console.log("call:start xatoligi:", error);
      socket.emit("call:error", { message: "Qo'ng'iroqni boshlashda xatolik" });
    }
  });

  socket.on("call:accept", ({ callId }) => {
    if (!chatId || !callId) return;
    const call = activeCalls.get(callId);
    if (!call) return;
    if (!call.participants?.some((item) => Number(item) === Number(chatId))) return;

    call.status = "accepted";
    activeCalls.set(callId, call);

    call.participants.forEach((participantId) => {
      io.to(`user:${participantId}`).emit("call:accepted", {
        callId,
        conversationId: call.conversationId,
        mode: call.mode,
        byChatId: Number(chatId),
      });
    });
  });

  socket.on("call:decline", ({ callId, reason }) => {
    if (!chatId || !callId) return;
    const call = activeCalls.get(callId);
    if (!call) return;
    if (!call.participants?.some((item) => Number(item) === Number(chatId))) return;

    call.participants.forEach((participantId) => {
      io.to(`user:${participantId}`).emit("call:declined", {
        callId,
        conversationId: call.conversationId,
        reason: reason || "declined",
        byChatId: Number(chatId),
      });
    });

    activeCalls.delete(callId);
  });

  socket.on("call:end", ({ callId, reason }) => {
    if (!chatId || !callId) return;
    const call = activeCalls.get(callId);
    if (!call) return;
    if (!call.participants?.some((item) => Number(item) === Number(chatId))) return;

    call.participants.forEach((participantId) => {
      io.to(`user:${participantId}`).emit("call:ended", {
        callId,
        conversationId: call.conversationId,
        reason: reason || "ended",
        byChatId: Number(chatId),
      });
    });

    activeCalls.delete(callId);
  });

  socket.on("call:signal", ({ callId, description, candidate }) => {
    if (!chatId || !callId) return;
    const call = activeCalls.get(callId);
    if (!call) return;
    if (!call.participants?.some((item) => Number(item) === Number(chatId))) return;

    call.participants
      .filter((participantId) => Number(participantId) !== Number(chatId))
      .forEach((participantId) => {
        io.to(`user:${participantId}`).emit("call:signal", {
          callId,
          fromChatId: Number(chatId),
          description: description || null,
          candidate: candidate || null,
        });
      });
  });

  socket.on("disconnect", () => {
    if (!chatId) return;
    const call = findActiveCallForChat(chatId);
    if (!call) return;

    call.participants.forEach((participantId) => {
      io.to(`user:${participantId}`).emit("call:ended", {
        callId: call.callId,
        conversationId: call.conversationId,
        reason: "disconnected",
        byChatId: Number(chatId),
      });
    });

    activeCalls.delete(call.callId);
  });
});

app.set("io", io);

app.use(router);
app.use(userRouter);
app.use(postRouter);
app.use(chatRouter);
app.use(reportRouter);
app.use(adminRouter);
app.use(notificationRouter);

app.use(express.static(path.join(__dirname, "..", "dist")));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "index.html"));
});

const startServer = async () => {
  await connectDB();
  if (process.env.TELEGRAM_TOKEN) {
    startBot();
  } else {
    console.log("TELEGRAM_TOKEN topilmadi, bot ishga tushirilmadi");
  }

  server.listen(PORT, () => {
    console.log(`Server ${PORT} portda ishga tushdi`);
  });
};

startServer().catch((error) => {
  console.error("Server ishga tushmadi:", error);
  process.exit(1);
});
