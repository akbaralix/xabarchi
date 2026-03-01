import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  username: { type: String },
  password: { type: String },
  chatId: { type: Number, required: true, unique: true, index: true },
  jwtToken: { type: String },
});

const User = mongoose.model("User", userSchema);

export default User;
