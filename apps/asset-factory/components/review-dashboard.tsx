"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ALL_STATUSES,
  CATEGORY_META,
  type AssetCandidate,
  type AssetStatus,
  type CategoryGroup,
  type ReviewAction,
  type ReviewActionType,
} from "@/lib/types";
import { runQualityChecks } from "@/lib/quality";
import { applyTransition } from "@/lib/transitions";
import { makeReviewAction } from "@/lib/activity";
import { exportJson, exportTs, approvedCatalog } from "@/lib/export";
import { CHANGE_EVENT } from "@/lib/store";
import { getCandidateRepository } from "@/lib/repo";
import { AssetCard } from "@/components/asset-card";
import { AssetDetail } from "@/components/asset-detail";
import { ImportPanel } from "@/components/import-panel";
import { ActivityPanel } from "@/components/activity-panel";
import { FactoryNav } from "@/components/factory-nav";

const GROUPS: CategoryGroup[] = ["interior", "exterior", "avatar", "business"];

function download(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReviewDashboard({
  reviewer,
  onChangeReviewer,
}: {
  reviewer: string;
  onChangeReviewer: () => void;
}) {
  const repo = useMemo(() => getCandidateRepository(), []);

  const [candidates, setCandidates] = useState<AssetCandidate[]>([]);
  const [actions, setActions] = useState<ReviewAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "all">("all");
  const [groupFilter, setGroupFilter] = useState<CategoryGroup | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [cands, acts] = await Promise.all([repo.list(), repo.listActions()]);
      setCandidates(cands);
      setActions(acts);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    }
  }, [repo]);

  // Initial load + (local mode) cross-tab change subscription.
  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
    const onChange = () => void refresh();
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, [refresh]);

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
    async (candidate: AssetCandidate, to: AssetStatus) => {
      const next = applyTransition(candidate, to, reviewer, candidates);
      if (next === candidate) return; // no-op (e.g. blocked approve)
      const action = makeReviewAction(next, to as ReviewActionType, reviewer);
      // Optimistic update, then persist (revert via refresh on failure).
      setCandidates((prev) => prev.map((c) => (c.id === next.id ? next : c)));
      setActions((prev) => [action, ...prev]);
      try {
        await repo.applyAction(next, action);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed.");
        void refresh();
      }
    },
    [candidates, reviewer, repo, refresh],
  );

  const saveMeta = useCallback(
    async (next: AssetCandidate) => {
      setCandidates((prev) => prev.map((c) => (c.id === next.id ? next : c)));
      try {
        await repo.saveCandidate(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed.");
        void refresh();
      }
    },
    [repo, refresh],
  );

  const addAssets = useCallback(
    async (incoming: AssetCandidate[]) => {
      try {
        const full = await repo.addCandidates(incoming);
        setCandidates(full);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed.");
      }
    },
    [repo],
  );

  const uploadImage = useMemo(() => {
    if (repo.mode !== "supabase") return undefined;
    return async (file: File): Promise<string> => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", file.name);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed.");
      }
      return (await res.json()).url as string;
    };
  }, [repo]);

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
        void transition(cur, "approved");
      } else if (cur && key === "r") {
        e.preventDefault();
        void transition(cur, "rejected");
      } else if (cur && key === "e") {
        e.preventDefault();
        void transition(cur, "needs_edit");
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
        <span className={`pill ${repo.mode === "supabase" ? "approved" : "queued"}`}>
          {repo.mode === "supabase" ? "Shared" : "Local"}
        </span>
        <span className="muted">
          {reviewer} ·{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); onChangeReviewer(); }}>
            change
          </a>
        </span>
      </div>

      <p className="muted" style={{ marginTop: -4, marginBottom: 10 }}>
        {candidates.length} candidates · {approvedCount} approved
      </p>

      <FactoryNav />

      {error && <p className="error">⚠ {error}</p>}

      <div className="toolbar">
        <ImportPanel onAdd={addAssets} uploadImage={uploadImage} />
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
        {repo.canReset && (
          <button
            className="btn"
            onClick={() => {
              if (confirm("Reset the factory to the 30 sample candidates? This clears local changes.")) {
                repo.reset().then((seeded) => {
                  setCandidates(seeded);
                  setActions([]);
                  setSelectedId(null);
                });
              }
            }}
          >
            ↺ Reset samples
          </button>
        )}
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

      <ActivityPanel actions={actions} />

      <p className="muted" style={{ marginBottom: 8 }}>
        Shortcuts: <span className="kbd">A</span> approve · <span className="kbd">R</span> reject ·{" "}
        <span className="kbd">E</span> needs edit · <span className="kbd">N</span> next · <span className="kbd">Esc</span> close
      </p>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : filtered.length === 0 ? (
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
          onTransition={(to) => void transition(selected, to)}
          onSave={saveMeta}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
