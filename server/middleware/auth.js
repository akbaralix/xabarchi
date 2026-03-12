import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const verifyToken = (req, res, next) => {
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: "JWT_SECRET sozlanmagan!" });
  }

  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Token talab qilinadi!" });
  }

  return jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(403).json({ message: "Token yaroqsiz!" });

    try {
      const user = await User.findOneAndUpdate(
        { chatId: decoded.chatId },
        { $set: { lastActiveAt: new Date() } },
        { new: false },
      ).select("isBlocked");

      if (!user) {
        return res.status(401).json({ message: "Foydalanuvchi topilmadi!" });
      }
      if (user.isBlocked) {
        return res.status(403).json({ message: "Hisob bloklangan." });
      }

      req.user = decoded;
      return next();
    } catch (error) {
      console.log("Auth xatoligi:", error);
      return res.status(500).json({ message: "Auth xatoligi." });
    }
  });
};

export const optionalVerifyToken = (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");
  if (!token || scheme !== "Bearer" || !process.env.JWT_SECRET) {
    req.user = null;
    return next();
  }

  return jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      req.user = null;
      return next();
    }

    try {
      const user = await User.findOneAndUpdate(
        { chatId: decoded.chatId },
        { $set: { lastActiveAt: new Date() } },
        { new: false },
      ).select("isBlocked");

      if (!user || user.isBlocked) {
        req.user = null;
        return next();
      }

      req.user = decoded;
      return next();
    } catch (error) {
      console.log("Auth xatoligi:", error);
      req.user = null;
      return next();
    }
  });
};
