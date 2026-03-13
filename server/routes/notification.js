import express from "express";
import Notification from "../models/Notification.js";
import { verifyToken } from "../middleware/auth.js";

const notificationRouter = express.Router();

notificationRouter.get("/notifications", verifyToken, async (req, res) => {
  try {
    const items = await Notification.find({ toChatId: req.user.chatId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return res.json(items);
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ message: "Bildirishnomalarni olishda xatolik" });
  }
});

notificationRouter.patch("/notifications/read", verifyToken, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const readAll = Boolean(req.body?.all);
    const filter = readAll
      ? { toChatId: req.user.chatId, isRead: false }
      : {
          toChatId: req.user.chatId,
          _id: { $in: ids },
        };

    if (!readAll && ids.length === 0) {
      return res.status(400).json({ message: "ids yuborilmadi" });
    }

    await Notification.updateMany(filter, { $set: { isRead: true } });
    return res.json({ ok: true });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "O'qilganini saqlashda xatolik" });
  }
});

export default notificationRouter;
