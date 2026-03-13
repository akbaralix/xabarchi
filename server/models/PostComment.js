import mongoose from "mongoose";

const postCommentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    authorChatId: { type: Number, required: true, index: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

postCommentSchema.index({ postId: 1, createdAt: -1 });

const PostComment = mongoose.model("PostComment", postCommentSchema);

export default PostComment;
