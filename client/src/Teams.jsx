import { useEffect, useState } from "react";
import { api } from "./api";

const blank = { name: "", color: "#3fa66b", pl: "" };
export default function Teams() {
  const [teams, setTeams] = useState([]), [sel, setSel] = useState(""), [f, setF] = useState(blank);
  useEffect(() => { api.get("/teams").then(t => setTeams(t || [])); }, []);
  const persist = async list => { setTeams(list); await api.put("/teams", list); };
  const pick = n => { setSel(n); const t = teams.find(x => x.name === n); setF(t ? { name: t.name, color: t.color, pl: t.players.join("\n") } : blank); };
  const save = () => {
    const name = f.name.trim(); if (!name) return;
    const t = { name, color: f.color, players: f.pl.split(/[\n,]/).map(x => x.trim()).filter(Boolean) };
    const i = teams.findIndex(x => x.name === sel);
    persist(i >= 0 ? teams.map((x, k) => (k === i ? t : x)) : [...teams, t]); setSel(name);
  };
  const del = () => { if (confirm("Delete team " + sel + "?")) { persist(teams.filter(x => x.name !== sel)); pick(""); } };
  return (
    <div>
      <h3>Team registration</h3>
      <label>Team</label>
      <select value={sel} onChange={e => pick(e.target.value)}><option value="">+ New team</option>{teams.map(t => <option key={t.name}>{t.name}</option>)}</select>
      <div className="two">
        <div><label>Team name</label><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
        <div><label>Colour</label><input type="color" value={f.color} onChange={e => setF({ ...f, color: e.target.value })} /></div>
      </div>
      <label>Players (one name per line)</label>
      <textarea rows="10" value={f.pl} onChange={e => setF({ ...f, pl: e.target.value })} />
      <div className="act">{sel && <button onClick={del}>Delete</button>}<button className="primary" onClick={save}>Save team</button></div>
    </div>
  );
}
