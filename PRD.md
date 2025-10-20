Family Movies (v2) — Product Requirements Document
1) Purpose & Positioning
Build a private, family-friendly movie concierge that:
Stores your household’s movie activity and preferences in Supabase (system of record).
Uses a simple chat UI to search, add, recommend, and mark movies watched.
Pulls third-party metadata on demand (no giant pre-crawl).
Keeps costs, code, and ops surface area small.
2) Goals (MVP)
Moments-to-value: 60 seconds from signup → first recommendation.
Safety by default: Household filters (MPAA, runtime, blocked keywords) applied everywhere.
Low ops: One DB (Supabase), one app (Next.js), one external metadata source (TMDB). Optional nightly cron.
Typed chat loop: Model can only act through 3–4 whitelisted tools (search TMDB, add to queue, recommend, mark watched).
Non-Goals (MVP)
No public social graph.
No multi-region catalogs.
No full Trakt/Letterboxd importer (can be vNext).
3) Primary Personas
Parent/Planner (Admin): Curates queue, sets filters, wants “what can we watch tonight?”
Kids (Viewers): Browse cards, pick from parent-approved suggestions, mark watched (optionally rate).
Power User (You): Wants clean data model, typed tools, RLS, and minimal moving parts.
4) Success Metrics
TTFW (time to first watch suggestion) ≤ 60s.
≥ 70% of sessions include an add-to-queue or mark-watched action.
0 PII leaks between households (RLS audit passes).
P95 chat round-trip < 2.5s (recommendations from local cache/vector).
5) System Overview
Stack
Frontend: Next.js (App Router) + a chat component (e.g., Vercel AI SDK useChat or similar).
Backend (same repo): API route handlers + tool functions (server actions).
DB: Supabase Postgres + Auth + Storage + pgvector.
Metadata: TMDB (search, details, watch/providers).
Background (optional): Supabase Cron → Edge Function to refresh provider links & small rec cache.
flowchart LR
  U[User] --> C[Chat UI]
  C --> RH[Route Handler / AI Tools]
  RH --> DB[(Supabase Postgres + RLS + pgvector)]
  RH --> TMDB[(TMDB API)]
  CRON[Supabase Cron] --> EDGE[Edge Function: refresh providers & cache]
  EDGE --> DB
6) Functional Requirements (MVP)
6.1 Chat Concierge
Free-text chat drives four tools:
tmdb.search(query, year?) → 3–8 candidates
db.add_to_queue(tmdb_id) → upsert movie + queue line
db.recommend(limit=10) → returns curated list respecting household filters
db.mark_watched(tmdb_id, rating?) → insert watch; optional rating; refresh taste vector
The model never writes SQL. All DB ops go through server code or SQL RPCs you control.
6.2 Search & Add
On search result cards: title, year, poster, MPAA, runtime, top 3 genres, “where to watch” (if cached).
“Add to Queue” stores movies (if new) and list_items(queue).
6.3 Recommendations
If family_taste exists: vector KNN over local movies.embedding (filters applied).
Else: popularity-weighted, filter-constrained subset from your local catalog (or a light TMDB discover call, then upsert).
Always join cached provider availability for the household’s region.
6.4 Mark Watched / Rate
Chat: “we watched The Iron Giant, 5/5” → inserts watches, ratings; recompute household taste (mean of ≥4 ratings).
UI affordance on cards: Mark watched + 1–10 rating.
6.5 Household Preferences
allowed_ratings[], max_runtime, blocked_keywords[] stored in DB.
Applied in every read path (recommendations, queue listing).
7) Non-Functional Requirements
Security: Strict RLS for household-scoped tables. Service key never exposed client-side.
Privacy: No ad tech. Minimal logs; no raw prompts stored by default.
Performance: Vector index; cache provider JSON; only fetch from TMDB when needed.
Reliability: Idempotent upserts for movies; graceful API fallbacks.
Accessibility: Keyboard navigable, alt text on posters, color-contrast ≥ WCAG AA.
8) Data Model (lean)
Global movie metadata is shared (no RLS). Household data is scoped (RLS).
-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists vector;

-- Global catalog (shared)
create table public.movies (
  tmdb_id        integer primary key,
  title          text not null,
  year           int,
  poster_path    text,
  overview       text,
  runtime        int,
  mpaa           text,
  genres         text[],
  keywords       text[],
  popularity     numeric,
  embedding      vector(1536),          -- set to your embedding model dim
  last_fetched_at timestamptz default now()
);
create index if not exists movies_genres_gin on public.movies using gin (genres);
create index if not exists movies_embed_ivf on public.movies using ivfflat (embedding vector_cosine_ops) with (lists=100);

-- Provider cache (shared)
create table public.movie_providers (
  tmdb_id   integer references public.movies on delete cascade,
  region    text not null,
  providers jsonb not null,             -- {flatrate:[...], buy:[...], rent:[...]}
  updated_at timestamptz not null default now(),
  primary key (tmdb_id, region)
);

-- Tenancy
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null default 'US'
);

create table public.household_members (
  household_id uuid references public.households on delete cascade,
  user_id uuid not null,                -- supabase auth uid
  role text not null default 'member',  -- 'owner'|'member'
  primary key (household_id, user_id)
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  household_id uuid references public.households on delete cascade,
  display_name text not null,
  birth_year int
);

create table public.family_prefs (
  household_id uuid primary key references public.households on delete cascade,
  allowed_ratings text[] not null default array['G','PG','PG-13'],
  max_runtime int not null default 140,
  blocked_keywords text[] not null default '{}'::text[]
);

create table public.list_items (
  id bigserial primary key,
  household_id uuid not null references public.households on delete cascade,
  tmdb_id integer not null references public.movies(tmdb_id) on delete cascade,
  list_type text not null check (list_type in ('queue','blocked','favorite')),
  added_by uuid,                         -- profiles.id (optional)
  created_at timestamptz not null default now(),
  unique (household_id, tmdb_id, list_type)
);

create table public.watches (
  id bigserial primary key,
  household_id uuid not null references public.households on delete cascade,
  profile_id uuid references public.profiles on delete set null,
  tmdb_id integer not null references public.movies(tmdb_id) on delete cascade,
  watched_at timestamptz not null default now(),
  rewatch boolean not null default false
);

create table public.ratings (
  household_id uuid not null references public.households on delete cascade,
  profile_id uuid references public.profiles on delete set null,
  tmdb_id integer not null references public.movies(tmdb_id) on delete cascade,
  rating int not null check (rating between 1 and 10),
  rated_at timestamptz not null default now(),
  primary key (household_id, profile_id, tmdb_id)
);

create table public.family_taste (
  household_id uuid primary key references public.households on delete cascade,
  taste vector(1536),
  updated_at timestamptz not null default now()
);
RLS & Policies (household-scoped tables)
-- Helper
create or replace function public.is_member(h uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.household_members
    where household_id = h and user_id = auth.uid()
  );
$$;

-- Enable RLS
alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.profiles          enable row level security;
alter table public.family_prefs      enable row level security;
alter table public.list_items        enable row level security;
alter table public.watches           enable row level security;
alter table public.ratings           enable row level security;
alter table public.family_taste      enable row level security;

-- Policies (pattern)
create policy select_household on public.households
  for select using (is_member(id));
create policy modify_household on public.households
  for all using (is_member(id)) with check (true);

-- Repeat same shape for other household_id tables:
-- using (is_member(household_id))  with check (is_member(household_id));

-- Global tables remain public readable (no RLS):
-- movies, movie_providers
SQL RPC (optional but nice)
rpc.recommend_for_household(limit int default 10) → returns tmdb_id list ordered by <-> distance to family_taste.taste, filtered by family_prefs.
9) API Contracts (server tools)
All tools are server-side functions (typed with Zod). Sketch:
// tmdb.search
{ query: string; year?: number }
→ [{ tmdb_id:number, title:string, year:number, poster_path?:string, mpaa?:string, runtime?:number }...]

// db.add_to_queue
{ tmdb_id:number }
→ { ok:true }

// db.recommend
{ limit?:number }
→ [{ tmdb_id:number, title:string, poster_path?:string, mpaa?:string, runtime?:number, providers?:any }...]

// db.mark_watched
{ tmdb_id:number, rating?:1|2|3|4|5 }
→ { ok:true }
10) AI Behavior Spec
System Prompt (concise):
“You are a family-friendly movie concierge. Always respect the household’s allowed ratings, max runtime, and blocked keywords. Prefer concise recommendations with 1–2 sentences of rationale and where-to-watch if available. Use tools for all actions; do not fabricate data.”
Tool-use rules:
Never suggest movies outside family_prefs.
When unsure which movie the user means, call tmdb.search first.
After db.mark_watched, call a taste refresh helper (server-side) synchronously.
11) UI/UX
/login → magic link.
/chat (default) → sticky chat + suggestion chips.
/queue → cards with “Watch next”, “Mark watched”, “Remove”.
/history → watched list, ratings.
/settings → household prefs.
Card content: poster, title (year), MPAA badge, runtime, top genres, provider chips.
12) Observability & Analytics
Minimal request logs (no raw PII in logs).
Track: searches, add_to_queue, recommend served, mark_watched, rating given.
13) Ops
Nightly cron (optional): refresh movie_providers for items in queue + recent recs.
Backups: Supabase automated; keep weekly retention ≥ 4 weeks.
14) Risks & Mitigations
TMDB outages: Cache essential fields in movies; degrade gracefully.
RLS misconfig: Unit tests that assert cross-household access is denied.
Model drift: Tools are typed; server validates all inputs; strict filters enforced in SQL.
Action Plan — Steps for the Code Agent
Deterministic, from empty repo to production. Use Node LTS, pnpm, Supabase CLI, Docker.
0) Preflight
Verify tools: node -v, pnpm -v, supabase -v, docker -v.
Create a new Git repo: git init family-movies && cd family-movies.
1) Scaffold App
pnpm create next-app@latest .
pnpm add @supabase/supabase-js zod
pnpm add -D @types/node typescript
# Chat SDK (or your preferred chat hook)
pnpm add ai @ai-sdk/openai
2) Environment & Secrets
Create .env.local (dev) and Vercel env (prod):
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # server-only
OPENAI_API_KEY=...
TMDB_API_KEY=...
APP_REGION=US
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIM=1536
Guardrail: Never expose SUPABASE_SERVICE_ROLE_KEY to the client bundle.
3) Supabase Setup
supabase init
supabase start            # local stack
supabase link --project-ref <your-project>   # if using hosted
Create the schema: supabase db push with the SQL from the PRD.
Enable pgvector in the migration file.
Add RLS policies exactly as specified.
Seed: at least one households row + your household_members binding your auth uid.
4) Auth & Session
In Next.js, set up Supabase client (server & client helpers).
Implement magic link login route/page.
Middleware to redirect unauthenticated users to /login.
5) TMDB Integration (server only)
Create /lib/tmdb.ts with:
search(query, year?)
getDetails(tmdb_id)
getWatchProviders(tmdb_id)
Normalize results → minimal fields for movies and movie_providers.
6) DB Tool Functions (server)
Create /server/tools.ts:
addToQueue(tmdb_id):
Upsert movies (details from TMDB if missing), including embedding (compute once in server using your embedding model).
Upsert list_items(..., list_type='queue').
recommend(limit=10):
Read family_prefs; build SQL where-clause for ratings/runtime/keywords.
If family_taste exists: vector KNN (ORDER BY embedding <-> taste).
Join movie_providers for region.
markWatched(tmdb_id, rating?):
Insert watches.
If rating provided: upsert ratings, recompute household family_taste as mean of embeddings of movies rated ≥4.
Utility: refreshTaste(household_id) to compute vector mean in SQL.
Taste recompute (SQL idea):
update public.family_taste ft set
  taste = sub.mean_vec,
  updated_at = now()
from (
  select r.household_id, avg(m.embedding) as mean_vec
  from public.ratings r
  join public.movies m on m.tmdb_id = r.tmdb_id
  where r.rating >= 4 and r.household_id = ft.household_id
  group by r.household_id
) sub
where ft.household_id = sub.household_id;
7) Chat Route & Typed Tools
Create app/api/chat/route.ts:
Import OpenAI client via your chat SDK.
Define Zod-typed tools: tmdb_search, add_to_queue, recommend, mark_watched.
Stream responses; tool results render as cards in the chat.
8) UI
/chat: Chat window, result cards with actions (Add / Watch / Rate).
/queue: Grid of queued items; action buttons.
/history: Watched list with filters.
/settings: Form for family_prefs (update via simple update ... where household_id = ...).
Shared components: MovieCard, ProviderChips, RatingStars.
9) Provider Refresh (optional but recommended)
Supabase Edge Function refresh_providers:
For all movies in queue (and last N recommendations), call TMDB providers and upsert movie_providers.
Supabase Cron nightly trigger → call refresh_providers.
10) Tests
Unit: Zod schemas; server tools (mock TMDB and DB).
RLS: SQL tests ensuring cross-household access denied.
E2E (Playwright): login → search → add_to_queue → recommend → mark_watched → see in history.
11) Performance Checks
Create vector IVF index (already in SQL).
Cap recommendation limit to ≤ 24.
Simple in-memory LRU in server for last 100 TMDB detail lookups.
12) Deploy
Push repo to GitHub.
Deploy Next.js to Vercel (or your host).
Set env vars (no service role on client).
Point production app to hosted Supabase DB.
Verify:
Signup/login round trip.
RLS audit (attempt cross-household read → 0 rows).
Chat can: search/add/recommend/mark watched.
13) Definition of Done (MVP)
All four tools callable from chat and reflected in DB.
Household prefs enforced in SQL and visible in UI.
Vector recs return ≤ 2.5s P95 from a warm state.
Basic accessibility pass (keyboard, alt text, contrast).
E2E suite green in CI.
14) Nice-to-Have (Post-MVP)
Trakt import (OAuth).
Multi-household support in UI switcher.
“Movie night” mode that proposes 3 options and collects quick votes.
iOS/Android PWA installability.
Deliverables Snapshot (what the agent should produce)
/app/api/chat/route.ts — chat + tools
/server/tools.ts — TMDB + DB functions
/lib/supabase.ts — client/server helpers
/lib/tmdb.ts — TMDB calls
/app/(routes)/chat|queue|history|settings — pages
/db/migrations/XXXXXXXX.sql — schema + RLS + indexes
Edge function: supabase/functions/refresh_providers/index.ts
Tests: tests/rls.sql, tests/e2e/*.spec.ts
README.md — quickstart with env, scripts, and runbook
