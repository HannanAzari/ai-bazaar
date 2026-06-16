"use client";

import { useState } from "react";
import {
  ALL_CATEGORIES,
  CATEGORY_META,
  type AssetCandidate,
  type FactoryCategory,
} from "@/lib/types";
import {
  candidateFromImport,
  parseImportJson,
  validateImport,
  type ImportInput,
} from "@/lib/validation";

type Mode = "single" | "json";

export function ImportPanel({ onAdd }: { onAdd: (candidates: AssetCandidate[]) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("single");

  // Single-import fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState<FactoryCategory>("chair");
  const [imageUrl, setImageUrl] = useState("");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [transparent, setTransparent] = useState(true);
  const [tags, setTags] = useState("");

  // JSON import
  const [json, setJson] = useState("");

  const [feedback, setFeedback] = useState<string>("");

  function reset() {
    setName("");
    setImageUrl("");
    setTags("");
    setWidth(1024);
    setHeight(1024);
    setTransparent(true);
  }

  async function onFile(file: File) {
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
    setImageUrl(dataUrl);
    // Try to read natural dimensions.
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth) setWidth(img.naturalWidth);
      if (img.naturalHeight) setHeight(img.naturalHeight);
    };
    img.src = dataUrl;
  }

  function addSingle() {
    const input: ImportInput = {
      name,
      category,
      imageUrl,
      width,
      height,
      transparent,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    const result = validateImport(input);
    if (!result.ok) {
      setFeedback("✕ " + result.errors.join(" "));
      return;
    }
    onAdd([candidateFromImport(input)]);
    setFeedback(`✓ Added "${name}".` + (result.warnings.length ? ` (${result.warnings.length} warning(s))` : ""));
    reset();
  }

  function addJson() {
    const parsed = parseImportJson(json);
    if (!parsed.ok) {
      setFeedback("✕ " + parsed.error);
      return;
    }
    const valid: AssetCandidate[] = [];
    const errors: string[] = [];
    parsed.items.forEach((item, i) => {
      const result = validateImport(item);
      if (result.ok) valid.push(candidateFromImport(item));
      else errors.push(`Item ${i + 1}: ${result.errors.join(" ")}`);
    });
    if (valid.length) onAdd(valid);
    setFeedback(
      `${valid.length} imported.` + (errors.length ? ` ${errors.length} skipped — ${errors[0]}` : ""),
    );
    if (valid.length) setJson("");
  }

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + Import assets
      </button>
    );
  }

  return (
    <div className="panel">
      <div className="topbar" style={{ paddingTop: 0 }}>
        <h3>Import assets</h3>
        <span className="spacer" />
        <button className="btn" onClick={() => setOpen(false)}>
          Done
        </button>
      </div>

      <div className="chips" style={{ marginBottom: 10 }}>
        <button className={`chip ${mode === "single" ? "active" : ""}`} onClick={() => setMode("single")}>
          Upload / URL
        </button>
        <button className={`chip ${mode === "json" ? "active" : ""}`} onClick={() => setMode("json")}>
          Paste / bulk JSON
        </button>
      </div>

      {mode === "single" ? (
        <>
          <div className="field">
            <label>Upload PNG / WebP</label>
            <input
              type="file"
              accept="image/png,image/webp"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </div>
          <div className="field">
            <label>…or paste image URL (.png / .webp)</label>
            <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…/asset.png" />
          </div>
          <div className="field">
            <label>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as FactoryCategory)}>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].label} ({CATEGORY_META[c].group})
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <div className="field">
              <label>Width</label>
              <input type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Height</label>
              <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
            </div>
          </div>
          <div className="field">
            <label>
              <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} /> Transparent background
            </label>
          </div>
          <div className="field">
            <label>Tags (comma-separated)</label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={addSingle}>
            Add to review queue
          </button>
        </>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Paste a single object or an array. Each item: {"{ name, category, imageUrl, width, height, transparent?, tags? }"}.
          </p>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder='[{ "name": "Cozy Lamp", "category": "lamp", "imageUrl": "https://…/lamp.png", "width": 1024, "height": 1024, "tags": ["lamp"] }]'
          />
          <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={addJson}>
            Import JSON
          </button>
        </>
      )}

      {feedback && <p className={feedback.startsWith("✕") ? "error" : "muted"}>{feedback}</p>}
    </div>
  );
}
