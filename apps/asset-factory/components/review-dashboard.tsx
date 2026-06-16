"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ALL_STATUSES,
  CATEGORY_META,
  type AssetCandidate,
  type AssetStatus,
  type CategoryGroup,
} from "@/lib/types";
import { runQualityChecks } from "@/lib/quality";
import { applyTransition } from "@/lib/transitions";
import { exportJson, exportTs, approvedCatalog } from "@/lib/export";
import {
  CHANGE_EVENT,
  addCandidates,
  loadCandidates,
  resetStore,
  updateCandidate,
} from "@/lib/store";
import { AssetCard } from "@/components/asset-card";
import { AssetDetail } from "@/components/asset-detail";
import { ImportPanel } from "@/components/import-panel";

const GROUPS: CategoryGroup[] = ["interior", "exterior", "avatar", "business"];
const REVIEWER = "hannan";

function download(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReviewDashboard() {
  const [candidates, setCandidates] = useState<AssetCandidate[]>([]);
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "all">("all");
  const [groupFilter, setGroupFilter] = useState<CategoryGroup | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load + subscribe to store changes (e.g. from other tabs / imports).
  useEffect(() => {
    setCandidates(loadCandidates());
    const onChange = () => setCandidates(loadCandidates());
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (groupFilter !== "all" && CATEGORY_META[c.category]?.group !== groupFilter) return false;
      if (q) {
        const hay = [c.name, c.category, c.pack, ...c.tags].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [candidates, statusFilter, groupFilter, query]);

  const selected = candidates.find((c) => c.id === selectedId) ?? null;

  const transition = useCallback(
    (candidate: AssetCandidate, to: AssetStatus) => {
      const next = applyTransition(candidate, to, REVIEWER, candidates);
      setCandidates((prev) => updateCandidate(prev, next));
    },
    [candidates],
  );

  const saveMeta = useCallback((next: AssetCandidate) => {
    setCandidates((prev) => updateCandidate(prev, next));
  }, []);

  const selectNext = useCallback(() => {
    if (filtered.length === 0) return;
    const idx = filtered.findIndex((c) => c.id === selectedId);
    const next = filtered[(idx + 1) % filtered.length];
    setSelectedId(next.id);
  }, [filtered, selectedId]);

  // Keyboard shortcuts (desktop): A approve · R reject · E needs edit · N next.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const cur = candidates.find((c) => c.id === selectedId);
      const key = e.key.toLowerCase();
      if (key === "n") {
        e.preventDefault();
        selectNext();
      } else if (cur && key === "a") {
        e.preventDefault();
        transition(cur, "approved");
      } else if (cur && key === "r") {
        e.preventDefault();
        transition(cur, "rejected");
      } else if (cur && key === "e") {
        e.preventDefault();
        transition(cur, "needs_edit");
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [candidates, selectedId, selectNext, transition]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const cand of candidates) c[cand.status] = (c[cand.status] ?? 0) + 1;
    return c;
  }, [candidates]);

  const approvedCount = approvedCatalog(candidates).length;

  return (
    <div className="app">
      <div className="topbar">
        <h1>🏭 Nestudio Asset Factory</h1>
        <span className="spacer" />
        <span className="muted">
          {candidates.length} candidates · {approvedCount} approved
        </span>
      </div>

      <div className="toolbar">
        <ImportPanel onAdd={(incoming) => setCandidates((prev) => addCandidates(prev, incoming))} />
        <button
          className="btn"
          disabled={approvedCount === 0}
          onClick={() => download("approved-assets.json", exportJson(candidates), "application/json")}
        >
          ⬇ Export JSON
        </button>
        <button
          className="btn"
          disabled={approvedCount === 0}
          onClick={() => download("approved-assets.ts", exportTs(candidates), "text/typescript")}
        >
          ⬇ Export .ts
        </button>
        <button
          className="btn"
          onClick={() => {
            if (confirm("Reset the factory to the 30 sample candidates? This clears local changes.")) {
              setCandidates(resetStore());
              setSelectedId(null);
            }
          }}
        >
          ↺ Reset samples
        </button>
      </div>

      <div className="toolbar">
        <input
          className="search"
          type="text"
          placeholder="Search name, tag, category…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="chips" style={{ marginBottom: 8 }}>
        <button className={`chip ${statusFilter === "all" ? "active" : ""}`} onClick={() => setStatusFilter("all")}>
          All statuses
        </button>
        {ALL_STATUSES.map((s) => (
          <button key={s} className={`chip ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>
            {s.replace("_", " ")} {counts[s] ? `(${counts[s]})` : ""}
          </button>
        ))}
      </div>

      <div className="chips" style={{ marginBottom: 14 }}>
        <button className={`chip ${groupFilter === "all" ? "active" : ""}`} onClick={() => setGroupFilter("all")}>
          All categories
        </button>
        {GROUPS.map((g) => (
          <button key={g} className={`chip ${groupFilter === g ? "active" : ""}`} onClick={() => setGroupFilter(g)}>
            {g}
          </button>
        ))}
      </div>

      <p className="muted" style={{ marginBottom: 8 }}>
        Shortcuts: <span className="kbd">A</span> approve · <span className="kbd">R</span> reject ·{" "}
        <span className="kbd">E</span> needs edit · <span className="kbd">N</span> next · <span className="kbd">Esc</span> close
      </p>

      {filtered.length === 0 ? (
        <p className="muted">No candidates match these filters.</p>
      ) : (
        <div className="grid">
          {filtered.map((c) => (
            <AssetCard
              key={c.id}
              candidate={c}
              issues={runQualityChecks(c, candidates)}
              selected={c.id === selectedId}
              onSelect={() => setSelectedId(c.id)}
            />
          ))}
        </div>
      )}

      {selected && (
        <AssetDetail
          candidate={selected}
          all={candidates}
          onTransition={(to) => transition(selected, to)}
          onSave={saveMeta}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
