import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
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
