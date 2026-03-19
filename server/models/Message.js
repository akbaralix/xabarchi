import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderChatId: { type: Number, required: true, index: true },
    text: { type: String, trim: true, maxlength: 5000, default: "" },
    ciphertext: { type: String, trim: true, default: "" },
    nonce: { type: String, trim: true, default: "" },
    e2e: { type: Boolean, default: false },
    senderPublicKey: { type: String, trim: true, default: "" },
    recipientPublicKey: { type: String, trim: true, default: "" },
    readByChatIds: { type: [Number], default: [] },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
