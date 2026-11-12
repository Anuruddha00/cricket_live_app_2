import { useEffect, useMemo, useRef, useState } from "react";
import { useMatch } from "./api";
import { summary, overs, setBpo } from "./core";

const FX = { FOUR: ["four", "4"], SIX: ["six", "6"], WICKET: ["wicket", "W"], "RUN OUT": ["runout", "W"], WIDE: ["wide", ""], "NO BALL": ["noball", ""] };
const PAL = ["#f2b134", "#ffffff", "var(--accent)", "#ffd978"];

// Full-screen celebration: edge glow, light rays (six), confetti, and a sliding card with the batter's name.
function Fx({ fl }) {
  const [type, num] = FX[fl.text];
  const bits = useMemo(() => {
    let s = (fl.n % 1000) + 7; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    return Array.from({ length: type === "six" ? 40 : type === "four" ? 16 : 0 }, () => ({
      "--x": rnd() * 70 + "%", "--s": 8 + rnd() * 12 + "px", "--d": 1.4 + rnd() * 1.2 + "s", "--dl": rnd() * 0.5 + "s",
      "--dx": (rnd() - 0.3) * 600 + "px", "--h": -(500 + rnd() * 500) + "px", "--r": rnd() * 720 + "deg", "--col": PAL[Math.floor(rnd() * PAL.length)]
    }));
  }, [fl.n]);
  return (
    <div className={"fx " + type}>
      <div className="fx-glow" />
      {type === "six" && <div className="fx-rays" />}
      {bits.map((b, i) => <i key={i} className="fx-c" style={b} />)}
      <div className="fx-card">
        {num && <div className="fx-num">{num}</div>}
        <div className="fx-txt"><span>{fl.text}</span>{fl.who && <small>{fl.who} {fl.r} ({fl.b})</small>}</div>
      </div>
    </div>
  );
}

const lum = h => { const n = parseInt(h.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };

export default function Overlay() {
  const [S] = useMatch();
  const seen = useRef(null), [fl, setFl] = useState(null);
  const m = S ? (setBpo(S), summary(S)) : null;
  const username = new URLSearchParams(location.search).get("user");

  // FOUR / SIX / WICKET banners: only for balls scored after the page loaded (not on refresh or undo)
  useEffect(() => {
    if (!m) { seen.current = null; return; }
    const e = m.evt;
    if (seen.current === null || e.n <= seen.current) { seen.current = e.n; return; }
    seen.current = e.n;
    if (!e.text) return;
    setFl({ text: e.text, who: e.who, r: e.r, b: e.b, n: e.n });
    const t = setTimeout(() => setFl(null), 3200);
    return () => clearTimeout(t);
  }, [m && m.evt.n, !!m]);

  if (!username) return <div id="bar" style={{ display: "block" }}><div className="sub">Overlay URL needs ?user=YOUR_USERNAME</div></div>;
  if (!m) return <div id="bar" style={{ display: "block" }}><div className="sub">Waiting for match data</div></div>;
  const c = m.c, bo = (c.bw && c.bowl[c.bw]) || { b: 0, r: 0, w: 0 };
  const bat = (n, on) => n ? <div className={on ? "on" : ""}>{n} <b>{c.bat[n].r}</b> <i>({c.bat[n].b})</i></div> : <div>&nbsp;</div>;
  const info = m.result || (m.target ? `Need ${m.need} from ${m.left} balls · RRR ${m.rrr}` : `CRR ${m.crr}`);
  return (
    <div style={{ "--accent": m.color, "--onaccent": lum(m.color) > 150 ? "#06140d" : "#ffffff" }}>
      {fl && <Fx key={fl.n} fl={fl} />}
      <div id="bar" style={{ display: "block" }}>
        <div className="main">
          <div className="team">{m.team}</div>
          <div className="score"><b>{c.runs}-{c.w}</b><span>{overs(c.balls)} ov</span></div>
          <div className="bats">{bat(c.st, true)}{bat(c.non, false)}</div>
          <div className="bowl"><div>{c.bw}</div><div><i>{overs(bo.b)} ov · {bo.r} runs · {bo.w} wkts</i></div></div>
        </div>
        <div className="sub">This over {c.over.map((b, i) => <span key={i} className={"chip" + (b === "W" ? " w" : b === "4" || b === "6" ? " f" : "")}>{b}</span>)}
          <span style={{ marginLeft: 18 }}>Partnership <b style={{ color: "var(--text)" }}>{c.pr}</b> ({c.pb})</span>
          <span className="push">{info}</span>
        </div>
      </div>
    </div>
  );
}
