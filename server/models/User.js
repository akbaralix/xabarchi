import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      minlength: 4,
      maxlength: 24,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    profilePic: { type: String, trim: true, default: "" },
    bio: { type: String, trim: true, maxlength: 300, default: "" },
    followerChatIds: { type: [Number], default: [] },
    followingChatIds: { type: [Number], default: [] },
    passwordHash: { type: String },
    passwordSalt: { type: String },
    googleId: { type: String, unique: true, sparse: true, trim: true },
    chatId: { type: Number, required: true, unique: true, index: true },
    jwtToken: { type: String },
    isBlocked: { type: Boolean, default: false },
    blockedReason: { type: String, trim: true, default: "" },
    blockedAt: { type: Date, default: null },
    blockedBy: { type: Number, default: null },
    lastActiveAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ username: 1 }, { unique: true, sparse: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

const User = mongoose.model("User", userSchema);

export default User;
