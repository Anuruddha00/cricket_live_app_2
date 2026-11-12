import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { getDb, save } from "./store.js";
import { normalizeUsername, readAccounts, verifyPassword } from "./accounts.js";

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const PORT = process.env.PORT || 3001;
const accounts = readAccounts();
const dummySalt = crypto.randomBytes(16).toString("hex");
const dummyAccount = {
  salt: dummySalt,
  passwordHash: crypto.scryptSync(crypto.randomBytes(32), dummySalt, 64).toString("hex")
};

const app = express();
app.set("trust proxy", 1);
const ORIGIN = process.env.CLIENT_ORIGIN || "*";
app.use(cors({ origin: ORIGIN }));
app.use(express.json({ limit: "2mb" }));
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: ORIGIN } });

const auth = (req, res, next) => {
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const payload = jwt.verify(token, SECRET);
    const username = normalizeUsername(payload.sub);
    const account = accounts[username];
    if (!account || payload.tid !== account.tenantId || payload.sv !== account.sessionVersion) throw new Error("invalid session");
    req.username = username;
    req.account = account;
    next();
  } catch {
    res.status(401).json({ error: "login required" });
  }
};

if (process.env.NODE_ENV === "production" &&
    (!process.env.JWT_SECRET || SECRET === "dev-secret-change-me" || Buffer.byteLength(SECRET, "utf8") < 32)) {
  console.error("Set a random JWT_SECRET of at least 32 characters before running in production.");
  process.exit(1);
}

const loginAttempts = new Map();
const tooManyAttempts = ip => {
  const recent = (loginAttempts.get(ip) || []).filter(time => Date.now() - time < 600000);
  recent.push(Date.now());
  loginAttempts.set(ip, recent);
  return recent.length > 10;
};

app.post("/api/login", (req, res) => {
  if (tooManyAttempts(req.ip)) return res.status(429).json({ error: "Too many login attempts. Try again in a few minutes." });
  const username = normalizeUsername(req.body && req.body.username);
  const password = String((req.body && req.body.password) || "");
  const account = accounts[username];
  const valid = password.length <= 128 && verifyPassword(password, account || dummyAccount);
  if (!account || !valid) return res.status(401).json({ error: "Invalid username or password." });
  res.json({
    token: jwt.sign({ sub: username, tid: account.tenantId, sv: account.sessionVersion }, SECRET, { expiresIn: "12h" })
  });
});

app.get("/api/teams", auth, (req, res) => res.json(getDb(req.account.tenantId).teams));
app.put("/api/teams", auth, (req, res) => {
  const db = getDb(req.account.tenantId);
  db.teams = req.body;
  save(req.account.tenantId);
  res.json(db.teams);
});

app.get("/api/match", auth, (req, res) => res.json(getDb(req.account.tenantId).match));
app.put("/api/match", auth, (req, res) => {
  const db = getDb(req.account.tenantId);
  db.match = req.body;
  save(req.account.tenantId);
  io.to(req.account.tenantId).emit("match", db.match);
  io.to("overlay:" + req.account.tenantId).emit("match", db.match);
  res.json({ ok: true });
});
app.delete("/api/match", auth, (req, res) => {
  const db = getDb(req.account.tenantId);
  db.match = null;
  save(req.account.tenantId);
  io.to(req.account.tenantId).emit("match", null);
  io.to("overlay:" + req.account.tenantId).emit("match", null);
  res.json({ ok: true });
});

app.get("/api/overlay/:username/match", (req, res) => {
  const account = accounts[normalizeUsername(req.params.username)];
  if (!account) return res.status(404).json({ error: "Overlay not found." });
  res.json(getDb(account.tenantId).match);
});

app.get("/api/tours", auth, (req, res) => {
  const db = getDb(req.account.tenantId);
  res.json({ tours: db.tours, cur: db.cur });
});
app.post("/api/tours", auth, (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name required" });
  const db = getDb(req.account.tenantId);
  const tournament = { id: "t" + Date.now(), name, date: Date.now() };
  db.tours.unshift(tournament);
  db.cur = tournament.id;
  db.match = null;
  if (req.body.clearTeams) db.teams = [];
  save(req.account.tenantId);
  io.to(req.account.tenantId).emit("match", null);
  io.to("overlay:" + req.account.tenantId).emit("match", null);
  res.json({ tours: db.tours, cur: db.cur });
});
app.put("/api/tours/:id", auth, (req, res) => {
  const db = getDb(req.account.tenantId);
  const tournament = db.tours.find(item => item.id === req.params.id);
  if (tournament) tournament.name = String(req.body.name || "").trim() || tournament.name;
  save(req.account.tenantId);
  res.json({ ok: true });
});
app.delete("/api/tours/:id", auth, (req, res) => {
  const db = getDb(req.account.tenantId);
  const id = req.params.id;
  db.tours = db.tours.filter(item => item.id !== id);
  Object.keys(db.matches).forEach(key => { if (db.matches[key].tid === id) delete db.matches[key]; });
  if (!db.tours.length) db.tours = [{ id: "t0", name: "Cricket Tournament", date: 0 }];
  if (!db.tours.some(item => item.id === db.cur)) db.cur = db.tours[0].id;
  save(req.account.tenantId);
  res.json({ tours: db.tours, cur: db.cur });
});
app.get("/api/matches", auth, (req, res) => {
  const db = getDb(req.account.tenantId);
  res.json(Object.values(db.matches).filter(match => match.tid === req.query.tid).sort((a, b) => a.id - b.id));
});
app.put("/api/matches/:id", auth, (req, res) => {
  const db = getDb(req.account.tenantId);
  const match = req.body;
  match.id = Number(req.params.id);
  match.tid = match.tid || db.cur;
  db.matches[match.id] = match;
  save(req.account.tenantId);
  res.json({ ok: true });
});
app.delete("/api/matches/:id", auth, (req, res) => {
  const db = getDb(req.account.tenantId);
  delete db.matches[req.params.id];
  save(req.account.tenantId);
  res.json({ ok: true });
});

io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (token) {
    try {
      const payload = jwt.verify(token, SECRET);
      const account = accounts[normalizeUsername(payload.sub)];
      if (!account || payload.tid !== account.tenantId || payload.sv !== account.sessionVersion) throw new Error("invalid session");
      socket.data.tenantId = account.tenantId;
      return next();
    } catch {
      return next(new Error("login required"));
    }
  }
  const username = normalizeUsername(socket.handshake.query && socket.handshake.query.overlayUser);
  const account = accounts[username];
  if (!account) return next(new Error("overlay not found"));
  socket.data.overlayTenantId = account.tenantId;
  next();
});
io.on("connection", socket => {
  const tenantId = socket.data.tenantId || socket.data.overlayTenantId;
  socket.join(socket.data.tenantId ? tenantId : "overlay:" + tenantId);
  socket.emit("match", getDb(tenantId).match);
});

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../client/dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
}
server.listen(PORT, () => console.log("Cricket server on http://localhost:" + PORT));
