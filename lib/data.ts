import type { Bazaar, Shop } from "@/lib/types";

export const HOUSES_PER_VILLAGE = 24;

export const bazaars: Bazaar[] = [
  { id: "moon-court", slug: "moon-court", addressPrefix: "moon", name: "Moon Court", subtitle: "Dreamers, night owls & soft things", accent: "#315d7a", soft: "#dfeaf0", claimed: 15, position: { x: 50, y: 12 }, hex: { q: 0, r: -2 } },
  { id: "saffron-yard", slug: "saffron-yard", addressPrefix: "saffron", name: "Saffron Yard", subtitle: "Food, craft & bright ideas", accent: "#d47b28", soft: "#f6dfbf", claimed: 18, position: { x: 24, y: 31 }, hex: { q: 1, r: -2 } },
  { id: "rose-arcade", slug: "rose-arcade", addressPrefix: "rose", name: "Rose Arcade", subtitle: "Art, fashion & tiny obsessions", accent: "#a94f5c", soft: "#f0dadd", claimed: 16, position: { x: 76, y: 31 }, hex: { q: -1, r: -1 } },
  { id: "cedar-ring", slug: "cedar-ring", addressPrefix: "cedar", name: "Cedar Ring", subtitle: "Nature, ritual & slow living", accent: "#4d7358", soft: "#dce8dd", claimed: 11, position: { x: 15, y: 57 }, hex: { q: 0, r: -1 } },
  { id: "cobalt-lane", slug: "cobalt-lane", addressPrefix: "cobalt", name: "Cobalt Lane", subtitle: "Tech, music & curious experiments", accent: "#5554a4", soft: "#e2e0f1", claimed: 14, position: { x: 85, y: 57 }, hex: { q: 1, r: -1 } },
  { id: "honey-grove", slug: "honey-grove", addressPrefix: "honey", name: "Honey Grove", subtitle: "Mending, making & generous tables", accent: "#a66f28", soft: "#f2dfaa", claimed: 9, position: { x: 36, y: 51 }, hex: { q: -1, r: 0 } },
  { id: "lantern-hill", slug: "lantern-hill", addressPrefix: "lantern", name: "Lantern Hill", subtitle: "Stories, light & evening rituals", accent: "#b45c38", soft: "#edd1b9", claimed: 12, position: { x: 64, y: 51 }, hex: { q: 0, r: 0 } },
  { id: "velvet-square", slug: "velvet-square", addressPrefix: "velvet", name: "Velvet Square", subtitle: "Sound, cinema & after-dark rooms", accent: "#74547d", soft: "#dfd2e3", claimed: 10, position: { x: 25, y: 82 }, hex: { q: 1, r: 0 } },
  { id: "paper-meadow", slug: "paper-meadow", addressPrefix: "paper", name: "Paper Meadow", subtitle: "Print, illustration & folded worlds", accent: "#62806e", soft: "#dce8d7", claimed: 8, position: { x: 50, y: 75 }, hex: { q: 0, r: 1 } },
  { id: "blue-orchard", slug: "blue-orchard", addressPrefix: "blue", name: "Blue Orchard", subtitle: "Ideas growing in unusual directions", accent: "#3e7193", soft: "#d7e5ec", claimed: 13, position: { x: 75, y: 82 }, hex: { q: 1, r: 1 } },
];

export const shops: Shop[] = [
  {
    id: "shop-1", address: "saffron.tiny.lantern", bazaarId: "saffron-yard", slotNumber: 14,
    name: "The Quiet Kettle", owner: "Mina Farah", ownerHandle: "@minamakes",
    tags: ["tea", "ritual", "slow-living", "paper-goods"],
    tagline: "Tea rituals for unhurried afternoons.", bio: "A small corner for fragrant tea, paper goods, and the pleasure of taking your time.",
    avatar: "QK", palette: "from-amber-200 via-orange-100 to-rose-200", cover: "tea", likes: 1240, followers: 387, visitors: 8921, createdAt: "2026-05-12",
    links: [{ id: "l1", label: "The tea shelf", url: "https://example.com", kind: "external" }, { id: "l2", label: "Notes from Mina", url: "https://example.com", kind: "external" }, { id: "l3", label: "Instagram", url: "https://instagram.com", kind: "social" }],
    decorations: [{ id: "d1", type: "text", title: "Today at the kettle", content: "Rose tea at four. Stay as long as you like." }, { id: "d2", type: "ai-image", title: "Tea corner", content: "A handwoven Persian carpet with a low cedar tea table", palette: "from-red-300 via-amber-100 to-teal-200", tags: ["tea", "textile"] }, { id: "d3", type: "link", title: "This month's tea box", content: "Three floral teas and a tiny brass spoon." }],
  },
  {
    id: "shop-2", address: "cobalt.velvet.radio", bazaarId: "cobalt-lane", slotNumber: 7,
    name: "Velvet Frequency", owner: "Theo Vale", ownerHandle: "@theovale",
    tags: ["music", "radio", "night", "field-recording"],
    tagline: "Midnight playlists and field recordings.", bio: "Independent radio for insomniacs, city walkers, and anyone listening between stations.",
    avatar: "VF", palette: "from-indigo-300 via-violet-200 to-rose-200", cover: "radio", likes: 982, followers: 421, visitors: 6240, createdAt: "2026-05-29",
    links: [{ id: "l4", label: "Listen live", url: "https://example.com", kind: "external" }],
    decorations: [{ id: "d4", type: "text", title: "On air", content: "Songs for the last train home." }, { id: "d5", type: "ai-image", title: "Listening room", content: "A cobalt listening room glowing after midnight", palette: "from-indigo-400 via-blue-200 to-fuchsia-200" }],
  },
  {
    id: "shop-3", address: "rose.paper.cloud", bazaarId: "rose-arcade", slotNumber: 22,
    name: "Paper Cloud", owner: "Jun Park", ownerHandle: "@junfolds",
    tags: ["paper", "origami", "craft", "print"],
    tagline: "Small paper worlds, folded by hand.", bio: "Origami objects, printable kits, and dispatches from a very small studio.",
    avatar: "PC", palette: "from-pink-200 via-orange-100 to-sky-200", cover: "paper", likes: 1760, followers: 643, visitors: 11320, createdAt: "2026-04-18",
    links: [{ id: "l5", label: "Paper kits", url: "https://example.com", kind: "external" }],
    decorations: [{ id: "d6", type: "image", title: "Fold of the week", content: "A peach paper crane catching the morning light", palette: "from-orange-200 via-pink-100 to-blue-100", tags: ["origami", "paper"] }],
  },
  {
    id: "shop-4", address: "cedar.rain.window", bazaarId: "cedar-ring", slotNumber: 4,
    name: "Moss Window", owner: "Inez Cole", ownerHandle: "@inezoutside",
    tags: ["nature", "illustration", "field-notes", "walks"],
    tagline: "Field notes from the damp and green.", bio: "Tiny guides to urban nature, illustrated walks, and seasonal observations.",
    avatar: "MW", palette: "from-emerald-300 via-lime-100 to-cyan-200", cover: "moss", likes: 734, followers: 298, visitors: 4930, createdAt: "2026-06-02",
    links: [{ id: "l6", label: "Field notes", url: "https://example.com", kind: "external" }],
    decorations: [{ id: "d7", type: "ai-image", title: "Window garden", content: "A rain-speckled window framed by moss and ferns", palette: "from-green-300 via-emerald-100 to-slate-200" }],
  },
  {
    id: "shop-5", address: "moon.blue.hour", bazaarId: "moon-court", slotNumber: 15,
    name: "Blue Hour Studio", owner: "Amal Noor", ownerHandle: "@amalafterlight",
    tags: ["painting", "portrait", "art", "commission"],
    tagline: "Portraits painted just after sunset.", bio: "A digital painting room for luminous faces, blue shadows, and works in progress.",
    avatar: "BH", palette: "from-blue-300 via-slate-200 to-amber-100", cover: "studio", likes: 2140, followers: 890, visitors: 15670, createdAt: "2026-03-30",
    links: [{ id: "l7", label: "Portrait commissions", url: "https://example.com", kind: "external" }],
    decorations: [{ id: "d8", type: "image", title: "New portrait", content: "Study in ultramarine and warm gold", palette: "from-blue-400 via-indigo-200 to-amber-200", tags: ["painting", "portrait"] }],
  },
  {
    id: "shop-6", address: "honey.thread.club", bazaarId: "honey-grove", slotNumber: 9,
    name: "Honey Thread Club", owner: "Sara Bell", ownerHandle: "@sarasews",
    tags: ["mending", "craft", "textile", "workshop"],
    tagline: "Visible mending for well-loved clothes.", bio: "Patterns, workshops, and joyful repairs for clothes worth keeping.",
    avatar: "HT", palette: "from-yellow-200 via-amber-100 to-red-200", cover: "thread", likes: 638, followers: 252, visitors: 3810, createdAt: "2026-06-06",
    links: [{ id: "l8", label: "Mending circle", url: "https://example.com", kind: "external" }],
    decorations: [{ id: "d9", type: "text", title: "Mending circle", content: "Sunday, 11am. Bring one thing you thought was finished." }],
  },
  {
    id: "shop-7", address: "lantern.story.room", bazaarId: "lantern-hill", slotNumber: 12,
    name: "Story Lantern", owner: "Nora Ayad", ownerHandle: "@noratells",
    tags: ["writing", "stories", "reading"],
    tagline: "Short stories for long evenings.", bio: "A warm room of tiny tales, readings, and unfinished beginnings.",
    avatar: "SL", palette: "from-orange-300 via-amber-100 to-red-200", cover: "stories", likes: 844, followers: 330, visitors: 5021, createdAt: "2026-05-22",
    links: [{ id: "l9", label: "Read the latest tale", url: "https://example.com", kind: "external" }],
    decorations: [{ id: "d10", type: "text", title: "Tonight's opening line", content: "The lantern had been waiting for her." }],
  },
  {
    id: "shop-8", address: "velvet.moon.cinema", bazaarId: "velvet-square", slotNumber: 10,
    name: "Soft Focus", owner: "Eli Ward", ownerHandle: "@eliframes",
    tags: ["film", "cinema", "video"],
    tagline: "Films, fragments, and velvet shadows.", bio: "A personal screening room for small films and visual notes.",
    avatar: "SF", palette: "from-purple-300 via-fuchsia-100 to-slate-200", cover: "cinema", likes: 1090, followers: 477, visitors: 7182, createdAt: "2026-04-28",
    links: [{ id: "l10", label: "Watch the reel", url: "https://example.com", kind: "external" }],
    decorations: [{ id: "d11", type: "ai-image", title: "Screening nook", content: "A velvet-curtained room with a tiny projector", palette: "from-purple-400 via-rose-200 to-slate-300", tags: ["film", "cinema"] }],
  },
  {
    id: "shop-9", address: "paper.peach.press", bazaarId: "paper-meadow", slotNumber: 8,
    name: "Peach Press", owner: "Lina Cho", ownerHandle: "@linaprints",
    tags: ["print", "zine", "riso", "illustration"],
    tagline: "Ink, paper, and cheerful mistakes.", bio: "Risograph prints, zines, and a desk permanently covered in scraps.",
    avatar: "PP", palette: "from-orange-200 via-pink-100 to-lime-100", cover: "press", likes: 701, followers: 284, visitors: 4144, createdAt: "2026-06-01",
    links: [{ id: "l11", label: "Open the zine shelf", url: "https://example.com", kind: "external" }],
    decorations: [{ id: "d12", type: "image", title: "Fresh from the press", content: "A bright two-color print drying by the window", palette: "from-orange-300 via-pink-200 to-lime-200" }],
  },
  {
    id: "shop-10", address: "blue.hannan.lab", bazaarId: "blue-orchard", slotNumber: 13,
    name: "Hannan's Lab", owner: "Hannan Noor", ownerHandle: "@hannanbuilds",
    tags: ["code", "prototype", "experiments", "craft"],
    tagline: "Experiments growing between code and craft.", bio: "A curious room for prototypes, notes, and ideas that are still becoming.",
    avatar: "HL", palette: "from-sky-300 via-cyan-100 to-amber-100", cover: "lab", likes: 912, followers: 361, visitors: 5892, createdAt: "2026-06-08",
    links: [{ id: "l12", label: "Current experiments", url: "https://example.com", kind: "external" }],
    decorations: [{ id: "d13", type: "ai-image", title: "Workbench", content: "A playful workbench of glowing prototypes and paper sketches", palette: "from-cyan-300 via-blue-100 to-amber-200" }],
  },
];

export const emptySlotsByBazaar = Object.fromEntries(
  bazaars.map((bazaar) => [
    bazaar.id,
    Array.from({ length: HOUSES_PER_VILLAGE }, (_, index) => index + 1).filter(
      (slot) => !shops.some((shop) => shop.bazaarId === bazaar.id && shop.slotNumber === slot),
    ),
  ]),
);

export function getBazaar(slug: string) {
  return bazaars.find((bazaar) => bazaar.slug === slug);
}

export function getShop(address: string) {
  return shops.find((shop) => shop.address === address);
}
