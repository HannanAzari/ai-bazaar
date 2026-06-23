# Golden Room Generation System

An internal art-direction console for discovering **one** Nestudio Golden Room — the single
room that makes someone think *"I want to live here and explore it."* This is **not** a room
library generator; the goal is one unforgettable room (see `../../docs/golden-room-v1.md` and
`../../docs/golden-room-exploration.md`).

## How it works

Three levels, all in `apps/asset-factory`:

- **UI** — `app/golden-room/page.tsx` (route `/golden-room`, password-gated by middleware).
  Generate a round → view candidates → score (0–100) + critique → approve/reject → generate the
  next round from the critique → export the winner.
- **API** — `app/api/golden-room/route.ts` (`GET` list+status, `POST` generate, `PATCH` update),
  `app/api/golden-room/image/[id]/route.ts` (serves a candidate PNG), and
  `app/api/golden-room/export/route.ts` (winner → RoomShellPack JSON).
- **Logic + persistence** — `lib/golden-room.ts` (pure: prompts, rubric, winner rule, export
  builder; unit-tested in `test/golden-room.test.ts`) and `lib/golden-room-store.ts`
  (server-only local filesystem persistence).

Generation reuses the existing OpenAI helper (`lib/openai-server.ts` `runOpenAi`) at portrait
size `1024x1536`, and the existing env gating (`lib/generation-config.ts`). No new infrastructure.

## Running it locally

1. `cd apps/asset-factory`
2. In `.env.local` (server-only, gitignored):
   ```
   OPENAI_API_KEY=sk-...
   OPENAI_GENERATION_ENABLED=true
   GENERATION_PROVIDER=openai      # optional; the Golden Room route forces OpenAI anyway
   # OPENAI_IMAGE_MODEL=gpt-image-1   # default
   ```
3. `PATH=/Users/.../node/v20.20.2/bin:$PATH npm run dev` (port 3100).
4. Open `http://localhost:3100/golden-room` (log in if a password is set).
5. **Dry run** (checkbox) works with **no key** — it creates placeholder candidates so you can
   exercise the whole workflow (generate → score → critique → approve → export) before spending
   credits.

## Where candidates are saved

Local filesystem under `apps/asset-factory/.data/golden-room/` (gitignored):
- `candidates.json` — metadata for every candidate (never overwritten on a new round).
- `images/<id>.png` — the generated PNG for each real candidate (dry-run candidates carry an
  inline SVG data URL instead and write no file).

Each candidate stores: `id, round, imageUrl, prompt, negativePrompt, score, critique, status,
dryRun, createdAt`. Previous rounds are preserved.

## Scoring rubric (0–100 overall, art-director's holistic call)

1. **Emotional pull** — makes you want to enter the room?
2. **Nestudio DNA** — warm, premium, handcrafted, magical?
3. **Mobile readability** — works at phone size?
4. **Scene capacity** — supports YouTube/GitHub/Spotify/portfolio/bio/achievements?
5. **Room → Wall → Object flow** — can a user tap areas and zoom into front scenes?
6. **Believable home feeling** — lived-in, not staged?
7. **Technical usability** — can we overlay hotspots / scene metadata?

## Stop condition

- **Winner:** a candidate that is **approved** AND scored **≥ 85**. Export it; stop.
- **Below 80:** not good enough — critique, adjust the prompt, regenerate (max 5 per round).
- **NO-GO:** if after a few rounds nothing approaches the bar, stop and say so (more rounds won't
  save a wrong direction) — escalate to art direction (`docs/golden-room-v1.md`).

Discipline: **max 5 candidates per round**; always critique before regenerating. Behave like an
art director, not a batch generator.

## Exporting the winner

Click **Export RoomShellPack** on an approved candidate (or `GET /api/golden-room/export?id=<id>`).
Produces `golden-room-v1.json`:

```json
{
  "id": "golden-room-v1",
  "type": "room_shell_pack",
  "imageUrl": "/api/golden-room/image/<id>",
  "version": "1.0.0",
  "styleFamily": "nestudio-golden-room",
  "sceneAreas": [
    { "id": "media-area",       "recommendedFor": ["youtube","video","twitch"],   "bounds": { "x": 0.17,  "y": 0.27, "width": 0.2,   "height": 0.18 } },
    { "id": "work-area",        "recommendedFor": ["github","website","blog"],    "bounds": { "x": 0.876, "y": 0.38, "width": 0.124, "height": 0.26 } },
    { "id": "gallery-area",     "recommendedFor": ["instagram","portfolio","art"],"bounds": { "x": 0.41,  "y": 0.26, "width": 0.2,   "height": 0.2  } },
    { "id": "achievement-area", "recommendedFor": ["awards","milestones","press"],"bounds": { "x": 0.65,  "y": 0.27, "width": 0.19,  "height": 0.18 } }
  ]
}
```

`sceneAreas` bounds are normalized placeholders from `docs/golden-room-v1.md` — recalibrate
against the final image with the (future) hotspot calibration tool. The export response also
returns `meetsBar` (true only for an approved 85+ winner) so a weak room is never shipped silently.

## Scope / non-goals

This system finds the Golden Room only. It does **not** generate furniture, wall packs, exterior
assets, or a room library, and it does not touch the main app. The winner is the foundation
(`room_shell_pack`) the rest of the scene-pack system (ADR-026) builds on.
