"use client";

import { useEffect, useState } from "react";
import { BookOpen, Eye, EyeOff, Flag, Trash2 } from "lucide-react";
import { useDemo } from "@/components/providers/demo-provider";
import { addEntry, deleteEntry, getEntries, setEntryHidden } from "@/lib/guestbook";
import { addNotification } from "@/lib/notifications";
import { recordActivity } from "@/lib/activity";
import { fileReport } from "@/lib/reports";
import { flags } from "@/lib/flags";
import type { GuestbookEntry, Shop } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

export function GuestbookPanel({ shop }: { shop: Shop }) {
  const { user, ownedShop } = useDemo();
  const isOwner = ownedShop?.address === shop.address;

  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setName(user?.name ?? "");
  }, [user]);

  useEffect(() => {
    const sync = () => setEntries(getEntries(shop.address));
    sync();
    window.addEventListener("ai-bazaar-guestbook-changed", sync);
    return () => window.removeEventListener("ai-bazaar-guestbook-changed", sync);
  }, [shop.address]);

  const sign = () => {
    if (!message.trim()) return;
    const entry = addEntry(shop.address, { name, message });
    // A note on your own house notifies you (the owner) — the production wiring.
    if (isOwner) {
      addNotification({
        type: "guestbook_entry",
        title: "Guestbook note",
        body: `${entry.name} signed your guestbook.`,
        href: `/shop/${shop.address}`,
      });
    }
    if (flags.activityFeed) {
      recordActivity({
        type: "guestbook_entry",
        actorName: entry.name,
        actorHandle: ownedShop?.ownerHandle ?? "guest",
        summary: `signed the guestbook at ${shop.name}`,
        href: `/shop/${shop.address}`,
      });
    }
    setMessage("");
  };

  const submitReport = (entry: GuestbookEntry) => {
    if (reason.trim().length < 3) return;
    fileReport({
      targetType: "guestbook",
      targetRef: shop.address,
      targetId: entry.id,
      targetLabel: `Note from ${entry.name}`,
      reason: reason.trim(),
    });
    setReportedIds((current) => new Set(current).add(entry.id));
    setReportingId(null);
    setReason("");
  };

  // Visitors only see visible notes; the owner sees everything, hidden ones dimmed.
  const visible = isOwner ? entries : entries.filter((entry) => !entry.hidden);

  return (
    <div className="card rounded-[1.75rem] p-5">
      <div className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-full bg-rosewater text-terracotta"><BookOpen size={17} /></span>
        <div>
          <p className="eyebrow text-terracotta">Guestbook</p>
          <p className="text-xs text-ink/45">{visible.length} note{visible.length === 1 ? "" : "s"} so far</p>
        </div>
      </div>

      {/* Sign the book */}
      <div className="mt-4 space-y-2 rounded-2xl bg-parchment/60 p-3">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          aria-label="Your name"
          className="min-h-10 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm outline-none focus:border-terracotta"
        />
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={2}
          maxLength={240}
          placeholder="Leave a kind note…"
          aria-label="Your note"
          className="w-full resize-none rounded-xl border border-ink/10 bg-white p-3 text-sm outline-none focus:border-terracotta"
        />
        <button
          onClick={sign}
          disabled={!message.trim()}
          className="w-full rounded-full bg-terracotta py-2.5 text-sm font-bold text-white transition hover:bg-[#9a4a30] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Sign the guestbook
        </button>
      </div>

      {/* Notes */}
      {visible.length > 0 && (
        <ul className="mt-4 space-y-3">
          {visible.map((entry) => (
            <li key={entry.id} className={cn("rounded-2xl border border-ink/5 bg-white p-3", entry.hidden && "opacity-50")}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-black">{entry.name} {entry.hidden && <span className="text-[10px] font-bold uppercase text-ink/40">· hidden</span>}</p>
                <span className="shrink-0 text-[11px] text-ink/35">{timeAgo(entry.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-ink/65">{entry.message}</p>

              <div className="mt-2 flex items-center gap-3 text-ink/40">
                {isOwner ? (
                  <>
                    <button onClick={() => setEntryHidden(shop.address, entry.id, !entry.hidden)} className="inline-flex items-center gap-1 text-[11px] font-bold hover:text-terracotta">
                      {entry.hidden ? <><Eye size={12} /> Unhide</> : <><EyeOff size={12} /> Hide</>}
                    </button>
                    <button onClick={() => deleteEntry(shop.address, entry.id)} className="inline-flex items-center gap-1 text-[11px] font-bold hover:text-terracotta">
                      <Trash2 size={12} /> Delete
                    </button>
                  </>
                ) : reportedIds.has(entry.id) ? (
                  <span className="text-[11px] font-bold text-teal">Reported</span>
                ) : (
                  <button onClick={() => { setReportingId(reportingId === entry.id ? null : entry.id); setReason(""); }} className="inline-flex items-center gap-1 text-[11px] font-bold hover:text-terracotta">
                    <Flag size={12} /> Report
                  </button>
                )}
              </div>

              {reportingId === entry.id && !isOwner && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="What's wrong with this note?"
                    aria-label="Report reason"
                    className="min-h-9 flex-1 rounded-lg border border-ink/10 bg-white px-2 text-xs outline-none focus:border-terracotta"
                  />
                  <button onClick={() => submitReport(entry)} disabled={reason.trim().length < 3} className="rounded-lg bg-terracotta px-3 text-xs font-bold text-white disabled:opacity-50">Send</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
