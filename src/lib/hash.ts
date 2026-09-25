import crypto from "node:crypto";

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(pw, salt, 32).toString("hex");
  return `${salt}:${h}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, h] = (stored || "").split(":");
  if (!salt || !h) return false;
  const c = crypto.scryptSync(pw, salt, 32);
  const expected = Buffer.from(h, "hex");
  return c.length === expected.length && crypto.timingSafeEqual(c, expected);
}

export function randomToken(bytes = 18): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
