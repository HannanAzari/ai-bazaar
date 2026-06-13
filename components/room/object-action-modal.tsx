"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  Heart,
  Images,
  Link2,
  Mail,
  Phone,
  PlayCircle,
  ShoppingBag,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { actionLabels } from "@/lib/room-schema";
import { contactMethods, faviconUrl, galleryImages, hostname, productCard, withHttp } from "@/lib/room-actions";
import { videoEmbed } from "@/lib/embeds";
import { getActivityForHandle } from "@/lib/activity";
import { normalizeHandle } from "@/lib/creators";
import { flags } from "@/lib/flags";
import type { RoomObject, Shop } from "@/lib/types";
import { cn, formatCount, timeAgo } from "@/lib/utils";

// Real, in-room interactive panels (Room Engine V3). A visitor activates an
// object and gets a usable experience — a gallery lightbox, an embedded video,
// a product/booking/contact card, or a creator profile — without leaving the
// room. The gallery uses a dark full-screen viewer; everything else shares the
// parchment card shell so the visual language is unchanged.

export function ObjectActionModal({ object, shop, onClose }: { object: RoomObject; shop: Shop; onClose: () => void }) {
  // Close on Escape for every panel.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  switch (object.actionType) {
    case "gallery":
      return <GalleryLightbox object={object} onClose={onClose} />;
    case "video":
      return <VideoPanel object={object} onClose={onClose} />;
    case "product":
      return <ProductPanel object={object} onClose={onClose} />;
    case "booking":
      return <BookingPanel object={object} onClose={onClose} />;
    case "contact":
      return <ContactPanel object={object} shop={shop} onClose={onClose} />;
    case "profile":
      return <ProfilePanel shop={shop} onClose={onClose} />;
    case "link":
      return <LinkPanel object={object} onClose={onClose} />;
    default:
      return <PlaceholderPanel object={object} onClose={onClose} />;
  }
}

// ── Shared parchment card shell ──
function PanelShell({ icon, eyebrow, title, children, onClose, wide }: { icon: React.ReactNode; eyebrow: string; title: string; children?: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-ink/40 p-5 backdrop-blur-sm" onClick={onClose}>
      <div className={cn("relative w-full rounded-[2rem] border border-white/70 bg-[#fff8e9] p-7 shadow-2xl", wide ? "max-w-lg" : "max-w-md")} onClick={(event) => event.stopPropagation()}>
        <button onClick={onClose} className="absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-white" aria-label="Close"><X size={17} /></button>
        <span className="grid size-12 place-items-center rounded-2xl bg-terracotta/10 text-terracotta">{icon}</span>
        <p className="eyebrow mt-4 text-terracotta">{eyebrow}</p>
        <h2 className="display mt-1 text-3xl">{title}</h2>
        {children}
      </div>
    </div>
  );
}

// ── Gallery: dark full-screen lightbox with next/prev + captions ──
function GalleryLightbox({ object, onClose }: { object: RoomObject; onClose: () => void }) {
  const images = galleryImages(object.actionData);
  const [index, setIndex] = useState(0);
  const count = images.length;
  const go = (delta: number) => setIndex((current) => (count ? (current + delta + count) % count : 0));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const current = images[index];

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-ink/90 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center justify-between p-4 text-white/90" onClick={(event) => event.stopPropagation()}>
        <p className="flex items-center gap-2 text-sm font-bold"><Images size={16} /> {object.label}{count > 1 && <span className="text-white/50">· {index + 1} / {count}</span>}</p>
        <button onClick={onClose} className="grid size-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25" aria-label="Close gallery"><X size={18} /></button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-12" onClick={(event) => event.stopPropagation()}>
        {count === 0 ? (
          <p className="rounded-2xl bg-white/10 px-6 py-4 text-center text-sm text-white/70">No images yet. The owner can add them in the studio.</p>
        ) : (
          <>
            {count > 1 && (
              <button onClick={() => go(-1)} className="absolute left-1 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/30 sm:left-3" aria-label="Previous image"><ChevronLeft size={22} /></button>
            )}
            <figure className="flex max-h-full max-w-3xl flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.src} alt={current.caption ?? object.label} className="max-h-[70vh] w-auto rounded-2xl border-[6px] border-white/85 object-contain shadow-2xl" />
              {current.caption && <figcaption className="mt-3 max-w-xl text-center text-sm text-white/80">{current.caption}</figcaption>}
            </figure>
            {count > 1 && (
              <button onClick={() => go(1)} className="absolute right-1 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/30 sm:right-3" aria-label="Next image"><ChevronRight size={22} /></button>
            )}
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex justify-center gap-1.5 p-4" onClick={(event) => event.stopPropagation()}>
          {images.map((image, i) => (
            <button key={i} onClick={() => setIndex(i)} aria-label={`Go to image ${i + 1}`} className={cn("size-2.5 rounded-full transition", i === index ? "bg-white" : "bg-white/35 hover:bg-white/60")} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Video: embedded YouTube/Vimeo player, else placeholder ──
function VideoPanel({ object, onClose }: { object: RoomObject; onClose: () => void }) {
  const embed = videoEmbed(object.actionData?.url);
  const url = object.actionData?.url;
  return (
    <PanelShell icon={<PlayCircle size={24} />} eyebrow={actionLabels.video} title={object.label} onClose={onClose} wide>
      {embed ? (
        <div className="mt-4 aspect-video w-full overflow-hidden rounded-2xl border border-ink/10 bg-black shadow-inner">
          <iframe src={embed.embedUrl} title={object.label} className="size-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        </div>
      ) : (
        <div className="mt-4 grid aspect-video w-full place-items-center rounded-2xl border border-dashed border-ink/20 bg-white/60 text-center text-sm text-ink/55">
          <span><PlayCircle size={30} className="mx-auto mb-2 text-ink/30" />{url ? "This video URL isn't a YouTube or Vimeo link." : "No video set yet."}</span>
        </div>
      )}
      {object.actionData?.text && <p className="mt-3 text-sm leading-relaxed text-ink/60">{object.actionData.text}</p>}
      {url && !embed && (
        <a href={withHttp(url)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-bold text-white hover:bg-[#9a4a30]">Open the link <ExternalLink size={15} /></a>
      )}
    </PanelShell>
  );
}

// ── Link: favicon + title + description, opens externally ──
function LinkPanel({ object, onClose }: { object: RoomObject; onClose: () => void }) {
  const data = object.actionData;
  const url = data?.url?.trim();
  const favicon = faviconUrl(url);
  const host = hostname(url);
  return (
    <PanelShell icon={<Link2 size={24} />} eyebrow={actionLabels.link} title={data?.title?.trim() || object.label} onClose={onClose}>
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-ink/10 bg-white/70 p-4">
        {favicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={favicon} alt="" width={28} height={28} className="size-7 rounded" />
        ) : (
          <Globe size={26} className="text-ink/40" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{data?.title?.trim() || object.label}</p>
          <p className="truncate text-xs text-ink/45">{host ?? "No link set"}</p>
        </div>
      </div>
      {data?.description?.trim() && <p className="mt-3 text-sm leading-relaxed text-ink/60">{data.description}</p>}
      {url ? (
        <a href={withHttp(url)} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-bold text-white hover:bg-[#9a4a30]">Open link <ExternalLink size={15} /></a>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-ink/15 bg-white/50 p-3 text-sm text-ink/50">No URL set yet.</p>
      )}
    </PanelShell>
  );
}

// ── Product: image + title + price, redirect only (no payments) ──
function ProductPanel({ object, onClose }: { object: RoomObject; onClose: () => void }) {
  const product = productCard(object.actionData);
  return (
    <PanelShell icon={<ShoppingBag size={24} />} eyebrow={actionLabels.product} title={object.label} onClose={onClose}>
      {product ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-ink/10 bg-white/70">
          {product.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt={product.title} className="h-44 w-full object-cover" />
          )}
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate font-black">{product.title}</p>
              {product.price && <p className="text-sm font-bold text-terracotta">{product.price}</p>}
            </div>
            {product.url && (
              <a href={product.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-terracotta px-4 py-2.5 text-sm font-bold text-white hover:bg-[#9a4a30]">View <ExternalLink size={14} /></a>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-ink/15 bg-white/50 p-4 text-sm text-ink/55">No product details yet. The owner can add an image, title, price, and link in the studio.</p>
      )}
      <p className="mt-3 text-[11px] text-ink/40">Opens the seller&rsquo;s page — AI Bazaar doesn&rsquo;t process payments.</p>
    </PanelShell>
  );
}

// ── Booking: Calendly embed or external booking card ──
function BookingPanel({ object, onClose }: { object: RoomObject; onClose: () => void }) {
  const url = object.actionData?.url?.trim();
  const host = hostname(url);
  const isCalendly = !!host && host.includes("calendly.com");
  return (
    <PanelShell icon={<CalendarClock size={24} />} eyebrow={actionLabels.booking} title={object.label} onClose={onClose} wide>
      {object.actionData?.text && <p className="mt-3 text-sm leading-relaxed text-ink/60">{object.actionData.text}</p>}
      {isCalendly && url ? (
        <div className="mt-4 h-[480px] w-full overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-inner">
          <iframe src={withHttp(url)} title={object.label} className="size-full" />
        </div>
      ) : url ? (
        <div className="mt-4 rounded-2xl border border-ink/10 bg-white/70 p-4">
          <p className="text-sm font-bold">Book a time with {object.label}</p>
          <p className="mt-1 truncate text-xs text-ink/45">{host}</p>
          <a href={withHttp(url)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-bold text-white hover:bg-[#9a4a30]">Open booking page <ExternalLink size={15} /></a>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-ink/15 bg-white/50 p-4 text-sm text-ink/55">No booking link set yet. Add a Calendly or scheduling URL in the studio.</p>
      )}
    </PanelShell>
  );
}

// ── Contact: unified email / website / phone / socials modal ──
function ContactPanel({ object, shop, onClose }: { object: RoomObject; shop: Shop; onClose: () => void }) {
  const methods = contactMethods(object.actionData);
  const icon = (type: string) => (type === "email" ? Mail : type === "phone" ? Phone : type === "website" ? Globe : Link2);
  return (
    <PanelShell icon={<Mail size={24} />} eyebrow={actionLabels.contact} title={object.label} onClose={onClose}>
      {object.actionData?.text && <p className="mt-3 text-sm leading-relaxed text-ink/60">{object.actionData.text}</p>}
      {methods.length > 0 ? (
        <div className="mt-4 space-y-2">
          {methods.map((method, i) => {
            const Icon = icon(method.type);
            return (
              <a key={`${method.type}-${i}`} href={method.href} target={method.type === "email" || method.type === "phone" ? undefined : "_blank"} rel="noreferrer" className="flex min-h-12 items-center gap-3 rounded-xl border border-ink/10 bg-white px-4 text-sm font-bold shadow-sm transition hover:border-terracotta hover:bg-terracotta/5">
                <Icon size={17} className="text-terracotta" />
                <span className="min-w-0 flex-1 truncate">{method.value}</span>
                <ExternalLink size={14} className="text-ink/30" />
              </a>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-ink/15 bg-white/50 p-4 text-sm text-ink/55">No contact details yet. The owner can add an email, website, phone, or socials in the studio.</p>
      )}
      <p className="mt-3 text-[11px] text-ink/40">Reach {shop.owner} directly — messages aren&rsquo;t sent through AI Bazaar.</p>
    </PanelShell>
  );
}

// ── Profile: creator card reusing profiles + activity ──
function ProfilePanel({ shop, onClose }: { shop: Shop; onClose: () => void }) {
  const handle = normalizeHandle(shop.ownerHandle);
  const activity = flags.activityFeed ? getActivityForHandle(handle).slice(0, 4) : [];
  return (
    <PanelShell icon={<UserRound size={24} />} eyebrow="Lives here" title={shop.owner} onClose={onClose}>
      <p className="text-xs font-bold text-ink/40">{shop.ownerHandle}</p>
      {shop.bio && <p className="mt-3 text-sm leading-relaxed text-ink/60">{shop.bio}</p>}
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-ink/10 bg-white/60 p-3 text-center">
        <div><strong className="block text-sm">{formatCount(shop.followers)}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-ink/35">Followers</span></div>
        <div><strong className="flex items-center justify-center gap-1 text-sm"><Heart size={12} /> {formatCount(shop.likes)}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-ink/35">Likes</span></div>
        <div><strong className="flex items-center justify-center gap-1 text-sm"><Users size={12} /> {formatCount(shop.visitors)}</strong><span className="text-[10px] font-bold uppercase tracking-wider text-ink/35">Visitors</span></div>
      </div>

      {activity.length > 0 && (
        <div className="mt-4">
          <p className="eyebrow text-teal">Recent activity</p>
          <ul className="mt-2 space-y-1.5">
            {activity.map((entry) => (
              <li key={entry.id} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-ink/65">{entry.summary}</span>
                <span className="shrink-0 text-ink/35">{timeAgo(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {flags.creatorProfiles && (
          <Link href={`/u/${handle}`} className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-bold text-white hover:bg-[#9a4a30]">View full profile <ExternalLink size={14} /></Link>
        )}
        {flags.collections && (
          <Link href="/collections" className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-bold text-ink/60 hover:border-terracotta hover:text-terracotta">Collections</Link>
        )}
      </div>
    </PanelShell>
  );
}

// ── Fallback (booking/collection without data, etc.) ──
function PlaceholderPanel({ object, onClose }: { object: RoomObject; onClose: () => void }) {
  return (
    <PanelShell icon={<Images size={24} />} eyebrow={actionLabels[object.actionType]} title={object.label} onClose={onClose}>
      <p className="mt-3 rounded-2xl border border-dashed border-ink/15 bg-white/50 p-4 text-sm text-ink/55">Nothing to show here yet.</p>
    </PanelShell>
  );
}
