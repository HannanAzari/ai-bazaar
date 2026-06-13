"use client";

import { Plus, X } from "lucide-react";
import type { ContactSocial, GalleryImage, RoomActionData, RoomActionType } from "@/lib/types";

// Per-action field editor shown in the studio inspector so owners can configure
// real interactive objects (gallery images, video URL, product, contact, etc.).
// Controlled: it never holds state — it reflects `data` and emits the next
// `RoomActionData` on every change.

const labelCls = "block text-xs font-black uppercase tracking-wider text-ink/45";
const inputCls = "mt-1.5 min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal";

export function ActionDataEditor({
  actionType,
  data,
  onChange,
  rooms,
}: {
  actionType: RoomActionType;
  data: RoomActionData;
  onChange: (next: RoomActionData) => void;
  /** For `room_link`: the rooms a door/stairs object may target (excludes self). */
  rooms?: { id: string; name: string }[];
}) {
  const set = (patch: Partial<RoomActionData>) => onChange({ ...data, ...patch });

  if (actionType === "room_link") {
    const targets = rooms ?? [];
    return (
      <label className={labelCls}>Go to room
        <select value={data.targetRoomId ?? ""} onChange={(e) => set({ targetRoomId: e.target.value || undefined })} className="mt-1.5 min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink">
          <option value="">— pick a room —</option>
          {targets.map((room) => (
            <option key={room.id} value={room.id}>{room.name}</option>
          ))}
        </select>
        {targets.length === 0 && <span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-ink/45">Add another room first, then point this door at it.</span>}
      </label>
    );
  }

  if (actionType === "link") {
    return (
      <div className="space-y-3">
        <Field label="Title"><input value={data.title ?? ""} onChange={(e) => set({ title: e.target.value })} placeholder="What is this link?" className={inputCls} /></Field>
        <Field label="URL"><input value={data.url ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" className={inputCls} /></Field>
        <Field label="Description"><input value={data.description ?? ""} onChange={(e) => set({ description: e.target.value })} placeholder="A short line about it" className={inputCls} /></Field>
      </div>
    );
  }

  if (actionType === "video") {
    return (
      <div className="space-y-3">
        <Field label="YouTube / Vimeo URL"><input value={data.url ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder="https://youtube.com/watch?v=…" className={inputCls} /></Field>
        <Field label="Caption (optional)"><input value={data.text ?? ""} onChange={(e) => set({ text: e.target.value })} placeholder="A line about the video" className={inputCls} /></Field>
      </div>
    );
  }

  if (actionType === "product") {
    return (
      <div className="space-y-3">
        <Field label="Image URL"><input value={data.image ?? ""} onChange={(e) => set({ image: e.target.value })} placeholder="https://…/product.jpg" className={inputCls} /></Field>
        <Field label="Title"><input value={data.title ?? ""} onChange={(e) => set({ title: e.target.value })} placeholder="Product name" className={inputCls} /></Field>
        <Field label="Price"><input value={data.price ?? ""} onChange={(e) => set({ price: e.target.value })} placeholder="$28" className={inputCls} /></Field>
        <Field label="Link (opens externally)"><input value={data.url ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" className={inputCls} /></Field>
      </div>
    );
  }

  if (actionType === "booking") {
    return (
      <div className="space-y-3">
        <Field label="Calendly / booking URL"><input value={data.url ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder="https://calendly.com/…" className={inputCls} /></Field>
        <Field label="Note (optional)"><input value={data.text ?? ""} onChange={(e) => set({ text: e.target.value })} placeholder="What can visitors book?" className={inputCls} /></Field>
      </div>
    );
  }

  if (actionType === "contact") {
    const socials = data.socials ?? [];
    const setSocial = (i: number, patch: Partial<ContactSocial>) =>
      set({ socials: socials.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
    return (
      <div className="space-y-3">
        <Field label="Email"><input value={data.email ?? ""} onChange={(e) => set({ email: e.target.value })} placeholder="you@example.com" className={inputCls} /></Field>
        <Field label="Website"><input value={data.website ?? ""} onChange={(e) => set({ website: e.target.value })} placeholder="example.com" className={inputCls} /></Field>
        <Field label="Phone"><input value={data.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} placeholder="+1 555 0100" className={inputCls} /></Field>
        <div>
          <p className={labelCls}>Socials</p>
          <div className="mt-1.5 space-y-2">
            {socials.map((social, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input value={social.label} onChange={(e) => setSocial(i, { label: e.target.value })} placeholder="Label" className="min-h-10 w-24 rounded-xl border border-ink/10 bg-white px-2 text-sm normal-case tracking-normal" />
                <input value={social.url} onChange={(e) => setSocial(i, { url: e.target.value })} placeholder="https://…" className="min-h-10 min-w-0 flex-1 rounded-xl border border-ink/10 bg-white px-2 text-sm normal-case tracking-normal" />
                <button onClick={() => set({ socials: socials.filter((_, idx) => idx !== i) })} aria-label="Remove social" className="grid size-8 shrink-0 place-items-center rounded-lg border border-rose-200 text-terracotta hover:bg-rose-50"><X size={13} /></button>
              </div>
            ))}
          </div>
          <button onClick={() => set({ socials: [...socials, { label: "", url: "" }] })} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[11px] font-bold text-ink/60 hover:border-terracotta hover:text-terracotta"><Plus size={13} /> Add social</button>
        </div>
      </div>
    );
  }

  if (actionType === "gallery") {
    const images = data.images ?? [];
    const setImage = (i: number, patch: Partial<GalleryImage>) =>
      set({ images: images.map((img, idx) => (idx === i ? { ...img, ...patch } : img)) });
    return (
      <div>
        <p className={labelCls}>Images</p>
        <div className="mt-1.5 space-y-2">
          {images.map((image, i) => (
            <div key={i} className="space-y-1.5 rounded-xl border border-ink/10 bg-white p-2">
              <div className="flex items-center gap-1.5">
                <input value={image.src} onChange={(e) => setImage(i, { src: e.target.value })} placeholder="https://…/image.jpg" className="min-h-9 min-w-0 flex-1 rounded-lg border border-ink/10 bg-white px-2 text-sm normal-case tracking-normal" />
                <button onClick={() => set({ images: images.filter((_, idx) => idx !== i) })} aria-label="Remove image" className="grid size-8 shrink-0 place-items-center rounded-lg border border-rose-200 text-terracotta hover:bg-rose-50"><X size={13} /></button>
              </div>
              <input value={image.caption ?? ""} onChange={(e) => setImage(i, { caption: e.target.value })} placeholder="Caption (optional)" className="min-h-9 w-full rounded-lg border border-ink/10 bg-white px-2 text-sm normal-case tracking-normal" />
            </div>
          ))}
        </div>
        <button onClick={() => set({ images: [...images, { src: "", caption: "" }] })} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-ink/10 px-2.5 py-1.5 text-[11px] font-bold text-ink/60 hover:border-terracotta hover:text-terracotta"><Plus size={13} /> Add image</button>
      </div>
    );
  }

  if (actionType === "profile") {
    return <p className="rounded-xl border border-dashed border-ink/15 bg-white/50 p-3 text-xs text-ink/55">This object shows your creator profile, followers, and recent activity. Nothing to set here.</p>;
  }

  return null; // guestbook / collection / none need no data
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={labelCls}>
      {label}
      {children}
    </label>
  );
}
