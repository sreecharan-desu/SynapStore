import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "replace_me_in_prod";
const JWT_EXP = "7d";

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function signJwt(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXP });
}

export function verifyJwt(token: string) {
  return jwt.verify(token, JWT_SECRET);
}
