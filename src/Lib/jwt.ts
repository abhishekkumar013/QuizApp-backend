import jwt from "jsonwebtoken";

const JWT_SECRET = Bun.env.JWT_SECRET || "default_secret";

export const generateToken = (payload: object, expiresIn = "7d"): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};
