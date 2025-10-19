# Family Movies v2 - Development Progress

**Last Updated:** 2025-10-17
**Status:** Phase 9 Complete (Authentication Ready)
**Next Phase:** 10 - UI Pages

---

## Executive Summary

A private, family-friendly movie concierge built with Next.js, Supabase, and AI. The application uses vector similarity search for personalized recommendations, enforces household content filters, and provides a chat-based interface for movie discovery.

**Tech Stack:**
- **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS
- **Backend:** Next.js API Routes, Server Actions
- **Database:** Supabase (PostgreSQL + pgvector + Auth + RLS)
- **AI:** OpenAI (GPT-4 for chat, text-embedding-3-small for vectors)
- **Metadata:** TMDB API (movies, providers)
- **Package Manager:** pnpm

---

## Completed Work (Phases 0-9)

### Phase 0: Environment Setup ✅
**Files Created:**
- `.gitignore` - Comprehensive ignore patterns
- Git repository initialized

**Verifications:**
- ✅ Node.js v20.9.0
- ✅ pnpm v10.18.3 (installed globally)
- ✅ Supabase CLI v2.51.0
- ✅ Docker v28.3.2

---

### Phase 1: Next.js Scaffold ✅
**Files Created:**
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `next.config.js` - Next.js config (TMDB image domains)
- `tailwind.config.ts` - Tailwind CSS setup
- `postcss.config.js` - PostCSS for Tailwind
- `.eslintrc.json` - ESLint configuration
- `app/layout.tsx` - Root layout
- `app/page.tsx` - Homepage (redirects to /chat)
- `app/globals.css` - Global styles with Tailwind
- `.env.local.example` - Environment template

**Key Dependencies Installed:**
```json
{
  "@supabase/supabase-js": "^2.75.1",
  "@supabase/ssr": "^0.7.0",
  "ai": "^3.4.33",
  "@ai-sdk/openai": "^0.0.66",
  "next": "^14.2.33",
  "react": "^18.3.1",
  "zod": "^3.25.76"
}
```

---

### Phase 2: Supabase Local Stack ✅
**Setup:**
- Initialized Supabase project: `supabase init`
- Started local Docker containers: `supabase start`
- Created `.env.local` with local credentials

**Supabase Services Running:**
- **Studio UI:** http://127.0.0.1:54323
- **API:** http://127.0.0.1:54321
- **Database:** postgresql://postgres:postgres@127.0.0.1:54322/postgres
- **Mailpit (email testing):** http://127.0.0.1:54324

**Credentials (Local):**
```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### Phase 3: Database Schema ✅
**Migration File:** `supabase/migrations/20251017162752_init_schema.sql`

**Extensions Enabled:**
- `uuid-ossp` - UUID generation
- `pgcrypto` - Cryptographic functions
- `vector` - pgvector for embeddings (1536 dimensions)

**Tables Created:**

#### Global Tables (No RLS - Shared Metadata)
1. **`movies`** - Movie catalog from TMDB
   - Primary key: `tmdb_id` (integer)
   - Fields: title, year, poster_path, overview, runtime, mpaa, genres[], keywords[], popularity
   - **Vector field:** `embedding` vector(1536) for similarity search
   - **Indexes:** GIN on genres/keywords, IVFFlat on embedding, B-tree on title/year/popularity

2. **`movie_providers`** - Cached watch provider data
   - Composite key: `(tmdb_id, region)`
   - Fields: providers (JSONB with flatrate/buy/rent arrays), updated_at

#### Household Tables (RLS Enforced - Multi-tenant)
3. **`households`** - Tenant root
   - Primary key: `id` (UUID)
   - Fields: name, region, created_at

4. **`household_members`** - User-household mapping
   - Composite key: `(household_id, user_id)`
   - Fields: role ('owner' | 'member'), joined_at
   - Links to `auth.users(id)` via user_id

5. **`profiles`** - User profiles within households
   - Primary key: `id` (UUID)
   - Unique constraint: `(user_id, household_id)`
   - Fields: display_name, birth_year

6. **`family_prefs`** - Content filters
   - Primary key: `household_id`
   - Fields:
     - `allowed_ratings` text[] - Default: ['G','PG','PG-13']
     - `max_runtime` int - Default: 140 minutes
     - `blocked_keywords` text[] - Default: []

7. **`list_items`** - Queue, blocked, favorites
   - Primary key: `id` (bigserial)
   - Unique constraint: `(household_id, tmdb_id, list_type)`
   - Fields: list_type ('queue'|'blocked'|'favorite'), added_by, created_at

8. **`watches`** - Watch history
   - Primary key: `id` (bigserial)
   - Fields: profile_id, tmdb_id, watched_at, rewatch (boolean)

9. **`ratings`** - 1-5 star ratings
   - Composite key: `(household_id, profile_id, tmdb_id)`
   - Constraint: rating BETWEEN 1 AND 5

10. **`family_taste`** - Collaborative filtering vector
    - Primary key: `household_id`
    - Fields: `taste` vector(1536), updated_at
    - Computed from movies rated ≥4 stars

**Security Functions:**
```sql
-- Check if current user belongs to household
is_member(household_id uuid) → boolean

-- Get all household IDs for current user
user_households() → setof uuid
```

**RLS Policies:**
- All household tables have SELECT/INSERT/UPDATE/DELETE policies
- All policies use `is_member(household_id)` check
- Global tables (movies, movie_providers) have no RLS - publicly readable

**Stored Procedures:**
```sql
-- Recompute taste vector from high ratings (≥4 stars)
refresh_family_taste(household_id uuid) → void

-- Get personalized recommendations with filters applied
recommend_for_household(household_id uuid, limit int) → table(...)
  - Returns: tmdb_id, title, year, poster, mpaa, runtime, genres, distance
  - Uses vector similarity if taste exists, else popularity
  - Filters by: allowed_ratings, max_runtime, blocked keywords
  - Excludes: blocked movies, already watched (unless rewatch)
```

**Seed Data:** `supabase/seed.sql`
- Demo household: `11111111-1111-1111-1111-111111111111`
- Demo user: `3e5b0c12-e3cd-4be3-a25a-2e8f4e162c9a` (default local Supabase user)
- Sample movies: Toy Story (862), Titanic (597), Forrest Gump (13)
- Family prefs: G/PG/PG-13, 140min max

---

### Phase 4: Supabase Clients ✅
**Files Created:**

1. **`lib/supabase/client.ts`** - Browser client
   ```typescript
   createClient() // Uses @supabase/ssr for client components
   ```

2. **`lib/supabase/server.ts`** - Server client
   ```typescript
   createClient() // Cookie-based auth for server components
   createServiceClient() // Service role for admin ops (NEVER expose to client)
   ```

3. **`lib/supabase/types.ts`** - Auto-generated TypeScript types
   - Generated via: `supabase gen types typescript --local`
   - Includes all table schemas, RPCs, enums
   - Type-safe database access

4. **`lib/supabase/queries.ts`** - Helper queries
   ```typescript
   getCurrentHousehold() // Get user's primary household
   getCurrentProfile() // Get user's profile in current household
   ```

---

### Phase 5: TMDB Integration ✅
**Files Created:**

1. **`lib/tmdb/types.ts`** - TypeScript types for TMDB API responses
   - `TMDBSearchResult`, `TMDBMovieDetails`, `TMDBReleaseDatesResponse`
   - `TMDBKeywordsResponse`, `TMDBWatchProvidersResponse`, `TMDBCreditsResponse`
   - Complete type definitions for all TMDB API endpoints used

2. **`lib/tmdb/client.ts`** - TMDB API client with rate limiting
   ```typescript
   searchMovies(query, year?, page) // Search for movies
   getMovieDetails(tmdbId) // Get full movie details
   getMovieReleaseDates(tmdbId) // Get release dates and certifications
   extractMPAARating(releaseDates) // Extract US MPAA rating
   getMovieKeywords(tmdbId) // Get movie keywords
   getMovieWatchProviders(tmdbId) // Get streaming availability
   getMovieCredits(tmdbId) // Get cast and crew
   getCompleteMovieData(tmdbId) // Fetch all data in parallel
   getTMDBImageUrl(path, size) // Build image URLs
   ```

3. **`lib/tmdb/normalize.ts`** - Data normalization utilities
   ```typescript
   normalizeTMDBMovie(details, mpaaRating, keywords) // Convert to DB format
   normalizeTMDBProviders(tmdbId, region, watchProviders) // Convert providers
   extractDirectors(credits) // Extract directors from credits
   extractMainCast(credits, limit) // Extract top N actors
   formatRuntime(minutes) // Format as "2h 15m"
   isFamilyFriendly(mpaa, allowedRatings) // Check rating compatibility
   hasBlockedKeywords(movieKeywords, blockedKeywords) // Check for blocked content
   ```

4. **`lib/tmdb/index.ts`** - Module exports
   - Re-exports all types, client functions, and utilities
   - Single entry point for TMDB integration

5. **`lib/tmdb/test.ts`** - Integration test script
   - Tests search, details, normalization, and watch providers
   - Validates full TMDB integration workflow
   - Run with: `pnpm tsx lib/tmdb/test.ts`

**Features Implemented:**
- ✅ Rate limiting (40 requests/second, under TMDB's 50/sec limit)
- ✅ Error handling with descriptive messages
- ✅ MPAA rating extraction from US release dates
- ✅ Watch provider support (streaming, rent, buy)
- ✅ Keywords and credits fetching
- ✅ Parallel data fetching for efficiency
- ✅ Data normalization to match database schema
- ✅ Image URL builder with configurable sizes

**Test Results:**
```
✅ Search: "The Lion King" (1994) → Found TMDB ID 8587
✅ Details: G rating, 89 min, Family/Animation/Drama/Adventure
✅ Keywords: "father murder", "africa", "lion", "redemption", etc.
✅ Directors: Roger Allers, Rob Minkoff
✅ Cast: Matthew Broderick, Moira Kelly, Nathan Lane, etc.
✅ Providers: Disney Plus (streaming), Apple TV/Google Play (rent/buy)
✅ Normalization: Successfully converted to database format
```

**Dependencies Added:**
- `dotenv` - Environment variable loading for tests
- `tsx` - TypeScript execution for test scripts

---

### Phase 6: Embedding Service ✅
**Files Created:**

1. **`lib/openai/types.ts`** - TypeScript types for OpenAI API
   - `OpenAIEmbeddingResponse` - API response format
   - `EmbeddingOptions` - Configuration options
   - `MovieEmbeddingInput` - Movie metadata input format

2. **`lib/openai/embeddings.ts`** - OpenAI embedding generation
   ```typescript
   generateEmbedding(text, options?) // Generate embedding for any text
   generateMovieEmbedding(movie, options?) // Generate embedding from movie metadata
   embeddingToVector(embedding) // Convert to PostgreSQL vector format
   generateEmbeddingsBatch(texts[]) // Batch generate embeddings
   cosineSimilarity(a, b) // Calculate similarity between vectors
   ```

3. **`lib/openai/index.ts`** - Module exports
   - Re-exports all types and functions
   - Single entry point for OpenAI integration

4. **`lib/openai/test.ts`** - Comprehensive test suite
   - Tests embedding generation with correct dimensions
   - Tests movie embedding with metadata combination
   - Tests semantic similarity calculations
   - Validates PostgreSQL vector format conversion
   - Tests error handling for edge cases
   - Run with: `pnpm tsx lib/openai/test.ts`

**Features Implemented:**
- ✅ Text embedding generation using `text-embedding-3-small` (1536 dimensions)
- ✅ Movie embedding combining: title (2x weight), overview, genres, keywords
- ✅ Rate limiting (4500 requests/minute, under OpenAI's 5000/min limit)
- ✅ Exponential backoff retry logic for transient errors
- ✅ PostgreSQL pgvector format conversion
- ✅ Cosine similarity calculation for semantic search
- ✅ Batch embedding generation support
- ✅ Comprehensive error handling

**Movie Embedding Strategy:**
The `generateMovieEmbedding()` function creates rich semantic representations by:
1. Including title twice (for emphasis/weight)
2. Adding full overview (plot summary)
3. Including genres as categorical signals
4. Adding top 10 keywords for thematic context

This approach creates embeddings that capture both explicit content (genres) and semantic meaning (plot themes), enabling accurate similarity-based recommendations.

**Test Results:**
```
✅ Embedding generation: 1536 dimensions verified
✅ Movie: "The Lion King" → successful embedding
✅ PostgreSQL vector format: 19,244 character string
✅ Semantic similarity validation:
   • Finding Nemo ↔ Lion King: 0.5448 (family animations)
   • Finding Nemo ↔ The Matrix: 0.3056 (different genres)
   • Lion King ↔ The Matrix:  0.3641 (different genres)
✅ Family animations correctly scored as more similar than unrelated genres
✅ Edge case handling: Empty text/movie correctly rejected
```

---

## Environment Variables Status

### ✅ Configured (Local Development)
```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-key>
OPENAI_API_KEY=<configured>
TMDB_API_KEY=<configured>
APP_REGION=US
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIM=1536
```

---

## Project Structure

```
family-moviesV2/
├── lib/
│   ├── supabase/
│   │   ├── client.ts       # Browser Supabase client
│   │   ├── server.ts       # Server Supabase client + service role
│   │   ├── types.ts        # Auto-generated DB types
│   │   └── queries.ts      # Common queries (getCurrentHousehold, etc.)
│   ├── tmdb/
│   │   ├── types.ts        # TMDB API type definitions
│   │   ├── client.ts       # TMDB API client with rate limiting
│   │   ├── normalize.ts    # Data normalization utilities
│   │   ├── index.ts        # Module exports
│   │   └── test.ts         # Integration test script
│   └── openai/
│       ├── types.ts        # OpenAI API type definitions
│       ├── embeddings.ts   # Embedding generation with retry logic
│       ├── index.ts        # Module exports
│       └── test.ts         # Embedding test suite
├── server/
│   └── tools/
│       ├── types.ts        # Tool schemas and error types
│       ├── tmdb-search.ts  # Search movies with filters
│       ├── add-to-queue.ts # Add movie to queue with embedding
│       ├── recommend.ts    # Get personalized recommendations
│       ├── mark-watched.ts # Record watch + rating + refresh taste
│       └── index.ts        # Tool exports and AI SDK definitions
├── app/
│   ├── api/
│   │   └── chat/
│   │       ├── route.ts    # Streaming chat endpoint with GPT-4o
│   │       └── README.md   # API documentation
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Homepage (redirects to /chat)
│   └── globals.css         # Tailwind styles
├── supabase/
│   ├── config.toml         # Supabase CLI config
│   ├── seed.sql            # Development seed data
│   └── migrations/
│       └── 20251017162752_init_schema.sql  # Full schema + RLS
├── .env.local              # Local env vars (fully configured)
├── .env.local.example      # Template for production
├── .gitignore              # Git ignore patterns
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── next.config.js          # Next.js config
├── tailwind.config.ts      # Tailwind config
├── PRD.md                  # Product requirements document
├── TODO.md                 # Task tracking
└── progress.md             # This file
```

---

---

### Phase 7: Server-Side Tools ✅
**Files Created:**

1. **`server/tools/types.ts`** - Shared types and Zod schemas
   - `tmdbSearchSchema`, `addToQueueSchema`, `recommendSchema`, `markWatchedSchema`
   - TypeScript interfaces for all tool inputs/outputs
   - Custom error classes: `ToolError`, `ValidationError`, `NotFoundError`, `DatabaseError`

2. **`server/tools/tmdb-search.ts`** - Movie search with household filters
   ```typescript
   tmdbSearch(input, householdId) → TMDBSearchResult[]
   // Searches TMDB, fetches details, applies filters (ratings, runtime)
   // Returns 3-8 candidates that meet household preferences
   ```

3. **`server/tools/add-to-queue.ts`** - Add movie to queue
   ```typescript
   addToQueue(input, householdId, profileId?) → AddToQueueResult
   // Checks if movie exists in DB
   // If not: fetches from TMDB, generates embedding, inserts
   // Adds to household's queue (list_items)
   // Prevents duplicates
   ```

4. **`server/tools/recommend.ts`** - Personalized recommendations
   ```typescript
   recommend(input, householdId) → RecommendResult[]
   // Calls recommend_for_household RPC
   // Uses vector similarity if taste exists, else popularity
   // Joins with movie_providers for streaming availability
   // Respects household filters
   ```

5. **`server/tools/mark-watched.ts`** - Record watch with rating
   ```typescript
   markWatched(input, householdId, profileId?) → MarkWatchedResult
   // Inserts watch record
   // Upserts rating if provided
   // Refreshes family_taste vector if rating >= 4 stars
   // Updates recommendation engine
   ```

6. **`server/tools/index.ts`** - Tool registry and exports
   - Exports all tools and types
   - Includes `toolDefinitions` for AI SDK integration
   - Tool descriptions and parameter schemas for GPT

**Features Implemented:**
- ✅ Zod validation for all tool inputs
- ✅ Household-scoped operations (multi-tenancy)
- ✅ Automatic household filter application (allowed ratings, max runtime)
- ✅ Embedding generation when adding movies
- ✅ Smart duplicate detection (queue, watches)
- ✅ Taste vector refresh on high ratings (4-5 stars)
- ✅ Watch provider integration
- ✅ Comprehensive error handling with custom error types
- ✅ TypeScript type safety throughout

**Tool Flow Examples:**

**Search → Add → Watch Flow:**
1. User: "Search for The Lion King"
2. AI calls `tmdbSearch({ query: "The Lion King" })`
3. Returns filtered results
4. User: "Add it to my queue"
5. AI calls `addToQueue({ tmdb_id: 8587 })`
6. Fetches from TMDB, generates embedding, saves to DB, adds to queue
7. User: "We watched it, 5 stars!"
8. AI calls `markWatched({ tmdb_id: 8587, rating: 5 })`
9. Records watch, saves rating, refreshes taste vector for better recommendations

**Recommend Flow:**
1. User: "Recommend some movies"
2. AI calls `recommend({ limit: 10 })`
3. Database RPC uses vector similarity on family_taste
4. Returns personalized recommendations with streaming providers

---

### Phase 8: AI Chat Route ✅
**Files Created:**

1. **`app/api/chat/route.ts`** - Streaming chat endpoint with tool calling
   ```typescript
   POST /api/chat
   // Authenticates user, extracts household context
   // Streams GPT-4o responses with tool calls
   // Supports up to 5 tool calls per turn
   ```

2. **`app/api/chat/README.md`** - API documentation
   - Request/response formats
   - Available tools and parameters
   - Testing instructions
   - Error handling guide

**Features Implemented:**
- ✅ Streaming responses using Vercel AI SDK's `streamText`
- ✅ GPT-4o model integration (fast, high quality)
- ✅ Family-friendly movie concierge system prompt
- ✅ Authentication with Supabase (user + household extraction)
- ✅ All 4 tools registered with AI:
  - `tmdb_search` - Search movies with filters
  - `add_to_queue` - Add to queue with embedding
  - `recommend` - Personalized recommendations
  - `mark_watched` - Record watch + rating
- ✅ Tool error handling (errors converted to user-friendly messages)
- ✅ Household context automatically injected into all tools
- ✅ Profile context for user-specific operations
- ✅ Max 5 tool calls per turn (prevents infinite loops)

**System Prompt Highlights:**
The AI is configured to:
- Be a helpful family-friendly movie concierge
- Respect household content preferences
- Use tools for all data (never fabricate)
- Provide concise, friendly responses
- Mention streaming availability
- Remind users that high ratings improve recommendations

**Example Conversation Flow:**
```
User: "Find a good family movie about space"
AI: *calls tmdb_search({ query: "family space movie" })*
AI: "I found several great options! 'WALL-E' (2008, G) is a heartwarming..."

User: "Add WALL-E to our queue"
AI: *calls add_to_queue({ tmdb_id: 10681 })*
AI: *fetches from TMDB, generates embedding, saves to DB*
AI: "Added 'WALL-E' (2008) to your queue!"

User: "We watched it last night, 5 stars!"
AI: *calls mark_watched({ tmdb_id: 10681, rating: 5 })*
AI: *records watch, saves rating, refreshes taste vector*
AI: "Awesome! I've recorded that you watched 'WALL-E' with 5 stars..."
```

**Notes:**
- Requires authentication (Phase 9) to test properly
- Will be connected to UI chat interface in Phase 10
- All tools respect RLS policies at database level
- Streaming reduces perceived latency for users

---

### Phase 9: Authentication ✅
**Files Created:**

1. **`app/login/page.tsx`** - Magic link login page
   - Email input form with validation
   - Calls `supabase.auth.signInWithOtp()`
   - Success/error message display
   - Clean, centered UI with Tailwind
   - No password required

2. **`app/auth/callback/route.ts`** - OAuth callback handler
   - Exchanges auth code for session
   - Sets HTTP-only session cookies
   - Checks if user has household
   - Redirects to `/chat` on success
   - Error handling with redirect to login

3. **`app/auth/logout/route.ts`** - Logout handler
   - Calls `supabase.auth.signOut()`
   - Clears session cookies
   - Redirects to `/login`
   - Supports GET and POST methods

4. **`middleware.ts`** - Route protection
   - Runs on all requests
   - Checks authentication status
   - Protects all routes except `/login` and `/auth/*`
   - Preserves intended destination with `?next=` parameter
   - Redirects unauthenticated users to login

5. **`app/auth/README.md`** - Authentication documentation
   - Complete flow diagrams
   - Testing guide with Mailpit
   - User/household setup instructions
   - Troubleshooting guide
   - Security notes

**Features Implemented:**
- ✅ Passwordless magic link authentication
- ✅ Automatic route protection via middleware
- ✅ Session persistence with HTTP-only cookies
- ✅ Household membership verification
- ✅ Redirect preservation (`?next=` parameter)
- ✅ Logout functionality
- ✅ Error handling and user feedback
- ✅ Local development with Mailpit integration

**Authentication Flow:**
```
1. User visits protected route (e.g., /chat)
   → Middleware checks auth
   → Not logged in → Redirect to /login?next=/chat

2. User enters email on /login
   → App calls signInWithOtp()
   → Supabase sends magic link email

3. User clicks magic link in email
   → Browser navigates to /auth/callback?code=...
   → Callback exchanges code for session
   → Session stored in HTTP-only cookies

4. User redirected to /chat
   → Middleware checks auth
   → Authenticated → Allow request

5. User clicks logout
   → Navigate to /auth/logout
   → Session cleared
   → Redirect to /login
```

**Testing with Mailpit:**
- Local Supabase sends emails to Mailpit (no real email needed)
- Access: http://127.0.0.1:54324
- Check emails in inbox
- Click magic links to test flow

**Notes:**
- Requires manual household setup in database (see auth/README.md)
- In production, would add onboarding flow for new users
- RLS policies ensure household isolation

---

## Pending Phases (10-18)

---

### Phase 10: UI Pages (Next)
**Goal:** Main application routes

**Files to Create:**
- `app/chat/page.tsx` - Chat interface (default route)
- `app/queue/page.tsx` - Queue management
- `app/history/page.tsx` - Watch history
- `app/settings/page.tsx` - Family preferences editor

---

### Phase 11: Shared Components
**Goal:** Reusable UI building blocks

**Files to Create:**
- `components/MovieCard.tsx` - Movie display card
  - Props: movie, actions (Add/Watch/Rate/Remove)
  - Shows: poster, title (year), MPAA, runtime, genres, providers
- `components/ProviderChips.tsx` - Streaming service badges
- `components/RatingStars.tsx` - 1-5 star rating input/display
- `components/ChatMessage.tsx` - AI chat bubble with tool results

---

### Phase 12: Edge Function (Optional)
**Goal:** Nightly provider refresh

**Files to Create:**
- `supabase/functions/refresh-providers/index.ts`
  - Fetch movies from queue + recent recommendations
  - Call TMDB watch providers API
  - Upsert `movie_providers` table

**Trigger:**
- Supabase Cron (daily at 2am)
- Or manual invoke via API

---

### Phase 13: RLS Tests
**Goal:** Security audit

**Files to Create:**
- `tests/rls.sql` - SQL test suite
  - Attempt cross-household SELECT → expect 0 rows
  - Attempt cross-household INSERT → expect permission denied
  - Verify is_member() function works correctly

---

### Phase 14: Seed Data (Already Done ✅)
- Completed in Phase 3

---

### Phase 15: Unit Tests
**Goal:** Test tools and schemas

**Files to Create:**
- `tests/tools/tmdb-search.test.ts` - Mock TMDB API
- `tests/tools/add-to-queue.test.ts` - Mock DB calls
- `tests/schemas.test.ts` - Zod schema validation

**Framework:** Vitest or Jest

---

### Phase 16: E2E Tests
**Goal:** End-to-end user flows

**Files to Create:**
- `tests/e2e/auth.spec.ts` - Login flow
- `tests/e2e/chat.spec.ts` - Search → Add → Recommend → Mark Watched
- `tests/e2e/queue.spec.ts` - Queue management

**Framework:** Playwright

---

### Phase 17: Performance
**Goal:** Optimize for P95 < 2.5s

**Tasks:**
- ✅ Vector IVFFlat index (already created)
- Implement LRU cache for TMDB API calls (100 entries)
- Cap recommendation limit to 24 movies
- Add `loading.tsx` for route segments

---

### Phase 18: Documentation
**Goal:** Comprehensive README

**Files to Create:**
- `README.md` - Quickstart, architecture, deployment guide
  - Environment setup
  - Local development (`pnpm dev`, `supabase start`)
  - Database migrations (`supabase db reset`)
  - Production deployment (Vercel + hosted Supabase)
  - Runbook (common tasks, troubleshooting)

---

## Development Commands

```bash
# Start local Supabase
supabase start

# Stop Supabase
supabase stop

# Reset database (apply migrations + seed)
supabase db reset

# Generate TypeScript types
supabase gen types typescript --local > lib/supabase/types.ts

# Install dependencies
pnpm install

# Run development server
pnpm dev

# Type check
pnpm type-check

# Build for production
pnpm build
```

---

## Key Design Decisions

### 1. Multi-Tenancy via RLS
- Household-scoped data completely isolated
- `is_member()` function enforces boundaries
- No risk of data leaks between families

### 2. On-Demand Metadata
- Movies fetched from TMDB only when needed
- No massive pre-crawl or catalog sync
- Keeps DB small and costs low

### 3. Vector-Powered Recommendations
- Family taste computed from high ratings (≥4 stars)
- Mean of embeddings = collaborative filtering
- Falls back to popularity if no ratings yet

### 4. Type-Safe Everything
- Auto-generated DB types from schema
- Zod validation on all AI tools
- TypeScript enforced across stack

### 5. Security-First
- Service role key NEVER exposed to client
- RLS policies on every household table
- SQL injection impossible (no raw SQL in tools)

### 6. Minimal Ops
- Single DB (Supabase)
- Single app (Next.js)
- Optional background job (Edge Function)
- No Redis, no queue, no microservices

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| TMDB API outages | Cache essential fields in `movies` table; degrade gracefully |
| RLS misconfiguration | SQL test suite verifies cross-household access denied |
| Model hallucinations | Tools are typed; server validates all inputs; filters enforced in SQL |
| Rate limits (TMDB) | LRU cache; exponential backoff; queue API calls |
| Cost overruns (OpenAI) | Cap recommendation limit; cache embeddings; use smaller models |

---

## Production Deployment Checklist

- [ ] Create Supabase hosted project
- [ ] Run migrations: `supabase db push`
- [ ] Set up Supabase Auth email templates
- [ ] Deploy to Vercel
- [ ] Set environment variables (Vercel dashboard):
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `OPENAI_API_KEY`
  - [ ] `TMDB_API_KEY`
  - [ ] `APP_REGION`
  - [ ] `EMBEDDING_MODEL`
  - [ ] `EMBEDDING_DIM`
- [ ] Test RLS policies in production
- [ ] Configure Edge Function cron (optional)
- [ ] Set up weekly database backups
- [ ] Monitor API usage (OpenAI, TMDB)

---

## Success Metrics (MVP Goals)

- [ ] TTFW (time to first watch) ≤ 60 seconds
- [ ] ≥70% of sessions include add-to-queue or mark-watched action
- [ ] 0 PII leaks between households (RLS audit passes)
- [ ] P95 chat round-trip < 2.5s
- [ ] E2E test suite green in CI
- [ ] Basic accessibility pass (keyboard, alt text, contrast)

---

## Notes for Next Session

1. **Immediate Next Step:** Implement Phase 8 (AI Chat Route)
   - Create `/app/api/chat/route.ts` with Vercel AI SDK
   - Integrate the 4 tools (tmdb_search, add_to_queue, recommend, mark_watched)
   - Add system prompt for family-friendly movie concierge
   - Enable streaming responses

2. **API Keys Status:**
   - ✅ OpenAI: Configured and tested (embeddings + chat ready)
   - ✅ TMDB: Configured and tested (API calls working)

3. **Current Blockers:** None - All backend tools complete and ready for AI integration

4. **Database State:**
   - Local Supabase running with seed data
   - Demo household ready for testing
   - All migrations applied

5. **Testing Access:**
   - Supabase Studio: http://127.0.0.1:54323
   - Can create test users via Studio Auth tab
   - Default test user ID: `3e5b0c12-e3cd-4be3-a25a-2e8f4e162c9a`

---

## Questions for User

1. ✅ ~~Do you have TMDB and OpenAI API keys ready?~~ **Resolved - Both configured**
2. Should we proceed with local development or set up production Supabase first?
3. Any specific MPAA ratings or content preferences to test with?
4. Preferred AI model: GPT-4, GPT-4-turbo, or GPT-4o?

---

**End of Progress Report**
