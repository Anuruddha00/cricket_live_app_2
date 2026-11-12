import { useEffect, useState } from "react";
import { api, newTournament } from "./api";
import { tournament } from "./core";

const H = {
  bat: ["Player", "Team", "Mat", "Runs", "Balls", "SR", "HS", "4s", "6s"],
  bowl: ["Player", "Team", "Wkts", "Balls", "Runs", "Econ", "Best"],
  std: ["Team", "P", "W", "L", "T", "Pts", "NRR"],
  res: ["Date", "Match", "Result", "Man of the match"]
};
const sr = (r, b) => (b ? (r * 100 / b).toFixed(1) : "-");

function build(recs) {
  const T = tournament(recs), P = T.players, A = T.awards;
  const pl = p => (p ? `${p.team} · ${p.runs} runs, ${p.wk} wkts` : "");
  return {
    awards: [
      ["Man of the series", A.series && A.series.pts > 0 ? A.series.name : "-", pl(A.series)],
      ["Most runs", A.runs && A.runs.runs > 0 ? A.runs.name : "-", A.runs ? `${A.runs.team} · ${A.runs.runs} runs (HS ${A.runs.hs})` : ""],
      ["Most wickets", A.wkts && A.wkts.wk > 0 ? A.wkts.name : "-", A.wkts ? `${A.wkts.team} · ${A.wkts.wk} wkts` : ""],
      ["Man of the final", A.final ? A.final.motm.name : "Not decided", A.final ? `${A.final.motm.team} · ${A.final.match}${A.final.text ? " · " + A.final.text : ""}` : 'Tick "final match" when saving it']
    ],
    bat: P.filter(p => p.balls || p.runs).sort((a, b) => b.runs - a.runs || a.balls - b.balls).map(p => [p.name, p.team, p.mat, p.runs, p.balls, sr(p.runs, p.balls), p.hs, p.f, p.x]),
    bowl: P.filter(p => p.bb).sort((a, b) => b.wk - a.wk || a.br - b.br).map(p => [p.name, p.team, p.wk, p.bb, p.br, p.ov ? (p.br / p.ov).toFixed(2) : "-", p.bw ? p.bw + "/" + p.bwr : "-"]),
    std: T.teams.map(t => [t.name, t.p, t.w, t.l, t.t, t.w * 2 + t.t, t.nrr]).sort((a, b) => b[5] - a[5] || b[6] - a[6]).map(x => [...x.slice(0, 6), (x[6] >= 0 ? "+" : "") + x[6].toFixed(3)]),
    res: recs.map(r => [new Date(r.date).toLocaleDateString(), r.S.a + " v " + r.S.b + (r.final ? " (FINAL)" : ""), r.outcome ? r.outcome.text : "", r.motm ? `${r.motm.name} (${r.motm.team})` : ""])
  };
}

const Table = ({ h, rows }) => rows.length
  ? <div className="scroll"><table><thead><tr>{h.map(x => <th key={x}>{x}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
  : <p className="dim">No data yet.</p>;

export default function Report() {
  const [tours, setTours] = useState([]), [cur, setCur] = useState(null), [sel, setSel] = useState(null);
  const [recs, setRecs] = useState([]), [name, setName] = useState("");

  const load = async keep => {
    const t = await api.get("/tours"); if (!t) return;
    const id = keep && t.tours.some(x => x.id === sel) ? sel : t.cur;
    setTours(t.tours); setCur(t.cur); setSel(id);
    setName((t.tours.find(x => x.id === id) || {}).name || "");
    setRecs((await api.get("/matches?tid=" + id)) || []);
  };
  useEffect(() => { load(); }, []);

  const pick = async id => { setSel(id); setName(tours.find(x => x.id === id).name); setRecs((await api.get("/matches?tid=" + id)) || []); };
  const rename = async () => { const n = name.trim(); if (n && n !== (tours.find(x => x.id === sel) || {}).name) { await api.put("/tours/" + sel, { name: n }); load(true); } };
  const nt = async () => { if (await newTournament()) load(); };
  const del = async () => {
    if (!confirm(`Delete "${name}" and all its saved matches? Download the CSV first if you need it. This cannot be undone.`)) return;
    await api.del("/tours/" + sel); load();
  };

  const D = recs.length ? build(recs) : null;
  const download = () => {
    const q = v => '"' + String(v).replace(/"/g, '""') + '"', out = [q(name), ""];
    const add = (t, h, rows) => { out.push(q(t), h.map(q).join(",")); rows.forEach(r => out.push(r.map(q).join(","))); out.push(""); };
    add("Awards", ["Award", "Player", "Details"], D.awards); add("Standings", H.std, D.std);
    add("Batting", H.bat, D.bat); add("Bowling", H.bowl, D.bowl); add("Match results", H.res, D.res);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + out.join("\r\n")], { type: "text/csv" }));
    a.download = (name || "tournament").replace(/[^\w-]+/g, "_") + "_report.csv";
    document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <div>
      <div className="bar"><select value={sel || ""} onChange={e => pick(e.target.value)} aria-label="Tournament">
        {tours.map(t => <option key={t.id} value={t.id}>{t.name}{t.id === cur ? " (current)" : ""}</option>)}</select></div>
      <input className="tname" value={name} onChange={e => setName(e.target.value)} onBlur={rename} aria-label="Tournament name" />
      <div className="dim">{recs.length} match{recs.length === 1 ? "" : "es"} · generated {new Date().toLocaleDateString()}</div>
      <div className="bar">
        <button className="primary" disabled={!D} onClick={download}>Download CSV</button>
        <button onClick={() => window.print()}>Print / Save as PDF</button>
        <button onClick={() => load(true)}>Refresh</button>
        <button onClick={nt}>New tournament</button>
        <button onClick={del}>Delete this tournament</button>
      </div>
      {!D ? <p className="dim">No saved matches yet. Finish a match in the scorer and press Save match.</p> : <>
        <h2 className="rh">Awards</h2>
        <div className="cards">{D.awards.map(a => <div className="card" key={a[0]}><small>{a[0]}</small><b>{a[1]}</b><span className="dim">{a[2]}</span></div>)}</div>
        <p className="dim">Man of the series = most points (1 per run, 25 per wicket).</p>
        <h2 className="rh">Standings</h2><Table h={H.std} rows={D.std} />
        <p className="dim">Ranked by points, then net run rate. NRR = runs scored per over minus runs conceded per over; an all-out team counts as facing its full overs.</p>
        <h2 className="rh">Batting</h2><Table h={H.bat} rows={D.bat} />
        <h2 className="rh">Bowling</h2><Table h={H.bowl} rows={D.bowl} />
        <h2 className="rh">Match results</h2><Table h={H.res} rows={D.res} />
      </>}
    </div>
  );
}
