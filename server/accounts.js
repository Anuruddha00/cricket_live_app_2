import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DIR = path.dirname(fileURLToPath(import.meta.url));

export function accountsFile() {
  return process.env.USERS_FILE || path.join(DIR, "users.json");
}

export function readAccounts() {
  const file = accountsFile();
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
}

export function writeAccounts(accounts) {
  const file = accountsFile();
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const temp = file + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(accounts, null, 2), { mode: 0o600 });
  fs.renameSync(temp, file);
}

export function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

export function makeAccount(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return {
    salt,
    passwordHash: crypto.scryptSync(password, salt, 64).toString("hex"),
    tenantId: crypto.randomUUID(),
    sessionVersion: crypto.randomUUID()
  };
}

export function verifyPassword(password, account) {
  if (!account || !/^[a-f0-9]{32}$/.test(account.salt || "") || !/^[a-f0-9]{128}$/.test(account.passwordHash || "")) return false;
  const actual = crypto.scryptSync(password, account.salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(account.passwordHash, "hex"));
}
