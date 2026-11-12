import { useEffect, useState } from "react";
import { api, useMatch, newTournament } from "./api";
import { calc, summary, overs, setBpo, BPO, matchStats, outcome } from "./core";

const DISM = ["Bowled / Caught / LBW / Stumped", "Run out (batter on strike)", "Run out (other batter)"];
const tb = (S, i) => (S.first + i) % 2;        // team index batting in innings i
const tw = (S, i) => (S.first + i + 1) % 2;    // team index bowling in innings i
const needBowl = n => { setBpo(n); const c = calc(n.inns[n.cur]); return c.nb && c.balls < n.overs * BPO; };

function Pick({ title, names, free, onPick, onClose }) {
  const [t, setT] = useState("");
  return (
    <div className="modal"><div className="dlg">
      <h3>{title}</h3>
      <div className="pick">{names.map(n => <button key={n} onClick={() => onPick(n)}>{n}</button>)}</div>
      {free && <input placeholder="Or type a name" value={t} onChange={e => setT(e.target.value)} />}
      <div className="act"><button onClick={onClose}>Cancel</button>{free && <button className="primary" onClick={() => t.trim() && onPick(t.trim())}>Use name</button>}</div>
    </div></div>
  );
}

function MatchForm({ mode, teams, S, onSave, onClose }) {
  const inn2 = mode === "inn2";
  const [f, setF] = useState({ a: teams[0]?.name, b: teams[1]?.name, overs: 20, bpo: 6, first: 0, st: "", non: "", bw: "" });
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const T = n => teams.find(t => t.name === n)?.players || [];
  let bat, bowl;
  if (inn2) { bat = S.sq[tb(S, 1)] || []; bowl = S.sq[tw(S, 1)] || []; }
  else { const A = T(f.a), B = T(f.b); [bat, bowl] = +f.first ? [B, A] : [A, B]; }
  const sel = (k, names) => <select value={f[k]} onChange={set(k)}><option value="">Select...</option>{names.map(n => <option key={n}>{n}</option>)}</select>;
  const ok = bat.includes(f.st) && bat.includes(f.non) && f.st !== f.non && bowl.includes(f.bw) && (inn2 || f.a !== f.b);
  return (
    <div className="modal"><div className="dlg">
      <h3>{inn2 ? "Second innings" : "New match"}</h3>
      {!inn2 && <>
        <div className="two">
          <div><label>Team A</label><select value={f.a} onChange={set("a")}>{teams.map(t => <option key={t.name}>{t.name}</option>)}</select></div>
          <div><label>Team B</label><select value={f.b} onChange={set("b")}>{teams.map(t => <option key={t.name}>{t.name}</option>)}</select></div>
          <div><label>Overs per innings</label><input type="number" min="1" value={f.overs} onChange={set("overs")} /></div>
          <div><label>Balls per over</label><input type="number" min="1" value={f.bpo} onChange={set("bpo")} /></div>
        </div>
        <label>Batting first</label>
        <select value={f.first} onChange={set("first")}><option value={0}>{f.a}</option><option value={1}>{f.b}</option></select>
      </>}
      <h4>Opening players</h4>
      <label>Batter on strike</label>{sel("st", bat)}
      <label>Batter at other end</label>{sel("non", bat)}
      <label>Bowler</label>{sel("bw", bowl)}
      <div className="act"><button onClick={onClose}>Cancel</button><button className="primary" disabled={!ok} onClick={() => onSave(f)}>Start</button></div>
    </div></div>
  );
}

function FinForm({ S, onSave, onClose }) {
  setBpo(S);
  const P = Object.values(matchStats(S)).sort((a, b) => b.pts - a.pts);
  const k0 = S.motm ? P.findIndex(p => p.team === S.motm.team && p.name === S.motm.name) : 0;
  const [i, setI] = useState(Math.max(0, k0)), [isFinal, setFinal] = useState(!!S.final);
  return (
    <div className="modal"><div className="dlg">
      <h3>Save match to tournament</h3>
      <label>Man of the match</label>
      <select value={i} onChange={e => setI(+e.target.value)}>{P.map((p, k) => <option key={k} value={k}>{p.name} ({p.team}) - {p.runs} runs, {p.wk} wkts</option>)}</select>
      <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14 }}>
        <input type="checkbox" style={{ width: "auto" }} checked={isFinal} onChange={e => setFinal(e.target.checked)} /> This is the final match
      </label>
      <p className="dim">The list starts with the top performer (1 point per run, 25 per wicket).</p>
      <div className="act"><button onClick={onClose}>Cancel</button><button className="primary" disabled={!P.length} onClick={() => onSave(P[i], isFinal)}>Save</button></div>
    </div></div>
  );
}

export default function Scorer({ onReport }) {
  const [S, setM] = useMatch();
  const [teams, setTeams] = useState([]);
  const [ex, setEx] = useState(null), [wk, setWk] = useState(false);
  const [dlg, setDlg] = useState(null), [pk, setPk] = useState(null), [showFin, setShowFin] = useState(false), [tour, setTour] = useState("");
  const loadTour = () => api.get("/tours").then(t => t && setTour((t.tours.find(x => x.id === t.cur) || {}).name || ""));
  useEffect(() => { api.get("/teams").then(t => setTeams(t || [])); loadTour(); }, []);

  if (S) setBpo(S);
  const m = S && summary(S), c = m && m.c;
  const dis = !S || m.done;

  const push = n => { setM(n); api.put("/match", n); };
  const add = (e, base) => { const n = structuredClone(base || S); n.inns[n.cur].ev.push(e); push(n); return n; };

  const askBowl = n => setPk({ title: "Next bowler", names: n.sq[tw(n, n.cur)] || [], free: true, onPick: name => { setPk(null); add({ t: "bowl", name }, n); } });
  const askBat = n => {
    const c2 = calc(n.inns[n.cur]);
    setPk({ title: "New batter", names: (n.sq[tb(n, n.cur)] || []).filter(x => !c2.bat[x]), free: true, onPick: name => { setPk(null); const n2 = add({ t: "bat", name }, n); if (needBowl(n2)) askBowl(n2); } });
  };
  const next = n => {
    setBpo(n);
    const k = summary(n);
    if (k.done) return;
    if ((!k.c.st || !k.c.non) && k.c.w < k.maxW) askBat(n);
    else if (needBowl(n)) askBowl(n);
  };
  const done = (runs, ro, out, flip) => {
    const n = add({ t: "ball", runs, ex, w: wk, ro, out, fs: !!flip });
    setEx(null); setWk(false); next(n);
  };
  const ball = (runs, flip) => {
    if (dis) return;
    if (wk) setPk({ title: "How was the batter out?", names: DISM, free: false, onPick: nm => { setPk(null); const k = DISM.indexOf(nm); done(runs, k > 0, k === 2 ? "non" : "st", flip); } });
    else done(runs, false, "st", flip);
  };
  const undo = () => { if (!S || !S.inns[S.cur].ev.length) return; const n = structuredClone(S); n.inns[n.cur].ev.pop(); push(n); };

  const saveForm = f => {
    if (dlg === "inn2") { const n = structuredClone(S); n.inns[1] = { striker: f.st, non: f.non, bowler: f.bw, ev: [] }; n.cur = 1; push(n); }
    else {
      const A = teams.find(t => t.name === f.a), B = teams.find(t => t.name === f.b);
      push({ a: A.name, b: B.name, ca: A.color, cb: B.color, sq: [A.players, B.players], overs: +f.overs || 20, bpo: +f.bpo || 6, first: +f.first, cur: 0,
        inns: [{ striker: f.st, non: f.non, bowler: f.bw, ev: [] }, { ev: [] }] });
    }
    setEx(null); setWk(false); setDlg(null);
  };
  const newMatch = () => {
    if (teams.length < 2) return alert("Register at least two teams first (Teams tab).");
    if (!S || confirm("Start a new match? This clears the current one.")) setDlg("new");
  };
  const clearMatch = () => { if (S && confirm("Clear the live match from the scorer and overlay?")) { setM(null); api.del("/match"); } };

  const saveMatch = async (p, isFinal) => {
    const t = await api.get("/tours");
    const n = structuredClone(S);
    n.motm = { team: p.team, name: p.name }; n.final = isFinal; n.archId = n.archId || Date.now(); n.tid = n.tid || t.cur;
    setBpo(n);
    await api.put("/matches/" + n.archId, { id: n.archId, tid: n.tid, date: new Date().toISOString(), S: n, motm: n.motm, final: isFinal, outcome: outcome(n) });
    push(n); setShowFin(false);
  };
  const startTour = async () => {
    if (S && S.cur === 1 && m.done && !S.archId && !confirm("The finished match on screen has NOT been saved. Continue anyway?")) return;
    if (await newTournament()) { setM(null); api.get("/teams").then(t => setTeams(t || [])); loadTour(); }
  };

  const st = n => n ? `${n} ${c.bat[n].r}(${c.bat[n].b})` : "-";
  const bo = S && c.bw && c.bowl[c.bw];
  const pending = !S ? "" : m.done ? (S.cur === 0 ? "Innings complete. Press End innings to start the second innings." : "Match complete.")
    : (!c.st || !c.non) && c.w < m.maxW ? "A new batter is needed." : needBowl(S) ? "Over complete: choose the next bowler." : "";

  return (
    <div>
      <div className="dim" style={{ marginBottom: 8 }}>Tournament: {tour}</div>
      <div className="score">{!S ? 'No match yet. Press "New match".' : <>
        <div className="dim">{m.team} batting, innings {S.cur + 1}</div>
        <b>{c.runs}/{c.w}</b> <span className="dim">({overs(c.balls)} / {S.overs} ov)</span>
        <div className="dim">{m.target ? `Target ${m.target} · need ${m.need} from ${m.left} balls` : `Run rate ${m.crr}`}</div>
        <div>On strike: {st(c.st)}<br />Other end: {st(c.non)}<br />Bowling: {bo ? `${c.bw} ${overs(bo.b)}-${bo.r}-${bo.w}` : c.bw || "-"}</div>
        <div className="over">{c.over.map((b, i) => <span key={i}>{b}</span>)}</div>
        {m.result && <div style={{ color: "var(--amber)", marginTop: 8 }}>{m.result}</div>}
      </>}</div>
      <div id="pending">{pending}</div>

      <div className="grid tog">
        {[["wd", "Wide"], ["nb", "No ball"], ["b", "Bye"], ["lb", "Leg bye"]].map(([k, l]) =>
          <button key={k} disabled={dis} className={ex === k ? "on" : ""} onClick={() => setEx(ex === k ? null : k)}>{l}</button>)}
      </div>
      <div className="grid tog">
        <button className={"w" + (wk ? " on" : "")} style={{ gridColumn: "span 2" }} disabled={dis} onClick={() => setWk(!wk)}>Wicket</button>
        <button style={{ gridColumn: "span 2" }} disabled={dis} onClick={() => ball(1, true)}>1 run, no swap</button>
      </div>
      <div className="grid runs">
        {[0, 1, 2, 3, 4, 5, 6].map(r => <button key={r} disabled={dis} onClick={() => ball(r)}>{r}</button>)}
        <button onClick={undo}>Undo</button>
      </div>
      <p className="dim">With Wide or No ball selected, the number is the extra runs run (0 = just the penalty run).</p>

      <div className="row">
        <button disabled={!S} onClick={() => askBat(S)}>New batter</button>
        <button disabled={!S} onClick={() => askBowl(S)}>New bowler</button>
        <button disabled={!S} onClick={() => add({ t: "swap" })}>Swap strike</button>
      </div>
      <div className="row">
        <button className={S && m.done && S.cur === 0 ? "primary" : ""} disabled={!S || S.cur !== 0} onClick={() => setDlg("inn2")}>End innings</button>
        <button onClick={newMatch}>New match</button>
        <button disabled={!S} onClick={clearMatch}>Clear</button>
      </div>

      <div className="row">
        <button className={S && m.done && S.cur === 1 && !S.archId ? "primary" : ""} disabled={!S || S.cur !== 1 || !m.done} onClick={() => setShowFin(true)}>{S && S.archId ? "Update saved" : "Save match"}</button>
        <button onClick={startTour}>New tournament</button>
        <button onClick={onReport}>Report</button>
      </div>

      {dlg && <MatchForm mode={dlg} teams={teams} S={S} onSave={saveForm} onClose={() => setDlg(null)} />}
      {pk && <Pick {...pk} onClose={() => setPk(null)} />}
      {showFin && <FinForm S={S} onSave={saveMatch} onClose={() => setShowFin(false)} />}
    </div>
  );
}
