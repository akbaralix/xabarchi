import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    toChatId: { type: Number, required: true, index: true },
    fromChatId: { type: Number, required: true },
    type: { type: String, required: true, enum: ["like", "comment"] },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: "PostComment" },
    text: { type: String, trim: true, default: "" },
    fromUsername: { type: String, trim: true, default: "" },
    fromProfilePic: { type: String, trim: true, default: "" },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ toChatId: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
