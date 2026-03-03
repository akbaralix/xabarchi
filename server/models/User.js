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
    profilePic: { type: String, trim: true, default: "" },
    bio: { type: String, trim: true, maxlength: 300, default: "" },
    passwordHash: { type: String },
    passwordSalt: { type: String },
    chatId: { type: Number, required: true, unique: true, index: true },
    jwtToken: { type: String },
  },
  { timestamps: true },
);

userSchema.index({ username: 1 }, { unique: true, sparse: true });

const User = mongoose.model("User", userSchema);

export default User;
