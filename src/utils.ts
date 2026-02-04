import { randomBytes } from "crypto";

export function generateId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export function now(): string {
  return new Date().toISOString();
}
