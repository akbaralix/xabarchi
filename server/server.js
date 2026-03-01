import express from "express";
import dotenv from "dotenv";
import connectDB from "./db.js";
import startBot from "./tgbotlogin/bot.js";
import cors from "cors";
import router from "./routes/autoh.js";
import userRouter from "./routes/user.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use(router);
app.use(userRouter);

const startServer = async () => {
  await connectDB();
  startBot();

  app.listen(PORT, () => {
    console.log(`Server ${PORT} portda ishga tushdi`);
  });
};

startServer().catch((error) => {
  console.error("Server ishga tushmadi:", error);
  process.exit(1);
});
