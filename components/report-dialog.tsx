"use client";

import { useState } from "react";
import { Check, Flag, X } from "lucide-react";
import { fileReport } from "@/lib/reports";
import type { ReportTargetType, Shop } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * One dialog covers all three report kinds the platform supports:
 * the house, its owner, or a specific decoration inside it.
 */
export function ReportButton({ shop }: { shop: Shop }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [targetType, setTargetType] = useState<ReportTargetType>("house");
  const [decorationId, setDecorationId] = useState(shop.decorations[0]?.id ?? "");
  const [reason, setReason] = useState("");

  const submit = () => {
    if (reason.trim().length < 3) return;
    if (targetType === "house") {
      fileReport({ targetType: "house", targetRef: shop.address, targetLabel: shop.name, reason: reason.trim() });
    } else if (targetType === "user") {
      fileReport({ targetType: "user", targetRef: shop.ownerHandle, targetLabel: shop.owner, reason: reason.trim() });
    } else {
      const deco = shop.decorations.find((item) => item.id === decorationId);
      fileReport({ targetType: "decoration", targetRef: shop.address, targetId: decorationId, targetLabel: deco?.title ?? "Decoration", reason: reason.trim() });
    }
    setDone(true);
    window.setTimeout(() => {
      setOpen(false);
      setDone(false);
      setReason("");
    }, 1400);
  };

  const targets: { id: ReportTargetType; label: string; disabled?: boolean }[] = [
    { id: "house", label: "This house" },
    { id: "decoration", label: "An item", disabled: shop.decorations.length === 0 },
    { id: "user", label: "The owner" },
  ];

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2 py-3 text-xs font-bold text-ink/35 hover:text-terracotta">
        <Flag size={14} /> Report this place
      </button>

      {open && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-ink/35 p-5 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-[2rem] border border-white/70 bg-[#fff8e9] p-7 shadow-2xl">
            <button onClick={() => setOpen(false)} className="absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-white" aria-label="Close report dialog">
              <X size={17} />
            </button>

            {done ? (
              <div className="py-8 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-teal/15 text-teal"><Check size={24} /></span>
                <h2 className="display mt-4 text-2xl">Report received.</h2>
                <p className="mt-2 text-sm text-ink/55">A steward will review it. Thank you for keeping the village kind.</p>
              </div>
            ) : (
              <>
                <p className="eyebrow text-terracotta">Report</p>
                <h2 className="display mt-1 text-3xl">What feels wrong here?</h2>

                <div className="mt-5 flex gap-2">
                  {targets.map((target) => (
                    <button
                      key={target.id}
                      disabled={target.disabled}
                      onClick={() => setTargetType(target.id)}
                      className={cn(
                        "flex-1 rounded-xl border px-3 py-2.5 text-xs font-black transition disabled:opacity-40",
                        targetType === target.id ? "border-terracotta bg-terracotta text-white" : "border-ink/10 bg-white text-ink/55",
                      )}
                    >
                      {target.label}
                    </button>
                  ))}
                </div>

                {targetType === "decoration" && shop.decorations.length > 0 && (
                  <select
                    value={decorationId}
                    onChange={(event) => setDecorationId(event.target.value)}
                    aria-label="Which item"
                    className="mt-3 min-h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm"
                  >
                    {shop.decorations.map((item) => (
                      <option key={item.id} value={item.id}>{item.title}</option>
                    ))}
                  </select>
                )}

                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={4}
                  placeholder="Tell us what's going on…"
                  aria-label="Reason"
                  className="mt-3 w-full resize-none rounded-xl border border-ink/10 bg-white p-3 text-sm outline-none focus:border-terracotta"
                />

                <button
                  onClick={submit}
                  disabled={reason.trim().length < 3}
                  className="mt-4 w-full rounded-full bg-terracotta py-3 text-sm font-bold text-white transition hover:bg-[#9a4a30] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send report
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
