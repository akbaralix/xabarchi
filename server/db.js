import mongoose from "mongoose";

const connectDB = async () => {
  const databaseUrl = process.env.DATABASEURL;
  if (!databaseUrl) {
    throw new Error("DATABASEURL topilmadi!");
  }

  await mongoose.connect(databaseUrl);
  console.log("MongoDB ga ulandi");
  return true;
};

export default connectDB;
