"use client";

import { useEffect, useState } from "react";
import { ArrowRight, DoorOpen, Map, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OnboardingOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!window.localStorage.getItem("ai-bazaar-world-seen")) setOpen(true);
  }, []);

  const close = () => {
    window.localStorage.setItem("ai-bazaar-world-seen", "true");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/30 p-5 backdrop-blur-sm">
      <div className="grain relative w-full max-w-md overflow-hidden rounded-[2.25rem] border border-white/70 bg-[#fff8e9] p-7 text-center shadow-2xl sm:p-9">
        <div className="absolute -right-14 -top-14 size-40 rounded-full bg-saffron/25 blur-3xl" />
        <span className="relative mx-auto grid size-14 place-items-center rounded-full bg-terracotta text-white shadow-lg"><Map size={24} /></span>
        <p className="eyebrow relative mt-5 text-terracotta">Welcome to the village</p>
        <h1 className="display relative mt-2 text-4xl leading-tight">Choose a village.<br />Claim a house.<br />Build your place.</h1>
        <div className="relative mt-7 grid grid-cols-3 gap-2 text-xs font-bold text-ink/55">
          <span className="rounded-2xl bg-white p-3"><Map className="mx-auto mb-2 text-teal" size={18} />Wander</span>
          <span className="rounded-2xl bg-white p-3"><DoorOpen className="mx-auto mb-2 text-terracotta" size={18} />Claim</span>
          <span className="rounded-2xl bg-white p-3"><Sparkles className="mx-auto mb-2 text-saffron" size={18} />Create</span>
        </div>
        <Button onClick={close} variant="accent" className="relative mt-7 w-full">Enter the village <ArrowRight size={17} /></Button>
      </div>
    </div>
  );
}
