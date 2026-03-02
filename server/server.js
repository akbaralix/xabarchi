import express from "express";
import dotenv from "dotenv";
import connectDB from "./db.js";
import startBot from "./tgbotlogin/bot.js";
import cors from "cors";
import router from "./routes/autoh.js";
import userRouter from "./routes/user.js";
import postRouter from "./routes/post.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(router);
app.use(userRouter);
app.use(postRouter);

const startServer = async () => {
  await connectDB();
  if (process.env.TELEGRAM_TOKEN) {
    startBot();
  } else {
    console.log("TELEGRAM_TOKEN topilmadi, bot ishga tushirilmadi");
  }

  app.listen(PORT, () => {
    console.log(`Server ${PORT} portda ishga tushdi`);
  });
};

startServer().catch((error) => {
  console.error("Server ishga tushmadi:", error);
  process.exit(1);
});
