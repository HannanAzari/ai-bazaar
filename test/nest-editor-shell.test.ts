import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ── M26 Stabilisation Sprint 1 — shell, lifecycle, Connect, Mirror ───────────
//
// Two real defects, both found by reproducing the UI path rather than by reading:
//
//  • CONNECT TRAP — Connect was `mode === "interact"`, and nothing reset it.
//  • MIRROR DEAD TO A FINGER — the camera captured the pointer for every tap that bubbled
//    to the viewport, including taps on the object toolbar, so `click` never fired.

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const editor = read("components", "nest", "editor", "nest-editor.tsx");
const canvas = read("components", "nest", "editor", "editor-canvas.tsx");
const camera = read("components", "nest", "app-shell", "use-scene-camera.ts");
const selection = read("components", "nest", "editor", "screen-space-selection.tsx");

const stripComments = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");

// ── §6 — the Mirror root cause ───────────────────────────────────────────────

describe("§6 — a tap on editor chrome is never claimed by the camera", () => {
  it("the camera bails out before tracking or capturing a chrome pointer", () => {
    // THE BUG: `viewport.setPointerCapture(pointerId)` retargets every later event for
    // that pointer — including pointerup — to the viewport. With no pointerup on the
    // button, the browser never synthesises `click`, so onClick never ran. Mirror,
    // Duplicate, Layer, Connect, Lock and Delete were all dead to a finger.
    expect(camera).toContain('if (e.target instanceof Element && e.target.closest("[data-editor-chrome]")) return;');
    // The guard must come BEFORE both the tracking and the capture, or it fixes nothing.
    // Compared on CODE with comments stripped — the explanatory block above the guard is
    // long, and comparing raw offsets would measure prose, not order.
    const down = stripComments(camera.slice(camera.indexOf("const onPointerDown"), camera.indexOf("const onPointerMove")));
    expect(down.indexOf("data-editor-chrome")).toBeGreaterThan(-1);
    expect(down.indexOf("data-editor-chrome")).toBeLessThan(down.indexOf("points.set"));
    expect(down.indexOf("data-editor-chrome")).toBeLessThan(down.indexOf("setPointerCapture"));
  });

  it("every screen-space control is marked as chrome", () => {
    // Fixed centrally so a NEW control cannot forget. Previously the Reset button carried
    // its own stopPropagation and the object toolbar simply never did.
    expect(selection).toContain('data-editor-chrome=""');
    expect(canvas).toContain('data-editor-chrome=""');
  });

  it("why the suite missed it: a programmatic click bypasses the pointer pipeline", () => {
    // Recorded so nobody "verifies" this with .click() again. A real tap is
    // pointerdown → pointerup → click; `.click()` dispatches only the last one, so capture
    // is irrelevant and the button always appears to work.
    expect(camera).toContain("never synthesises `click`");
  });
});

// ── §4 — Connect is an action, not a mode ────────────────────────────────────

describe("§4 — Connect cannot trap the editor", () => {
  it('the "interact" mode is gone from the Mode union', () => {
    // ROOT CAUSE: `mode === "interact"` was never reset. Selecting another object left the
    // mode set so the sheet re-rendered for the new object, and closing it cleared the
    // SELECTION while leaving the mode — stranding the editor in an empty
    // "tap an object to connect" state with no way back.
    expect(stripComments(editor)).not.toContain('"interact"');
    expect(editor).toContain('type Mode = "arrange" | "assets" | "connect" | "focus" | "surface" | "preview";');
  });

  it("it is a sheet keyed to ONE object id", () => {
    expect(editor).toContain("const [connectFor, setConnectFor] = useState<string | null>(null);");
    expect(editor).toContain("onConnect={() => selectedId && setConnectFor(selectedId)}");
  });

  it("selecting a different object closes it", () => {
    expect(editor).toContain("if (id !== connectFor) setConnectFor(null);");
  });

  it("switching to Preview closes it", () => {
    expect(editor).toContain("setConnectFor(null); // §4");
  });

  it("closing returns to Edit and KEEPS the selection", () => {
    // The old close cleared selectedId, which is how the creator lost the object they were
    // working on and landed in the empty state.
    expect(editor).toContain("onClose={() => setConnectFor(null)}");
  });

  it("a deleted object cannot leave its sheet open", () => {
    // Derived against the live document rather than held as independent state.
    expect(editor).toContain("activeDoc.objects.find((o) => o.instanceId === connectFor)");
    expect(editor).toContain("if (!target) return null;");
  });

  it("there is no empty 'tap an object to connect' state left to be stuck in", () => {
    expect(editor).not.toContain("Tap an object to set what happens when someone taps it");
  });

  it("Connect is capability-driven, not hard-coded per asset", () => {
    expect(canvas).toContain("capabilitiesForAsset(o.assetId)?.accepts.length");
    // No asset ids in the JSX condition.
    const bar = canvas.slice(canvas.indexOf("function ContextBar"));
    expect(bar).not.toContain('"ast-tv"');
    expect(bar).not.toContain('"ast-desk"');
  });
});

// ── §1/§2 — the lifecycle ────────────────────────────────────────────────────

describe("§1/§2 — saving happens on the way out", () => {
  it("the dock has no Save button", () => {
    const dock = editor.slice(editor.indexOf("<nav"), editor.indexOf("</nav>"));
    expect(dock).not.toContain('label="Save"');
    expect(dock).toContain('label="Assets"');
    expect(dock).toContain("setShowPublish(true)");
  });

  it("the top-left control is Close, not Back", () => {
    const header = stripComments(editor.slice(editor.indexOf("<header"), editor.indexOf("</header>")));
    expect(header).toContain('aria-label="Close editor"');
    expect(header).not.toContain('aria-label="Back to Profile"');
    expect(header).toContain("onClick={requestClose}");
  });

  it("a clean editor closes immediately", () => {
    expect(editor).toContain('if (!isDirty()) { window.location.href = "/profile"; return; }');
  });

  it("unsaved work offers exactly three choices, and never publishes", () => {
    const sheet = editor.slice(editor.indexOf("{closeAsk ?"));
    expect(sheet).toContain("Save draft");
    expect(sheet).toContain("Close without saving");
    expect(sheet).toContain("Cancel");
    expect(sheet.slice(0, 2200)).not.toContain("Publish");
  });

  it("Save Draft WAITS for persistence before navigating", () => {
    // A failed save must not silently discard the session.
    expect(editor).toContain("await saveNow();");
    expect(editor).toContain('window.location.href = "/profile";');
    expect(editor).toContain("setClosing(null);");
  });

  it("discarding drops only changes since the last persisted state", () => {
    expect(editor).toContain("if (documentId) clearDraft(documentId);");
  });
});

// ── §7 — dirty state ─────────────────────────────────────────────────────────

describe("§7 — one dirty-state source of truth", () => {
  it("dirtiness is the live document compared against the last persisted snapshot", () => {
    // Every edit goes through `commit()`, so this catches move/resize/rotate/mirror/
    // add/delete/layer/text/sticker/interaction/background without each remembering a flag.
    expect(editor).toContain("function dirtyKey(d: EditableNestDocument): string");
    expect(editor).toContain("persistedRef.current !== dirtyKey(doc)");
  });

  it("the key covers every creator-editable field", () => {
    const fn = editor.slice(editor.indexOf("function dirtyKey"), editor.indexOf("export function NestEditor"));
    for (const field of ["name", "backgroundId", "objects", "focusAreas", "detailScenes"]) {
      expect(fn).toContain(field);
    }
  });

  it("camera, selection and sheet state cannot make a Nest dirty", () => {
    const fn = editor.slice(editor.indexOf("function dirtyKey"), editor.indexOf("export function NestEditor"));
    for (const notData of ["camera", "selectedId", "connectFor", "zoom"]) {
      expect(fn).not.toContain(notData);
    }
  });

  it("a successful save and a publish both clear it", () => {
    expect(editor).toContain("persistedRef.current = dirtyKey(doc); // §7");
    // M26-S2 §0 also records the persisted DOCUMENT here, so "Close without saving" has
    // something to roll back to (a debounced autosave has already written the change).
    expect(editor).toContain("onClose={() => { persistedRef.current = dirtyKey(doc); persistedDocRef.current = doc; setShowPublish(false); }}");
  });
});

// ── §3 — one stable Edit/Preview control ─────────────────────────────────────

describe("§3 — exactly one Edit/Preview control", () => {
  it("it is rendered by ONE component, in both modes", () => {
    expect(editor).toContain("function ModeSwitch(");
    expect((editor.match(/<ModeSwitch /g) ?? []).length).toBe(2); // Edit header + Preview
  });

  it("the header holds no workflow buttons that could push it off-screen", () => {
    const header = stripComments(editor.slice(editor.indexOf("<header"), editor.indexOf("</header>")));
    expect(header).toContain("<ModeSwitch");
    expect(header).not.toContain("setShowPublish");
  });

  it('the "exactly what visitors see" copy no longer competes with it', () => {
    expect(editor).not.toContain("Exactly what visitors see");
  });
});
