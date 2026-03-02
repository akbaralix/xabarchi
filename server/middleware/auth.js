import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: "JWT_SECRET sozlanmagan!" });
  }

  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Token talab qilinadi!" });
  }

  return jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Token yaroqsiz!" });

    req.user = decoded;
    return next();
  });
};

export const optionalVerifyToken = (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");
  if (!token || scheme !== "Bearer" || !process.env.JWT_SECRET) {
    req.user = null;
    return next();
  }

  return jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    req.user = err ? null : decoded;
    return next();
  });
};
