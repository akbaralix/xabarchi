/* global process */
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASEURL);
    console.log("MongoDB ga ulandi");
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

export default connectDB;


