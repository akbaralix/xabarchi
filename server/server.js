import express from "express";
import dotenv from "dotenv";
import connectDB from "./db.js";
import bot from "./tgbotlogin/bot.js";

dotenv.config();
connectDB();
const app = express();
bot;

app.listen(5000, () => {
  console.log("Server 5000 portda ishga tushdi");
});
