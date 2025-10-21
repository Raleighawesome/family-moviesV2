# Family Movies (v2)

A family‑friendly movie concierge built with Next.js 14, Supabase, OpenAI embeddings, and TMDB.

It helps households discover, organize, and track movies to watch together: add to queue, record watches with ratings (1–10), and get personalized recommendations that respect household preferences and streaming availability.

## Features
- Household queues: add, view, and remove movies you want to watch
- Watch history: mark watched with optional notes and 1–10 rating
- AI recommendations: vector similarity + rules, filtered by family prefs
- Streaming availability: show where to stream/rent/buy (TMDB providers)
- Family preferences: allowed ratings, max runtime, blocked keywords, preferred streaming services, rewatch exclusion period
- Auth and multi‑tenancy: per‑household data with Supabase RLS

## Tech Stack
- Next.js 14 (App Router, Middleware)
- Supabase (Postgres + Auth + RLS + pgvector)
- OpenAI (text-embedding-3-small) for semantic vectors
- TMDB API for movie metadata and watch providers
- Tailwind CSS, TypeScript, Vitest

## Quick Start
Prereqs:
- Node 18+ (Node 20 recommended), pnpm, Git
- Supabase CLI for local DB: https://supabase.com/docs/guides/cli

1) Install deps
- `pnpm install`

2) Environment variables
- Copy `.env.local.example` to `.env.local` and fill values:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose to client)
  - `OPENAI_API_KEY`
  - `TMDB_API_KEY`

3) Local database (optional but recommended)
- Start local Supabase and apply migrations:
  - `supabase start`
  - `pnpm run db:migrate` (applies migrations locally)
  - `pnpm run db:types` (regenerate TypeScript types from DB)
- Optional seed helpers are under `scripts/`

4) Run the app
- Dev: `pnpm dev`
- Open http://localhost:3000

## Scripts
- `pnpm dev`: Next dev server
- `pnpm build`: Production build
- `pnpm start`: Start production server
- `pnpm lint`: Lint
- `pnpm type-check`: TypeScript check
- `pnpm test`, `pnpm test:ui`, `pnpm test:coverage`: Vitest
- `pnpm seed`: Seed initial family-friendly dataset (uses APIs + Supabase)
- `pnpm seed:popular`: Seed popular movies
- `pnpm populate-providers`: Refresh TMDB streaming providers cache
- `pnpm db:backup`: Backup local DB
- `pnpm db:migrate`: Apply Supabase migrations (local)
- `pnpm db:types`: Generate `lib/supabase/types.ts` from DB

## Environment Variables
See `.env.local.example` for the canonical list. Required for a working app:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key (safe for browser)
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (server only)
- `OPENAI_API_KEY`: OpenAI API key (embeddings)
- `OPENAI_CHAT_MODEL` (optional): Chat model id (defaults to `gpt-4o`).
- `TMDB_API_KEY`: TMDB API key
- Optional: `APP_REGION`, `EMBEDDING_MODEL`, `EMBEDDING_DIM`

Security notes:
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. Only set as a server env (Vercel Project > Settings > Environment Variables with “Encrypted” selected).

## Database & Migrations
- SQL migrations live in `supabase/migrations/`
- Initial schema uses `tmdb_id` as the primary key for `movies`, with relationships to `list_items`, `watches`, `ratings`
- Vector search uses `pgvector` (embedding dimension 1536)
- Household data is protected by RLS policies; see `DATABASE_SAFETY.md`

Local workflow:
- `supabase start`
- `pnpm run db:migrate`
- `pnpm run db:types`

## Architecture Overview
- `app/` – Next.js routes and pages
  - `middleware.ts` protects routes (Edge-compatible Supabase client)
  - `app/api/chat/route.ts` – AI chat endpoint (uses `ai` SDK tools)
- `server/tools/` – server-side tool implementations (recommend, add-to-queue, mark-watched, update-rating, get-streaming)
- `lib/tmdb/` – TMDB client and normalizers
- `lib/openai/` – Embedding utilities (generate movie embeddings, cosine similarity)
- `lib/supabase/` – Client helpers for server and browser
- `components/` – UI components (movie cards, providers, ratings)
- `scripts/` – maintenance and seeding scripts

## Deploying to Vercel
1) Create a new Vercel project from this repo
2) Set Environment Variables (Project > Settings > Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
   - `OPENAI_API_KEY`
   - `TMDB_API_KEY`
3) Trigger a deploy. Vercel auto-detects pnpm and Next.js.

Notes:
- Middleware uses `@supabase/ssr` in Edge runtime; no `cookies()` from `next/headers` is used in middleware.
- The repo currently sets `next.config.js` to ignore TS/ESLint errors during builds to unblock deploys. Once type issues are resolved, re-enable strict builds by setting:
  - `typescript.ignoreBuildErrors = false`
  - `eslint.ignoreDuringBuilds = false`

## Troubleshooting
- Build fails on Vercel:
  - Ensure all required env vars are set.
  - If TypeScript errors appear from production code, either fix them or keep `ignoreBuildErrors` as `true` temporarily.
- 401/403 from Supabase:
  - Confirm you are logged in, have a `profiles` row, and are a member of a household. The middleware redirects unauthenticated users to `/login`.
- TMDB/OpenAI errors:
  - Code intentionally throws if keys are not set or placeholders are used.
- Missing streaming providers:
  - Run `pnpm populate-providers` to refresh cached providers for movies in your DB.

## Contributing
- Keep changes minimal and focused; update documentation when adding features.
- Follow the existing TypeScript and file organization patterns.

## License
No license specified. All rights reserved.
