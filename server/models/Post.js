import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 5000 },
    imageUrl: { type: String, required: true, trim: true },
    imageUrls: {
      type: [String],
      default: [],
      validate: {
        validator: (value) => !Array.isArray(value) || value.length <= 10,
        message: "Bir postda maksimal 10 ta rasm bo'lishi mumkin",
      },
    },
    userName: { type: String, required: true, trim: true, maxlength: 120 },
    authorChatId: { type: Number, required: true, index: true },
    profilePic: { type: String, trim: true, default: "" },
    likes: { type: Number, default: 0, min: 0 },
    likedByChatIds: { type: [Number], default: [] },
    views: { type: Number, default: 0, min: 0 },
    viewedByChatIds: { type: [Number], default: [] },
  },
  { timestamps: true },
);

postSchema.index({ createdAt: -1 });

const Post = mongoose.model("Post", postSchema);

export default Post;
