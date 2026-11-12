import { useState } from "react";
import { authed, login, logout } from "./api";
import Scorer from "./Scorer.jsx";
import Teams from "./Teams.jsx";
import Report from "./Report.jsx";
import Overlay from "./Overlay.jsx";

export default function App() {
  const [ok, setOk] = useState(authed()), [tab, setTab] = useState("score");
  const [username, setUsername] = useState(""), [password, setPassword] = useState(""), [msg, setMsg] = useState("");
  if (location.pathname.startsWith("/overlay")) return <Overlay />;

  const signIn = async () => {
    setMsg("");
    const error = await login(username.trim(), password);
    if (error) setMsg(error);
    else { setPassword(""); setOk(true); }
  };

  if (!ok) return (
    <div className="login">
      <h2>Login</h2>
      <div className="dim">Accounts are provided by the app owner.</div>
      <input autoComplete="username" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && signIn()} />
      <input type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && signIn()} />
      <button className="primary" disabled={!username || !password} onClick={signIn}>Log in</button>
      <div style={{ color: "var(--amber)" }}>{msg}</div>
    </div>
  );

  return (
    <div className={tab === "report" ? "" : "narrow"}>
      <div className="nav">
        <button className={tab === "score" ? "on" : ""} onClick={() => setTab("score")}>Scorer</button>
        <button className={tab === "teams" ? "on" : ""} onClick={() => setTab("teams")}>Teams</button>
        <button className={tab === "report" ? "on" : ""} onClick={() => setTab("report")}>Report</button>
        <button onClick={logout}>Log out</button>
      </div>
      {tab === "score" ? <Scorer onReport={() => setTab("report")} /> : tab === "teams" ? <Teams /> : <Report />}
    </div>
  );
}
