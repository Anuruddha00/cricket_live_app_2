// Tiny JSON-file store. Swap this module for PostgreSQL/MongoDB later; the rest of the app only uses db + save().
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.DATA_FILE || path.join(DIR, "data.json");
const cache = new Map(), timers = new Map();

function dataPath(tenantId) {
  const id = crypto.createHash("sha256").update(tenantId).digest("hex");
  return FILE + "." + id + ".json";
}

export function getDb(tenantId) {
  if (!cache.has(tenantId)) {
    const file = dataPath(tenantId);
    const db = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { teams: [], match: null };
    db.tours ||= [{ id: "t0", name: "Cricket Tournament", date: 0 }];
    db.cur ||= "t0";
    db.matches ||= {};
    cache.set(tenantId, db);
  }
  return cache.get(tenantId);
}

export function save(tenantId) {
  clearTimeout(timers.get(tenantId));
  timers.set(tenantId, setTimeout(() => {
    const file = dataPath(tenantId);
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    fs.writeFileSync(file + ".tmp", JSON.stringify(getDb(tenantId)), { mode: 0o600 });
    fs.renameSync(file + ".tmp", file);
    timers.delete(tenantId);
  }, 200));
}
