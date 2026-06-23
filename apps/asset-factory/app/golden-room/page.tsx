"use client";

// Golden Room — art-direction console (internal). Discover ONE Nestudio Golden Room:
// generate a round (max 5) → view candidates → score + critique brutally → approve/
// reject → generate the next round from the critique → export the winner. Behaves like
// an art director, not a batch generator. Uses OpenAI when configured; a Dry run mode
// exercises the whole workflow without a key. Page is password-gated by middleware.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GOLDEN_ROOM_PROMPT,
  GOLDEN_ROOM_NEGATIVE,
  GOLDEN_ROOM_RUBRIC,
  WINNER_THRESHOLD,
  MAX_PER_ROUND,
  isWinner,
  nextRound,
  bestCandidate,
  type GoldenRoomCandidate,
} from "@/lib/golden-room";

type Status = { openaiConfigured: boolean; openaiEnabled: boolean; provider: string; model: string; ready: boolean };

export default function GoldenRoomPage() {
  const [candidates, setCandidates] = useState<GoldenRoomCandidate[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [prompt, setPrompt] = useState(GOLDEN_ROOM_PROMPT);
  const [negative, setNegative] = useState(GOLDEN_ROOM_NEGATIVE);
  const [count, setCount] = useState(3);
  const [dryRun, setDryRun] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/golden-room", { credentials: "same-origin" });
    if (!res.ok) {
      setError("Could not load candidates.");
      return;
    }
    const data = (await res.json()) as { candidates: GoldenRoomCandidate[]; status: Status };
    setCandidates(data.candidates);
    setStatus(data.status);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const round = useMemo(() => nextRound(candidates), [candidates]);
  const winner = useMemo(() => candidates.find((c) => isWinner(c)) ?? null, [candidates]);
  const best = useMemo(() => bestCandidate(candidates), [candidates]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/golden-room", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round, prompt, negativePrompt: negative, count, dryRun }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed.");
        return;
      }
      await load();
    } catch {
      setError("Generation request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Partial<Pick<GoldenRoomCandidate, "score" | "critique" | "status">>) {
    const res = await fetch("/api/golden-room", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    if (res.ok) {
      const data = (await res.json()) as { candidate: GoldenRoomCandidate };
      setCandidates((list) => list.map((c) => (c.id === id ? data.candidate : c)));
    }
  }

  async function exportWinner(id: string) {
    const res = await fetch(`/api/golden-room/export?id=${encodeURIComponent(id)}`, { credentials: "same-origin" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Export failed.");
      return;
    }
    const blob = new Blob([JSON.stringify(data.pack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "golden-room-v1.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const rounds = useMemo(() => {
    const byRound = new Map<number, GoldenRoomCandidate[]>();
    for (const c of candidates) {
      const arr = byRound.get(c.round) ?? [];
      arr.push(c);
      byRound.set(c.round, arr);
    }
    return [...byRound.entries()].sort((a, b) => b[0] - a[0]);
  }, [candidates]);

  return (
    <main className="gr-wrap">
      <style>{styles}</style>

      <header className="gr-head">
        <p className="gr-eyebrow">Asset Factory · art direction</p>
        <h1>Golden Room</h1>
        <p className="gr-sub">Discover <strong>one</strong> Nestudio room that makes someone think &ldquo;I want to live here and explore it.&rdquo; Not a library — the room.</p>
      </header>

      {/* status */}
      {status && (
        <div className={`gr-banner ${status.ready ? "ok" : "warn"}`}>
          {status.ready ? (
            <>OpenAI ready · model <code>{status.model}</code> — real generation enabled.</>
          ) : (
            <>OpenAI not enabled (configured: {String(status.openaiConfigured)}, enabled: {String(status.openaiEnabled)}). Set <code>OPENAI_API_KEY</code> + <code>OPENAI_GENERATION_ENABLED=true</code> in <code>apps/asset-factory/.env.local</code>, or use <strong>Dry run</strong> to test the workflow.</>
          )}
        </div>
      )}

      {winner && (
        <div className="gr-banner win">★ Winner found — candidate scored {winner.score}/100 (bar is {WINNER_THRESHOLD}). Export it below.</div>
      )}

      <div className="gr-grid">
        {/* controls */}
        <section className="gr-panel">
          <h2>Generate Round {round}</h2>
          <label className="gr-label">Prompt</label>
          <textarea className="gr-ta" rows={9} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <label className="gr-label">Negative prompt</label>
          <textarea className="gr-ta" rows={4} value={negative} onChange={(e) => setNegative(e.target.value)} />
          <div className="gr-row">
            <label className="gr-label">Candidates
              <select className="gr-select" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {Array.from({ length: MAX_PER_ROUND }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="gr-check">
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} /> Dry run
            </label>
          </div>
          <button className="gr-btn primary" onClick={generate} disabled={busy}>
            {busy ? "Generating…" : `Generate ${count} candidate${count > 1 ? "s" : ""}`}
          </button>
          {error && <p className="gr-error">{error}</p>}
          <p className="gr-note">Art-director rule: max {MAX_PER_ROUND} per round. Critique, then regenerate from the critique. Stop at one 85+ winner — or call NO-GO.</p>
        </section>

        {/* rubric */}
        <section className="gr-panel">
          <h2>Scoring rubric (0–100)</h2>
          <ul className="gr-rubric">
            {GOLDEN_ROOM_RUBRIC.map((r) => (
              <li key={r.id}><strong>{r.label}</strong><span>{r.hint}</span></li>
            ))}
          </ul>
          <p className="gr-note">Winner ≥ {WINNER_THRESHOLD}. Below 80 = not good enough.{best ? ` Current best: ${best.score}/100.` : ""}</p>
        </section>
      </div>

      {/* candidates by round */}
      {rounds.length === 0 && <p className="gr-empty">No candidates yet. Generate Round 1 (or toggle Dry run to test).</p>}
      {rounds.map(([r, list]) => (
        <section key={r} className="gr-roundblock">
          <h2 className="gr-roundtitle">Round {r} <span>· {list.length} candidate{list.length > 1 ? "s" : ""}</span></h2>
          <div className="gr-cards">
            {list.map((c) => (
              <article key={c.id} className={`gr-card ${isWinner(c) ? "winner" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="gr-img" src={c.imageUrl} alt={`Golden Room candidate, round ${c.round}`} />
                <div className="gr-cardbody">
                  <div className="gr-cardtop">
                    <span className={`gr-pill ${c.status}`}>{c.status}</span>
                    {c.dryRun && <span className="gr-pill dry">dry run</span>}
                    {isWinner(c) && <span className="gr-pill winp">★ winner</span>}
                  </div>
                  <label className="gr-label">Score (0–100)</label>
                  <input
                    className="gr-num"
                    type="number"
                    min={0}
                    max={100}
                    value={c.score ?? ""}
                    onChange={(e) => setCandidates((l) => l.map((x) => (x.id === c.id ? { ...x, score: e.target.value === "" ? null : Number(e.target.value) } : x)))}
                  />
                  <label className="gr-label">Critique</label>
                  <textarea
                    className="gr-ta sm"
                    rows={3}
                    placeholder="Brutal critique: what to preserve, what to remove…"
                    value={c.critique}
                    onChange={(e) => setCandidates((l) => l.map((x) => (x.id === c.id ? { ...x, critique: e.target.value } : x)))}
                  />
                  <div className="gr-row">
                    <button className="gr-btn" onClick={() => patch(c.id, { score: c.score, critique: c.critique })}>Save</button>
                    <button className="gr-btn ok" onClick={() => patch(c.id, { status: "approved", score: c.score, critique: c.critique })}>Approve</button>
                    <button className="gr-btn no" onClick={() => patch(c.id, { status: "rejected", score: c.score, critique: c.critique })}>Reject</button>
                  </div>
                  <button className="gr-btn export" disabled={c.status !== "approved"} onClick={() => exportWinner(c.id)}>Export RoomShellPack</button>
                  <details className="gr-details"><summary>Prompt</summary><pre className="gr-pre">{c.prompt}</pre></details>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

const styles = `
.gr-wrap{max-width:1100px;margin:0 auto;padding:24px 16px 60px;color:var(--ink);}
.gr-head h1{font-size:2rem;margin:.1em 0;}
.gr-eyebrow{color:var(--accent);font-weight:700;font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;}
.gr-sub{color:var(--ink-soft);max-width:60ch;}
.gr-banner{margin:14px 0;padding:12px 14px;border-radius:var(--radius);font-size:.9rem;border:1px solid var(--line);background:var(--panel);}
.gr-banner.ok{background:var(--green-soft);border-color:var(--green);}
.gr-banner.warn{background:var(--amber-soft);border-color:var(--amber);}
.gr-banner.win{background:var(--accent-soft);border-color:var(--accent);font-weight:700;}
.gr-banner code{background:rgba(0,0,0,.06);padding:1px 5px;border-radius:5px;}
.gr-grid{display:grid;grid-template-columns:1fr;gap:16px;margin:8px 0 24px;}
@media(min-width:760px){.gr-grid{grid-template-columns:1.4fr 1fr;}}
.gr-panel{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:16px;box-shadow:var(--shadow);}
.gr-panel h2{font-size:1.1rem;margin:0 0 10px;}
.gr-label{display:block;font-size:.8rem;font-weight:700;color:var(--ink-soft);margin:10px 0 4px;}
.gr-ta{width:100%;border:1px solid var(--line);border-radius:10px;padding:10px;font:inherit;font-size:.85rem;background:#fff;color:var(--ink);resize:vertical;}
.gr-ta.sm{font-size:.8rem;}
.gr-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px;}
.gr-select,.gr-num{border:1px solid var(--line);border-radius:8px;padding:6px 8px;font:inherit;background:#fff;color:var(--ink);margin-left:8px;}
.gr-num{width:100%;}
.gr-check{display:flex;align-items:center;gap:6px;font-size:.85rem;font-weight:700;color:var(--ink-soft);}
.gr-btn{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:9px;padding:8px 12px;font:inherit;font-weight:700;font-size:.82rem;cursor:pointer;}
.gr-btn:hover{background:var(--bg);}
.gr-btn.primary{background:var(--accent);color:#fff;border-color:var(--accent);margin-top:14px;width:100%;padding:11px;}
.gr-btn.ok{color:var(--green);border-color:var(--green);}
.gr-btn.no{color:var(--red);border-color:var(--red);}
.gr-btn.export{margin-top:10px;width:100%;}
.gr-btn:disabled{opacity:.45;cursor:not-allowed;}
.gr-note{font-size:.78rem;color:var(--ink-soft);margin-top:10px;}
.gr-error{color:var(--red);font-size:.85rem;margin-top:8px;font-weight:700;}
.gr-rubric{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;}
.gr-rubric li{display:flex;flex-direction:column;font-size:.84rem;}
.gr-rubric li span{color:var(--ink-soft);font-size:.78rem;}
.gr-empty{color:var(--ink-soft);padding:20px;text-align:center;}
.gr-roundblock{margin-top:26px;}
.gr-roundtitle{font-size:1.05rem;border-bottom:1px solid var(--line);padding-bottom:6px;}
.gr-roundtitle span{color:var(--ink-soft);font-weight:400;font-size:.85rem;}
.gr-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;margin-top:14px;}
.gr-card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);}
.gr-card.winner{border:2px solid var(--accent);box-shadow:0 0 0 3px var(--accent-soft);}
.gr-img{display:block;width:100%;aspect-ratio:2/3;object-fit:cover;background:var(--bg);}
.gr-cardbody{padding:12px;}
.gr-cardtop{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;}
.gr-pill{font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--line);color:var(--ink-soft);text-transform:capitalize;}
.gr-pill.approved{background:var(--green-soft);color:var(--green);}
.gr-pill.rejected{background:var(--red-soft);color:var(--red);}
.gr-pill.dry{background:var(--amber-soft);color:var(--amber);}
.gr-pill.winp{background:var(--accent-soft);color:var(--accent);}
.gr-details{margin-top:10px;}
.gr-details summary{cursor:pointer;font-size:.78rem;color:var(--ink-soft);font-weight:700;}
.gr-pre{white-space:pre-wrap;font-size:.72rem;color:var(--ink-soft);background:var(--bg);padding:8px;border-radius:8px;margin-top:6px;}
`;
