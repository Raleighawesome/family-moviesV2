# Family Movies v2 - TODO List

**Last Updated:** 2025-10-17
**Status:** 9/18 Phases Complete
**Current Phase:** Ready for Phase 10

---

## ✅ Completed Phases (0-9)

- [x] **Phase 0:** Environment verification and project initialization
- [x] **Phase 1:** Scaffold Next.js app with required dependencies
- [x] **Phase 2:** Set up Supabase local development environment
- [x] **Phase 3:** Create database schema with migrations (tables, RLS, indexes)
- [x] **Phase 4:** Implement Supabase client helpers (server & client)
- [x] **Phase 5:** TMDB Integration Layer - Complete with rate limiting, normalization, and testing
- [x] **Phase 6:** OpenAI Embedding Service - Complete with semantic similarity validation
- [x] **Phase 7:** Server-Side Tools - 4 AI-callable functions with Zod validation
- [x] **Phase 8:** AI Chat Route - Streaming chat with GPT-4o and tool integration
- [x] **Phase 9:** Authentication - Magic link login with middleware protection

---

## 🔐 Phase 9: Authentication (Magic Link)

**Goal:** Secure login and session management

**Tasks:**

### 9.1: Login Page
- [ ] Create `app/login/page.tsx`
  - [ ] Email input form
  - [ ] "Send Magic Link" button
  - [ ] Call `supabase.auth.signInWithOtp({ email })`
  - [ ] Show success message: "Check your email!"
  - [ ] Handle errors (invalid email, rate limit)

### 9.2: Auth Callback
- [ ] Create `app/auth/callback/route.ts`
  - [ ] Exchange code for session
  - [ ] Set cookies via Supabase client
  - [ ] Redirect to `/chat`
  - [ ] Handle errors (invalid token, expired)

### 9.3: Middleware
- [ ] Create `middleware.ts`
  - [ ] Check `auth.getUser()` on protected routes
  - [ ] Redirect to `/login` if unauthenticated
  - [ ] Allow public routes: `/login`, `/auth/callback`
  - [ ] Refresh session if needed

### 9.4: Logout
- [ ] Add logout button to app layout
- [ ] Create `app/auth/logout/route.ts`
  - [ ] Call `supabase.auth.signOut()`
  - [ ] Clear cookies
  - [ ] Redirect to `/login`

**Acceptance Criteria:**
- [ ] User can sign in with email
- [ ] Magic link works (check Mailpit at localhost:54324)
- [ ] Session persists across page reloads
- [ ] Unauthenticated users redirected to login
- [ ] User can log out

---

## 🎨 Phase 10: UI Pages

**Goal:** Main application routes

**Tasks:**

### 10.1: Chat Page
- [ ] Create `app/chat/page.tsx`
  - [ ] Import `useChat` from `ai/react`
  - [ ] Render chat messages (user + assistant)
  - [ ] Input field + send button
  - [ ] Display tool results as movie cards
  - [ ] Auto-scroll to latest message
  - [ ] Show loading state while streaming

### 10.2: Queue Page
- [ ] Create `app/queue/page.tsx`
  - [ ] Fetch queue items: `list_items` where `list_type='queue'`
  - [ ] Display as grid of MovieCards
  - [ ] Actions: "Mark Watched", "Remove from Queue"
  - [ ] Empty state: "Your queue is empty"
  - [ ] Sort by: date added (newest first)

### 10.3: History Page
- [ ] Create `app/history/page.tsx`
  - [ ] Fetch watch history: join `watches` + `movies` + `ratings`
  - [ ] Display as list with watch date
  - [ ] Show ratings if available
  - [ ] Filter by: "All", "Rated", "Unrated"
  - [ ] Sort by: watch date (newest first)

### 10.4: Settings Page
- [ ] Create `app/settings/page.tsx`
  - [ ] Display current household name
  - [ ] Form for `family_prefs`:
    - [ ] Allowed ratings checkboxes (G, PG, PG-13, R, etc.)
    - [ ] Max runtime slider (60-240 min)
    - [ ] Blocked keywords textarea
  - [ ] Save button → update `family_prefs` table
  - [ ] Success/error toast

### 10.5: Navigation
- [ ] Update `app/layout.tsx`
  - [ ] Add navigation bar with links: Chat, Queue, History, Settings
  - [ ] Show household name in nav
  - [ ] Add logout button
  - [ ] Responsive mobile menu

**Acceptance Criteria:**
- [ ] All pages render without errors
- [ ] Navigation works between pages
- [ ] Data fetched correctly from Supabase
- [ ] UI is responsive (mobile + desktop)
- [ ] Loading states shown appropriately

---

## 🧩 Phase 11: Shared Components

**Goal:** Reusable UI building blocks

**Tasks:**

### 11.1: MovieCard Component
- [ ] Create `components/MovieCard.tsx`
  - [ ] Props: `movie`, `actions` (array of action buttons)
  - [ ] Display:
    - [ ] Poster image (TMDB URL)
    - [ ] Title (year)
    - [ ] MPAA badge (color-coded)
    - [ ] Runtime (e.g., "1h 21m")
    - [ ] Top 3 genres as chips
    - [ ] Where to watch (ProviderChips)
  - [ ] Action buttons (conditional):
    - [ ] "Add to Queue"
    - [ ] "Mark Watched"
    - [ ] "Rate" (RatingStars)
    - [ ] "Remove"
  - [ ] Accessibility: alt text on poster, keyboard navigable

### 11.2: ProviderChips Component
- [ ] Create `components/ProviderChips.tsx`
  - [ ] Props: `providers` (JSONB from `movie_providers`)
  - [ ] Display provider logos (flatrate > rent > buy)
  - [ ] Max 5 providers, then "+X more"
  - [ ] Tooltip on hover: provider name
  - [ ] Empty state: "Not available to stream"

### 11.3: RatingStars Component
- [ ] Create `components/RatingStars.tsx`
  - [ ] Props: `rating` (1-5), `onChange` (optional)
  - [ ] Display: 5 stars (filled/empty)
  - [ ] Interactive mode: click to rate
  - [ ] Read-only mode: just display
  - [ ] Keyboard accessible (arrow keys)

### 11.4: ChatMessage Component
- [ ] Create `components/ChatMessage.tsx`
  - [ ] Props: `message` (user/assistant), `toolResults`
  - [ ] User messages: right-aligned, blue background
  - [ ] Assistant messages: left-aligned, gray background
  - [ ] Tool results: render as MovieCard grid
  - [ ] Markdown support in assistant messages
  - [ ] Timestamp display

**Acceptance Criteria:**
- [ ] Components are reusable across pages
- [ ] Props are TypeScript typed
- [ ] Components are accessible (WCAG AA)
- [ ] Components handle loading/error states
- [ ] Components are responsive

---

## ⚡ Phase 12: Supabase Edge Function (Optional)

**Goal:** Nightly refresh of watch provider data

**Tasks:**
- [ ] Create `supabase/functions/refresh-providers/index.ts`
  - [ ] Fetch all movies in queues (across all households)
  - [ ] Fetch recently recommended movies (last 7 days)
  - [ ] For each movie:
    - [ ] Call TMDB watch providers API
    - [ ] Upsert into `movie_providers` table
  - [ ] Handle rate limits (batch requests)
  - [ ] Log results (success/failure counts)
- [ ] Deploy Edge Function: `supabase functions deploy refresh-providers`
- [ ] Set up Supabase Cron (via Dashboard or SQL)
  - [ ] Schedule: daily at 2:00 AM
  - [ ] Invoke: `refresh-providers` function
- [ ] Test manual invocation

**Acceptance Criteria:**
- [ ] Edge Function deploys successfully
- [ ] Function fetches and updates provider data
- [ ] Cron job runs on schedule
- [ ] Provider data stays fresh (updated daily)

---

## 🔒 Phase 13: RLS Security Tests

**Goal:** Verify Row Level Security prevents data leaks

**Tasks:**
- [ ] Create `tests/rls.sql`
  - [ ] Test 1: Cross-household SELECT denied
    ```sql
    -- Login as user A (household 1)
    -- Attempt to SELECT from household 2 tables
    -- Expect: 0 rows returned
    ```
  - [ ] Test 2: Cross-household INSERT denied
    ```sql
    -- Login as user A (household 1)
    -- Attempt to INSERT into household 2 list_items
    -- Expect: Permission denied error
    ```
  - [ ] Test 3: is_member() function works
    ```sql
    -- Verify is_member(own_household) = true
    -- Verify is_member(other_household) = false
    ```
  - [ ] Test 4: Service role bypasses RLS
    ```sql
    -- Use service role key
    -- Verify can access all households
    ```
- [ ] Run tests: `psql -f tests/rls.sql`
- [ ] Document test results

**Acceptance Criteria:**
- [ ] All RLS tests pass
- [ ] 0 PII leaks confirmed
- [ ] Service role can access all data (admin)
- [ ] Test suite is reproducible

---

## 🧪 Phase 15: Unit Tests

**Goal:** Test tools and schemas in isolation

**Tasks:**
- [ ] Install testing framework: `pnpm add -D vitest @vitest/ui`
- [ ] Configure `vitest.config.ts`
- [ ] Create `tests/tools/tmdb-search.test.ts`
  - [ ] Mock TMDB API responses
  - [ ] Test: successful search returns results
  - [ ] Test: no results returns empty array
  - [ ] Test: API error handled gracefully
- [ ] Create `tests/tools/add-to-queue.test.ts`
  - [ ] Mock Supabase client
  - [ ] Mock TMDB API
  - [ ] Test: movie added to DB and queue
  - [ ] Test: duplicate movie doesn't fail
  - [ ] Test: embedding generated
- [ ] Create `tests/schemas.test.ts`
  - [ ] Test all Zod schemas validate correctly
  - [ ] Test invalid inputs are rejected
- [ ] Add npm script: `"test": "vitest"`
- [ ] Run tests: `pnpm test`

**Acceptance Criteria:**
- [ ] All unit tests pass
- [ ] Code coverage ≥ 70%
- [ ] Mocks are realistic
- [ ] Tests are deterministic (no flakiness)

---

## 🎭 Phase 16: E2E Tests with Playwright

**Goal:** Test complete user flows

**Tasks:**
- [ ] Install Playwright: `pnpm add -D @playwright/test`
- [ ] Initialize: `npx playwright install`
- [ ] Create `tests/e2e/auth.spec.ts`
  - [ ] Test: User can sign in with magic link
  - [ ] Test: Unauthenticated user redirected to login
  - [ ] Test: User can log out
- [ ] Create `tests/e2e/chat.spec.ts`
  - [ ] Test: User searches for movie
  - [ ] Test: User adds movie to queue
  - [ ] Test: User gets recommendations
  - [ ] Test: User marks movie as watched with rating
- [ ] Create `tests/e2e/queue.spec.ts`
  - [ ] Test: Queue displays added movies
  - [ ] Test: User can remove movie from queue
  - [ ] Test: User can mark movie as watched from queue
- [ ] Add npm script: `"test:e2e": "playwright test"`
- [ ] Run tests: `pnpm test:e2e`

**Acceptance Criteria:**
- [ ] All E2E tests pass
- [ ] Tests run headless in CI
- [ ] Screenshots/videos captured on failure
- [ ] Tests cover critical user paths

---

## ⚡ Phase 17: Performance Optimization

**Goal:** Achieve P95 chat latency < 2.5s

**Tasks:**
- [ ] Implement LRU cache for TMDB API
  - [ ] Create `lib/cache/lru.ts` (100 entry max)
  - [ ] Cache TMDB responses for 24 hours
  - [ ] Cache embeddings permanently (in DB)
- [ ] Add database indexes (verify with EXPLAIN)
  - [ ] Check query plans for recommendation RPC
  - [ ] Ensure vector index is being used
- [ ] Optimize recommendation query
  - [ ] Cap limit to 24 movies
  - [ ] Use pagination for large result sets
- [ ] Add loading states
  - [ ] Create `app/chat/loading.tsx`
  - [ ] Create `app/queue/loading.tsx`
  - [ ] Skeleton screens for MovieCard
- [ ] Enable Next.js optimizations
  - [ ] Image optimization (next/image)
  - [ ] Route prefetching
  - [ ] Static generation where possible
- [ ] Measure performance
  - [ ] Use Vercel Speed Insights (or similar)
  - [ ] Log P95 chat latency
  - [ ] Verify < 2.5s target met

**Acceptance Criteria:**
- [ ] P95 chat round-trip < 2.5s
- [ ] TMDB API calls minimized (via cache)
- [ ] Database queries optimized
- [ ] Loading states improve perceived performance
- [ ] Lighthouse score ≥ 90

---

## 📚 Phase 18: Documentation

**Goal:** Comprehensive README and runbook

**Tasks:**
- [ ] Create `README.md`
  - [ ] Project overview and goals
  - [ ] Tech stack diagram
  - [ ] Prerequisites (Node, pnpm, Docker, etc.)
  - [ ] Quick start guide:
    ```bash
    git clone ...
    pnpm install
    supabase start
    supabase db reset
    # Add API keys to .env.local
    pnpm dev
    ```
  - [ ] Environment variables reference
  - [ ] Database schema diagram
  - [ ] Architecture overview
  - [ ] API documentation (tools)
  - [ ] Deployment guide (Vercel + Supabase)
  - [ ] Troubleshooting common issues
  - [ ] Contributing guidelines
  - [ ] License (MIT)
- [ ] Create `ARCHITECTURE.md`
  - [ ] High-level architecture diagram
  - [ ] Data flow (user → chat → tools → DB → AI)
  - [ ] Security model (RLS, service role)
  - [ ] Vector similarity search explanation
  - [ ] Caching strategy
- [ ] Create `DEPLOYMENT.md`
  - [ ] Production checklist
  - [ ] Vercel setup steps
  - [ ] Supabase hosted setup
  - [ ] Environment variable configuration
  - [ ] Database migration process
  - [ ] Monitoring and alerts
- [ ] Update `progress.md` with final status

**Acceptance Criteria:**
- [ ] README is comprehensive and clear
- [ ] New developer can set up locally in < 15 minutes
- [ ] All environment variables documented
- [ ] Deployment guide is step-by-step
- [ ] Architecture is well explained

---

## 🚀 Final Production Checklist

**Before deploying to production:**

### Supabase Setup
- [ ] Create Supabase hosted project
- [ ] Run migrations: `supabase db push`
- [ ] Verify RLS policies in production
- [ ] Set up auth email templates (magic link)
- [ ] Configure SMTP settings (or use Supabase email)
- [ ] Enable database backups (weekly retention ≥ 4 weeks)

### Vercel Deployment
- [ ] Connect GitHub repo to Vercel
- [ ] Set environment variables:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `OPENAI_API_KEY`
  - [ ] `TMDB_API_KEY`
  - [ ] `APP_REGION`
  - [ ] `EMBEDDING_MODEL`
  - [ ] `EMBEDDING_DIM`
- [ ] Deploy: `vercel --prod`
- [ ] Verify deployment works

### Testing
- [ ] Test magic link login (real email)
- [ ] Test RLS policies (attempt cross-household access)
- [ ] Test all 4 AI tools (search, add, recommend, watched)
- [ ] Test on mobile devices
- [ ] Run E2E test suite against production

### Monitoring
- [ ] Set up Vercel Analytics
- [ ] Set up Sentry (error tracking)
- [ ] Monitor OpenAI API usage
- [ ] Monitor TMDB API usage
- [ ] Set up alerts for errors

### Security
- [ ] Verify service role key not in client bundle
- [ ] Run RLS audit tests
- [ ] Enable HTTPS only
- [ ] Set up CSP headers
- [ ] Review auth settings

---

## Success Metrics (Track Post-Launch)

- [ ] **TTFW** ≤ 60 seconds (time to first watch suggestion)
- [ ] **Engagement** ≥ 70% of sessions include add-to-queue or mark-watched
- [ ] **Security** 0 PII leaks between households (RLS audit passes)
- [ ] **Performance** P95 chat round-trip < 2.5s
- [ ] **Quality** E2E test suite green in CI
- [ ] **Accessibility** WCAG AA compliance

---

## Post-MVP Enhancements (vNext)

**Not required for MVP, but nice to have:**

- [ ] Trakt.tv import (OAuth integration)
- [ ] Multi-household switcher in UI
- [ ] "Movie Night" voting mode (3 options, quick votes)
- [ ] iOS/Android PWA installability
- [ ] Advanced filters (decade, language, streaming service)
- [ ] Collaborative queue (multiple users voting)
- [ ] Watch party scheduling
- [ ] Notifications (new recommendations, movie leaving streaming)
- [ ] Social features (share recommendations with other households)
- [ ] AI-generated movie summaries for kids
- [ ] Parental controls (per-profile content filters)
- [ ] Multi-language support (i18n)

---

## Notes

- Prioritize phases 5-9 for functional MVP
- Phases 10-11 are critical for usable UI
- Phases 13-16 are essential for production readiness
- Phase 12 (Edge Function) is optional but recommended
- Phase 17-18 can be done iteratively post-launch

**Estimated timeline:** 2-3 weeks for full MVP (phases 5-18)
