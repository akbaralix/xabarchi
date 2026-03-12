import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    postAuthorChatId: { type: Number, default: null },
    postSnapshot: { type: Object, default: {} },
    reporterChatId: { type: Number, required: true, index: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: ["open", "resolved"], default: "open" },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Number, default: null },
    action: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

reportSchema.index({ postId: 1, reporterChatId: 1, status: 1 });

const Report = mongoose.model("Report", reportSchema);

export default Report;
