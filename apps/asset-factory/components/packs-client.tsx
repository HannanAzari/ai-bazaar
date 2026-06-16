"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ALL_PACK_STATUSES,
  CATEGORY_META,
  type AssetCandidate,
  type AssetPack,
  type AssetPackStatus,
} from "@/lib/types";
import { getCandidateRepository } from "@/lib/repo";
import { exportJson, exportPacksJson } from "@/lib/export";
import { slugify } from "@/lib/slug";
import { FactoryNav } from "@/components/factory-nav";

function download(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function PacksClient() {
  const repo = useMemo(() => getCandidateRepository(), []);
  const [candidates, setCandidates] = useState<AssetCandidate[]>([]);
  const [packs, setPacks] = useState<AssetPack[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newTheme, setNewTheme] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([repo.list(), repo.listPacks()]);
      setCandidates(c);
      setPacks(p);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    }
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const approved = useMemo(() => candidates.filter((c) => c.status === "approved"), [candidates]);
  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);

  const persist = useCallback(
    async (next: AssetPack) => {
      setPacks((prev) => {
        const exists = prev.some((p) => p.id === next.id);
        return exists ? prev.map((p) => (p.id === next.id ? next : p)) : [next, ...prev];
      });
      try {
        await repo.savePack(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed.");
        void refresh();
      }
    },
    [repo, refresh],
  );

  async function createPack() {
    const name = newName.trim();
    if (!name) return;
    const pack: AssetPack = {
      id: `pack-${slugify(name)}-${Date.now().toString(36)}`,
      slug: slugify(name),
      name,
      description: newDesc.trim(),
      theme: newTheme.trim() || "general",
      status: "draft",
      assetIds: [],
      createdAt: new Date().toISOString(),
    };
    setNewName("");
    setNewTheme("");
    setNewDesc("");
    setOpenId(pack.id);
    await persist(pack);
  }

  async function removePack(id: string) {
    if (!confirm("Delete this pack? (Assets are not affected.)")) return;
    setPacks((prev) => prev.filter((p) => p.id !== id));
    if (openId === id) setOpenId(null);
    try {
      await repo.deletePack(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
      void refresh();
    }
  }

  function toggleAsset(pack: AssetPack, candidateId: string) {
    const has = pack.assetIds.includes(candidateId);
    const assetIds = has ? pack.assetIds.filter((x) => x !== candidateId) : [...pack.assetIds, candidateId];
    void persist({ ...pack, assetIds });
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>🏭 Asset Packs</h1>
        <span className="spacer" />
        <span className={`pill ${repo.mode === "supabase" ? "approved" : "queued"}`}>
          {repo.mode === "supabase" ? "Shared" : "Local"}
        </span>
      </div>
      <FactoryNav />

      {error && <p className="error">⚠ {error}</p>}

      <div className="toolbar">
        <button className="btn" disabled={approved.length === 0} onClick={() => download("approved-assets.json", exportJson(candidates), "application/json")}>
          ⬇ Export approved JSON
        </button>
        <button className="btn" disabled={packs.length === 0} onClick={() => download("asset-packs.json", exportPacksJson(packs, candidates), "application/json")}>
          ⬇ Export packs JSON
        </button>
      </div>

      <div className="panel">
        <h3>Create a pack</h3>
        <div className="field">
          <label>Name</label>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Cozy Creator Pack" />
        </div>
        <div className="row">
          <div className="field">
            <label>Theme</label>
            <input type="text" value={newTheme} onChange={(e) => setNewTheme(e.target.value)} placeholder="cozy" />
          </div>
        </div>
        <div className="field">
          <label>Description</label>
          <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={createPack}>+ Create pack</button>
      </div>

      {packs.length === 0 ? (
        <p className="muted">No packs yet.</p>
      ) : (
        packs.map((pack) => {
          const open = openId === pack.id;
          const members = pack.assetIds.map((id) => byId.get(id)).filter((c): c is AssetCandidate => !!c);
          const approvedInPack = members.filter((c) => c.status === "approved").length;
          return (
            <div key={pack.id} className="panel">
              <div className="topbar" style={{ paddingTop: 0 }}>
                <h3>{pack.name}</h3>
                <span className="chip">{pack.theme}</span>
                <span className="spacer" />
                <span className="muted">{members.length} assets · {approvedInPack} approved</span>
              </div>
              {pack.description && <p className="muted" style={{ marginTop: 0 }}>{pack.description}</p>}

              <div className="toolbar">
                <select
                  value={pack.status}
                  onChange={(e) => void persist({ ...pack, status: e.target.value as AssetPackStatus })}
                  style={{ width: "auto" }}
                >
                  {ALL_PACK_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button className="btn" onClick={() => setOpenId(open ? null : pack.id)}>
                  {open ? "Close" : "Assign / view assets"}
                </button>
                <button className="btn btn-red" onClick={() => removePack(pack.id)}>Delete</button>
              </div>

              {open && (
                <div>
                  <div className="field">
                    <label>Name</label>
                    <input type="text" value={pack.name} onChange={(e) => void persist({ ...pack, name: e.target.value, slug: slugify(e.target.value) })} />
                  </div>
                  <div className="field">
                    <label>Description</label>
                    <input type="text" value={pack.description} onChange={(e) => void persist({ ...pack, description: e.target.value })} />
                  </div>
                  <p className="muted">Tap an approved asset to add/remove it from this pack.</p>
                  <div className="chips">
                    {approved.map((c) => {
                      const inPack = pack.assetIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          className={`chip ${inPack ? "active" : ""}`}
                          onClick={() => toggleAsset(pack, c.id)}
                          title={CATEGORY_META[c.category]?.label}
                        >
                          {inPack ? "✓ " : "+ "}{c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
