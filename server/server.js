import express from "express";
import dotenv from "dotenv";
import connectDB from "./db.js";
import startBot from "./tgbotlogin/bot.js";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import router from "./routes/autoh.js";
import userRouter from "./routes/user.js";
import postRouter from "./routes/post.js";
import chatRouter from "./routes/chat.js";
import Conversation from "./models/Conversation.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

app.use(cors());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
    socket.user = decoded;
    return next();
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
});

app.set("io", io);

app.use(router);
app.use(userRouter);
app.use(postRouter);
app.use(chatRouter);

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
