import { useEffect, useState } from "react";
import { io } from "socket.io-client";

// Backend address. Leave empty when one server hosts everything; set VITE_API_URL when the client is on Netlify.
const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
localStorage.removeItem("token");
const TOKEN_KEY = "cricket-login-token-v2";
sessionStorage.removeItem("token");
let token = sessionStorage.getItem(TOKEN_KEY);
export const authed = () => !!token;
export const logout = () => { token = null; sessionStorage.removeItem(TOKEN_KEY); location.reload(); };

const J = { "Content-Type": "application/json" };
export async function login(username, password) {
  try {
    const r = await fetch(BASE + "/api/login", { method: "POST", headers: J, body: JSON.stringify({ username, password }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return d.error || "Could not log in.";
    token = d.token; sessionStorage.setItem(TOKEN_KEY, token); return null;
  } catch { return "Could not reach the server."; }
}
async function call(method, path, body) {
  const r = await fetch(BASE + "/api" + path, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }
  });
  if (r.status === 401 && token) return logout();
  return r.json().catch(() => null);
}
export const api = { get: p => call("GET", p), put: (p, b) => call("PUT", p, b), post: (p, b) => call("POST", p, b), del: p => call("DELETE", p) };

// Starts a new tournament: asks for a name, then clears the live match (and optionally the teams).
export async function newTournament() {
  const name = (prompt("Name of the new tournament") || "").trim();
  if (!name) return false;
  if (!confirm(`Start "${name}"?\n\nThe live match on the scorer and overlay will be cleared. Matches already saved stay in the previous tournament's report.`)) return false;
  const clearTeams = confirm("Also clear all registered teams and squads?\n\nOK = clear them (register new teams)\nCancel = keep the teams");
  await api.post("/tours", { name, clearTeams });
  return true;
}

// Live match: loads once, then the server pushes every change over Socket.IO.
export function useMatch() {
  const [m, setM] = useState(null);
  useEffect(() => {
    const overlayUser = location.pathname.startsWith("/overlay")
      ? new URLSearchParams(location.search).get("user")
      : null;
    if (location.pathname.startsWith("/overlay") && !overlayUser) return;
    const matchPath = overlayUser
      ? "/api/overlay/" + encodeURIComponent(overlayUser) + "/match"
      : BASE + "/api/match";
    fetch(overlayUser ? BASE + matchPath : matchPath, overlayUser ? undefined : {
      headers: token ? { Authorization: "Bearer " + token } : {}
    }).then(r => r.ok ? r.json() : null).then(setM).catch(() => setM(null));
    const s = io(BASE || undefined, {
      auth: !overlayUser && token ? { token } : {},
      query: overlayUser ? { overlayUser } : {}
    });
    s.on("match", setM);
    return () => s.disconnect();
  }, []);
  return [m, setM];
}
