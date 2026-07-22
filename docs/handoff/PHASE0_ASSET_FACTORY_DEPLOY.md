# Phase 0 — Asset Factory / Creation Studio: Deploy & Test

Status: **engineering complete, ready for Vercel provisioning + founder phone test.**
Not "LIVE for founder testing" until the deployed phone workflow below passes.

## What shipped in this commit

- **Founder gate (server-enforced).** Every AI + publish route (`/api/ai/translate`,
  `/api/ai/reference`, `/api/ai/generate`, `/api/ai/identity`, `/api/founder/publish-asset`)
  refuses any request without a valid `x-founder-token`. Fails **closed**: if the server
  has no token configured, every gated route returns 503 — a misconfigured deploy is never
  silently open. (`lib/founder-gate.ts`, unit-tested in `test/founder-gate.test.ts`.)
- **Vercel-safe generation.** The reference route no longer writes to the (ephemeral,
  read-only) Vercel filesystem — references now persist to **Supabase Storage**
  (`nestudio-assets/references/…`). Generation routes carry `runtime="nodejs"` +
  `maxDuration=300`. An interrupted request never creates a partial *published* asset
  (image is uploaded to Storage first; the catalog row is written only after a real URL exists).
- **Canonical publish from the phone.** Approve → `POST /api/founder/publish-asset` →
  Supabase Storage + `nest_assets` (idempotent by id; refuses to overwrite a different
  existing title). scope=global / ownerId=null carried in `visual_bounds`.
- **Mobile hardening.** Founder gate screen, safe-area padding (top + bottom), sticky action
  bar clears the home indicator, and a re-entrancy guard so a double-tap can't launch a
  duplicate generation or publish.

## Required Vercel Environment Variables

The deploy **fails closed** without these — set them in the Vercel project (Production +
Preview). All are **server-only** except the two already-public Supabase values.

| Variable | Scope | Purpose | Missing → |
|---|---|---|---|
| `FOUNDER_ACCESS_TOKEN` | server | the founder access code | all AI/publish routes 503 |
| `OPENAI_API_KEY` | server | GPT Image + translator | generation 501 |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Storage + catalog writes | publish 503 |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project | editor/publish fail |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase reads | editor fails |
| `NEXT_PUBLIC_NEST_BACKEND` = `supabase` | public (build-time) | editor reads the live catalog | editor shows fixture only |

**Never** create a `NEXT_PUBLIC_FOUNDER_*` / `NEXT_PUBLIC_OPENAI_*` / `NEXT_PUBLIC_SERVICE_*`
— that would inline a secret into the browser bundle. Audit confirms none exist.

> `maxDuration=300` needs a Vercel plan whose function limit allows it (Pro/Fluid). On a
> plan capped at 60s, a reference+asset pair (two sequential GPT Image calls) may time out;
> the follow-up is the generation-job model (job id + polling), noted under Known Limitations.

## Deployed phone-test workflow (Phase 0 acceptance)

Open the Vercel **preview URL** on your phone and run:

1. Open `/asset-factory` → the **Founder access** gate appears. Enter the code → Studio loads.
2. **Text object:** describe an object → *Interpret* → review the spec → *Generate* → review →
   answer "Would I proudly place this?" **Yes** → *Approve & Add*.
3. Open the **editor** → the object is in your Assets tray (from Supabase), thumbnail loads,
   place it, **reload** — still there; the placed instance stays in the saved Nest.
4. **Upload object:** repeat step 2 but *Upload a reference* first (phone photo library).
   Keep it as a draft or reject — don't publish unless you want it global.
5. **Reject path:** generate, answer **No**, *Regenerate* or *Edit* — nothing is published.

Only after 1–3 pass on the deployed URL is Asset Factory **LIVE FOR FOUNDER TESTING**.

## Known limitations (Phase 0)

- **Editor tray is sparse** until you publish more objects — only the certified Laptop +
  whatever you approve is in Supabase; pre-placed fixture room objects may render as labels.
- **No generation-job queue yet.** Generation is synchronous. Fine for single images on a
  Pro/Fluid plan; if you hit timeouts, that's the signal to add the job model (job id + poll).
- **Interactive surfaces are not wired.** Approved assets are placeable but `editable_surfaces`
  is empty by design — audio/video/link surfaces belong to the Interaction Engine (out of scope).
- **Rate/duplicate protection** is a client re-entrancy guard + idempotent upsert. There is no
  server-side rate limiter yet (founder-gated, so exposure is low); add one before public use.

## Issue-report template

```
Creation type:   Asset | (Background/Avatar once live)
Request:         <what you typed / uploaded>
Expected result:
Actual result:
Screenshot:
Device/browser:
Cost shown:      reference $__ · asset $__ · total $__
Severity:        blocker | major | minor | polish
```
