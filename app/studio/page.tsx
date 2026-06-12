"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Armchair, CheckCircle2, DoorOpen, ExternalLink, Eye, Flower2, Home, ImagePlus, Layers3, Link2, LoaderCircle, Palette, Signpost, Sparkles, StepForward, Tags, TreePine, Type, WandSparkles } from "lucide-react";
import { useDemo } from "@/components/providers/demo-provider";
import { ShopRoom } from "@/components/shop-room";
import { TagInput } from "@/components/tags-ui";
import { Button, ButtonLink } from "@/components/ui/button";
import { recordActivity } from "@/lib/activity";
import { flags } from "@/lib/flags";
import type { Decoration, HouseExterior, RoomZone } from "@/lib/types";
import { cn } from "@/lib/utils";

const zones: { id: RoomZone; label: string }[] = [
  { id: "left-wall", label: "Left wall" },
  { id: "back-wall", label: "Back wall" },
  { id: "floor", label: "Floor" },
  { id: "right-wall", label: "Right wall" },
];

const exteriorColors: Record<string, string> = {
  terracotta: "from-[#e4a36f] to-[#bd684f]",
  sage: "from-[#b9cbb5] to-[#75947d]",
  rose: "from-[#e2b2b2] to-[#b8757b]",
  cobalt: "from-[#9eb9d4] to-[#59779a]",
  honey: "from-[#e8cf8e] to-[#bd9148]",
};

function ExteriorPreview({ exterior }: { exterior: HouseExterior }) {
  const roofShape = exterior.roofStyle === "gable" ? "[clip-path:polygon(50%_0,100%_100%,0_100%)]" : exterior.roofStyle === "stepped" ? "[clip-path:polygon(8%_100%,8%_70%,22%_70%,22%_45%,38%_45%,38%_20%,62%_20%,62%_45%,78%_45%,78%_70%,92%_70%,92%_100%)]" : exterior.roofStyle === "mansard" ? "[clip-path:polygon(14%_100%,23%_0,77%_0,86%_100%)]" : "rounded-t-full";
  return (
    <div className="street-sky relative min-h-[650px] overflow-hidden rounded-[2.75rem] border-[10px] border-white/65">
      <div className="absolute inset-x-0 bottom-0 h-[34%] bg-[#94ad7e]" />
      <div className="street-cobbles absolute inset-x-0 bottom-0 h-[12%] opacity-60" />
      <div className="absolute bottom-[9%] left-1/2 h-[26%] w-[72%] -translate-x-1/2 rounded-[48%] border border-white/40 bg-gradient-to-b from-[#bdd4a6] to-[#78946e] shadow-xl">
        <div className="absolute bottom-0 left-1/2 h-[90%] w-16 -translate-x-1/2 bg-[#d9c39a] [clip-path:polygon(35%_0,65%_0,100%_100%,0_100%)]" />
        {exterior.gardenStyle === "small-tree" ? <TreePine className="absolute bottom-12 left-8 text-emerald-800" size={54} fill="currentColor" /> : <Flower2 className="absolute bottom-12 left-10 text-rose-600" size={36} />}
        {exterior.gardenStyle !== "minimal" && <Flower2 className="absolute bottom-10 right-10 text-amber-500" size={29} />}
        {/* Owner-controlled today; this plot board can later become a community or sponsored board. */}
        <div className="absolute bottom-12 right-8">
          <span className="block min-w-24 rotate-2 rounded border-2 border-[#755039] bg-[#f7dfaa] px-3 py-2 text-center text-xs font-black">{exterior.signText || "Welcome in"}</span>
          <span className="mx-auto block h-12 w-1.5 bg-[#755039]" />
        </div>
      </div>
      <div className={cn("absolute bottom-[24%] left-1/2 h-[55%] w-[min(56%,330px)] -translate-x-1/2 border-[9px] border-[#f7e7c8] bg-gradient-to-b shadow-2xl", exteriorColors[exterior.color] ?? exteriorColors.terracotta, exterior.roofStyle === "round" ? "rounded-t-[7rem]" : "rounded-t-md")}>
        <div className={cn("absolute -left-[10%] -right-[10%] -top-[18%] h-[20%] bg-[#65433d]", roofShape)} />
        <div className="absolute left-[12%] top-[28%] h-24 w-16 rounded-t-3xl border-[6px] border-white/65 bg-sky-100/80">
          <span className="absolute left-1/2 h-full w-px bg-white" />
          <span className="absolute top-1/2 h-px w-full bg-white" />
        </div>
        <div className="absolute right-[12%] top-[28%] h-24 w-16 rounded-full border-[6px] border-white/65 bg-sky-100/80" />
        <div className="absolute bottom-0 left-1/2 h-[43%] w-24 -translate-x-1/2 rounded-t-[3rem] border-[6px] border-white/55 bg-ink/80"><span className="absolute right-3 top-1/2 size-2 rounded-full bg-saffron" /></div>
        {exterior.decoration && <div className="absolute inset-x-5 bottom-5 rounded-full bg-white/70 px-3 py-2 text-center text-xs font-bold">{exterior.decoration}</div>}
      </div>
    </div>
  );
}

export default function StudioPage() {
  const router = useRouter();
  const { user, ownedShop, jobs, addDecoration, updateShop, addShopLink, setShopTags, setDecorationTags, setLinkTags, createGeneration } = useDemo();
  const [prompt, setPrompt] = useState("");
  const [notice, setNotice] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [mode, setMode] = useState<"interior" | "exterior">("interior");
  const [selectedZone, setSelectedZone] = useState<RoomZone>("floor");

  if (!user) return <section className="shell grid min-h-[70vh] place-items-center py-12 text-center"><div className="card max-w-md rounded-4xl p-9"><WandSparkles className="mx-auto text-terracotta" /><h1 className="display mt-4 text-4xl">Your place is waiting.</h1><p className="mt-3 text-ink/55">Log in, claim a house, and begin shaping your place.</p><ButtonLink href="/auth/login" variant="accent" className="mt-6">Log in</ButtonLink></div></section>;
  if (!ownedShop) return <section className="shell grid min-h-[70vh] place-items-center py-12 text-center"><div className="card max-w-md rounded-4xl p-9"><Home className="mx-auto text-teal" /><h1 className="display mt-4 text-4xl">First, choose a house.</h1><p className="mt-3 text-ink/55">Wander the village and claim one open home to make your own.</p><ButtonLink href="/" variant="accent" className="mt-6">Return to the village</ButtonLink></div></section>;

  const exterior: HouseExterior = ownedShop.exterior ?? { color: "terracotta", roofStyle: "gable", gardenStyle: "wildflowers", signText: "Welcome in" };
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 1800); };
  const updateExterior = (updates: Partial<HouseExterior>) => updateShop({ exterior: { ...exterior, ...updates } });

  const addQuickDecoration = (type: Decoration["type"]) => {
    const templates: Record<Decoration["type"], Decoration> = {
      text: { id: `text-${Date.now()}`, type: "text", title: "A note from home", content: "Write something small and memorable here.", zone: selectedZone },
      image: { id: `image-${Date.now()}`, type: "image", title: "Uploaded image", content: "Local image placeholder. Connect storage for a real file.", palette: "from-sky-200 via-rose-100 to-amber-200", zone: selectedZone },
      "ai-image": { id: `ai-${Date.now()}`, type: "ai-image", title: "AI decoration", content: "Describe this object using the helper.", palette: "from-amber-200 to-teal-200", zone: selectedZone },
      link: { id: `link-${Date.now()}`, type: "link", title: "A link from this room", content: "A link card ready for its destination.", zone: selectedZone },
      furniture: { id: `furniture-${Date.now()}`, type: "furniture", title: "Cosy chair", content: "Furniture placeholder ready to arrange.", palette: "from-amber-200 to-orange-300", zone: selectedZone },
    };
    addDecoration(templates[type]);
    flash(`Added to ${zones.find((zone) => zone.id === selectedZone)?.label.toLowerCase()}`);
  };

  const submitGeneration = (event: FormEvent) => {
    event.preventDefault();
    if (!prompt.trim()) return;
    createGeneration(prompt.trim(), selectedZone);
    setPrompt("");
  };

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextName = String(form.get("name") ?? ownedShop.name);
    updateShop({ name: nextName, tagline: String(form.get("tagline") ?? ownedShop.tagline), bio: String(form.get("bio") ?? ownedShop.bio) });
    if (flags.activityFeed) recordActivity({ type: "updated_house", actorName: ownedShop.owner, actorHandle: ownedShop.ownerHandle, summary: `updated ${nextName}`, href: `/shop/${ownedShop.address}` });
    setProfileOpen(false);
    flash("Place details updated");
  };

  const saveLink = (event: FormEvent) => {
    event.preventDefault();
    if (!linkLabel.trim() || !linkUrl.trim()) return;
    addShopLink({ id: `link-${Date.now()}`, label: linkLabel.trim(), url: linkUrl.trim(), kind: "external" });
    setLinkLabel(""); setLinkUrl(""); flash("Link added");
  };

  return (
    <section className="shell py-5 sm:py-8">
      <div className="mb-5 flex flex-col gap-4 rounded-[2rem] bg-ink p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="eyebrow text-saffron">Your house · Published</p>
          <h1 className="display mt-1 text-3xl sm:text-4xl">{ownedShop.name}</h1>
          <p className="mt-1 text-xs text-white/45">{ownedShop.address} · House {ownedShop.slotNumber}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="accent" onClick={() => router.push(`/shop/${ownedShop.address}`)}><Eye size={16} /> Enter place</Button>
          <Button variant="outline" className="border-white/15 bg-white/10 text-white hover:bg-white/20" onClick={() => router.push(`/bazaar/${ownedShop.bazaarId}`)}>Walk outside <ExternalLink size={15} /></Button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-full bg-white/70 p-1 shadow-sm">
          <button onClick={() => setMode("exterior")} className={cn("flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-black", mode === "exterior" ? "bg-terracotta text-white" : "text-ink/50")}><Home size={16} /> Exterior</button>
          <button onClick={() => setMode("interior")} className={cn("flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-black", mode === "interior" ? "bg-ink text-white" : "text-ink/50")}><DoorOpen size={16} /> Interior</button>
        </div>
        <span className="flex items-center gap-2 text-xs font-bold text-emerald-700"><CheckCircle2 size={15} /> Changes save locally</span>
      </div>

      {mode === "exterior" ? (
        <div className="grid items-start gap-6 xl:grid-cols-[330px_1fr]">
          <aside className="card space-y-5 rounded-[2rem] p-5 xl:sticky xl:top-20">
            <div><p className="eyebrow text-terracotta">Your plot</p><h2 className="mt-1 text-xl font-black">Shape the outside</h2><p className="mt-1 text-sm text-ink/45">A detached home with its own garden and sign.</p></div>
            <label className="block text-xs font-black uppercase tracking-wider text-ink/45">House colour<select value={exterior.color} onChange={(event) => updateExterior({ color: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink"><option value="terracotta">Terracotta</option><option value="sage">Sage</option><option value="rose">Dusty rose</option><option value="cobalt">Cobalt</option><option value="honey">Honey</option></select></label>
            <label className="block text-xs font-black uppercase tracking-wider text-ink/45">Roof style<select value={exterior.roofStyle} onChange={(event) => updateExterior({ roofStyle: event.target.value as HouseExterior["roofStyle"] })} className="mt-2 min-h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink"><option value="gable">Gable</option><option value="stepped">Stepped</option><option value="mansard">Mansard</option><option value="round">Round</option></select></label>
            <label className="block text-xs font-black uppercase tracking-wider text-ink/45">Garden style<select value={exterior.gardenStyle} onChange={(event) => updateExterior({ gardenStyle: event.target.value as HouseExterior["gardenStyle"] })} className="mt-2 min-h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink"><option value="wildflowers">Wildflowers</option><option value="herbs">Herb garden</option><option value="small-tree">Small tree</option><option value="minimal">Simple lawn</option></select></label>
            <label className="block text-xs font-black uppercase tracking-wider text-ink/45"><span className="flex items-center gap-2"><Signpost size={14} /> Plot sign</span><input value={exterior.signText} onChange={(event) => updateExterior({ signText: event.target.value.slice(0, 24) })} className="mt-2 min-h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink" /></label>
            <label className="block text-xs font-black uppercase tracking-wider text-ink/45">Exterior decoration<input value={exterior.decoration ?? ""} onChange={(event) => updateExterior({ decoration: event.target.value })} placeholder="Lanterns by the door" className="mt-2 min-h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm normal-case tracking-normal text-ink" /></label>
          </aside>
          <ExteriorPreview exterior={exterior} />
        </div>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-20">
            <div className="card rounded-[2rem] p-5">
              <p className="eyebrow text-teal">Place an item</p>
              <h2 className="mt-1 font-black">Choose a room zone</h2>
              <div className="mt-4 grid grid-cols-2 gap-2">{zones.map((zone) => <button key={zone.id} onClick={() => setSelectedZone(zone.id)} className={cn("rounded-xl border px-3 py-3 text-xs font-black", selectedZone === zone.id ? "border-terracotta bg-terracotta text-white" : "border-ink/10 bg-white text-ink/55")}>{zone.label}</button>)}</div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => addQuickDecoration("text")} className="rounded-2xl bg-white p-3 text-left text-xs font-bold shadow-sm"><Type size={18} className="mb-2 text-terracotta" />Add text</button>
                <button onClick={() => addQuickDecoration("link")} className="rounded-2xl bg-white p-3 text-left text-xs font-bold shadow-sm"><Link2 size={18} className="mb-2 text-indigo-600" />Add link</button>
                <button onClick={() => addQuickDecoration("image")} className="rounded-2xl bg-white p-3 text-left text-xs font-bold shadow-sm"><ImagePlus size={18} className="mb-2 text-teal" />Add image</button>
                <button onClick={() => document.getElementById("ai-helper")?.focus()} className="rounded-2xl bg-ink p-3 text-left text-xs font-bold text-white shadow-sm"><Sparkles size={18} className="mb-2 text-saffron" />AI decoration</button>
                <button onClick={() => addQuickDecoration("furniture")} className="col-span-2 rounded-2xl bg-amber-100 p-3 text-left text-xs font-bold shadow-sm"><Armchair size={18} className="mb-2 text-terracotta" />Add furniture placeholder</button>
              </div>
              {notice && <p className="mt-3 text-center text-xs font-bold text-teal">{notice}</p>}
            </div>

            <form onSubmit={submitGeneration} className="grain overflow-hidden rounded-[2rem] bg-gradient-to-br from-ink to-[#4b2d29] p-5 text-white shadow-lift">
              <div className="flex items-center gap-2 text-saffron"><WandSparkles size={17} /><span className="text-xs font-black uppercase tracking-[.15em]">AI room helper · Mock</span></div>
              <textarea id="ai-helper" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={'Try “Add a couch near the left wall”'} rows={4} className="mt-4 w-full resize-none rounded-2xl border border-white/10 bg-white/10 p-4 text-sm outline-none placeholder:text-white/35 focus:border-saffron" />
              <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] text-white/45"><span>Hang a painting above the table</span><span>·</span><span>Add a wooden staircase</span></div>
              <Button type="submit" variant="accent" className="mt-3 w-full" disabled={!prompt.trim()}>Add to {zones.find((zone) => zone.id === selectedZone)?.label} <Sparkles size={15} /></Button>
            </form>

            {jobs.length > 0 && <div className="card rounded-3xl p-4"><p className="font-black">Build queue</p>{jobs.slice(0, 2).map((job) => <div key={job.id} className="mt-2 flex items-center gap-2 rounded-xl bg-white p-3">{job.status === "building" ? <LoaderCircle size={16} className="animate-spin text-terracotta" /> : <Sparkles size={16} className="text-teal" />}<p className="min-w-0 truncate text-xs font-bold">{job.prompt}</p></div>)}</div>}
          </aside>

          <div className="min-w-0">
            <ShopRoom decorations={ownedShop.decorations} editable activeZone={selectedZone} />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button disabled className="flex min-h-20 items-center gap-4 rounded-2xl border border-dashed border-ink/15 bg-white/50 px-5 text-left opacity-65"><Layers3 className="text-teal" /><span><strong className="block text-sm">Add another room</strong><span className="text-xs text-ink/45">Coming soon</span></span></button>
              <button disabled className="flex min-h-20 items-center gap-4 rounded-2xl border border-dashed border-ink/15 bg-white/50 px-5 text-left opacity-65"><StepForward className="text-terracotta" /><span><strong className="block text-sm">Add stairs</strong><span className="text-xs text-ink/45">Coming soon</span></span></button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 card rounded-[2rem] p-5">
        <button onClick={() => setProfileOpen((current) => !current)} className="flex w-full items-center justify-between text-left"><span className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-rosewater text-terracotta"><Palette size={18} /></span><span><span className="block font-black">Place details & links</span><span className="block text-xs text-ink/45">Secondary public information</span></span></span><span>{profileOpen ? "−" : "+"}</span></button>
        {profileOpen && <div className="mt-5 grid gap-5 border-t border-ink/10 pt-5 md:grid-cols-2"><form onSubmit={saveProfile} className="space-y-3"><input name="name" defaultValue={ownedShop.name} aria-label="Place name" className="min-h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm" /><input name="tagline" defaultValue={ownedShop.tagline} aria-label="Place tagline" className="min-h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm" /><textarea name="bio" defaultValue={ownedShop.bio} aria-label="Place bio" rows={3} className="w-full rounded-xl border border-ink/10 bg-white p-3 text-sm" /><Button type="submit" className="w-full">Save details</Button></form><form onSubmit={saveLink} className="space-y-3"><input value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} aria-label="Link label" placeholder="Instagram" className="min-h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm" /><input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} aria-label="Link URL" type="url" placeholder="https://…" className="min-h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm" /><Button type="submit" variant="outline" className="w-full">Add link</Button></form></div>}
      </div>

      {/* Tags make a house and its items discoverable across the village. */}
      <div className="mt-4 card rounded-[2rem] p-5">
        <button onClick={() => setTagsOpen((current) => !current)} className="flex w-full items-center justify-between text-left">
          <span className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-rosewater text-terracotta"><Tags size={18} /></span>
            <span><span className="block font-black">Tags &amp; discovery</span><span className="block text-xs text-ink/45">Help visitors find your place by theme</span></span>
          </span>
          <span>{tagsOpen ? "−" : "+"}</span>
        </button>
        {tagsOpen && (
          <div className="mt-5 space-y-6 border-t border-ink/10 pt-5">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-ink/45">House tags</p>
              <p className="mb-2 mt-1 text-xs text-ink/45">Press enter or comma to add. These appear on your house and on tag pages.</p>
              <TagInput value={ownedShop.tags ?? []} onChange={setShopTags} placeholder="painting, slow-living, tea…" />
            </div>

            {ownedShop.decorations.length > 0 && (
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-ink/45">Item tags</p>
                <div className="mt-2 space-y-3">
                  {ownedShop.decorations.map((item) => (
                    <div key={item.id} className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
                      <p className="truncate text-sm font-bold text-ink/70">{item.title}</p>
                      <TagInput value={item.tags ?? []} onChange={(tags) => setDecorationTags(item.id, tags)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ownedShop.links.length > 0 && (
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-ink/45">Link tags</p>
                <div className="mt-2 space-y-3">
                  {ownedShop.links.map((link) => (
                    <div key={link.id} className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
                      <p className="truncate text-sm font-bold text-ink/70">{link.label}</p>
                      <TagInput value={link.tags ?? []} onChange={(tags) => setLinkTags(link.id, tags)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
