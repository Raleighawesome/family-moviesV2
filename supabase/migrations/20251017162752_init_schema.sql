-- Family Movies v2 - Initial Schema Migration
-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists vector;

-- ============================================================================
-- GLOBAL TABLES (shared across all households, no RLS)
-- ============================================================================

-- Movies catalog (shared metadata from TMDB)
create table public.movies (
  tmdb_id        integer primary key,
  title          text not null,
  year           int,
  poster_path    text,
  overview       text,
  runtime        int,
  mpaa           text,
  genres         text[] not null default '{}',
  keywords       text[] not null default '{}',
  popularity     numeric,
  embedding      vector(1536),          -- OpenAI text-embedding-3-small dimension
  last_fetched_at timestamptz not null default now()
);

-- Indexes for movie search and filtering
create index if not exists movies_genres_gin on public.movies using gin (genres);
create index if not exists movies_keywords_gin on public.movies using gin (keywords);
create index if not exists movies_title_idx on public.movies (title);
create index if not exists movies_year_idx on public.movies (year);
create index if not exists movies_popularity_idx on public.movies (popularity desc);

-- Vector index for similarity search (IVFFlat for performance)
create index if not exists movies_embed_ivf on public.movies
  using ivfflat (embedding vector_cosine_ops)
  with (lists=100);

-- Movie provider cache (where to watch)
create table public.movie_providers (
  tmdb_id   integer references public.movies on delete cascade,
  region    text not null,
  providers jsonb not null,             -- {flatrate:[...], buy:[...], rent:[...]}
  updated_at timestamptz not null default now(),
  primary key (tmdb_id, region)
);

create index if not exists movie_providers_region_idx on public.movie_providers (region);

-- ============================================================================
-- HOUSEHOLD TABLES (multi-tenant, RLS enforced)
-- ============================================================================

-- Households (tenancy root)
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text not null default 'US',
  created_at timestamptz not null default now()
);

-- Household members (links auth.users to households)
create table public.household_members (
  household_id uuid references public.households on delete cascade,
  user_id uuid not null,                -- references auth.users(id)
  role text not null default 'member',  -- 'owner' | 'member'
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists household_members_user_idx on public.household_members (user_id);

-- User profiles within household
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,                -- references auth.users(id)
  household_id uuid references public.households on delete cascade,
  display_name text not null,
  birth_year int,
  created_at timestamptz not null default now(),
  unique (user_id, household_id)
);

create index if not exists profiles_user_idx on public.profiles (user_id);
create index if not exists profiles_household_idx on public.profiles (household_id);

-- Family preferences and filters
create table public.family_prefs (
  household_id uuid primary key references public.households on delete cascade,
  allowed_ratings text[] not null default array['G','PG','PG-13'],
  max_runtime int not null default 140,
  blocked_keywords text[] not null default '{}'::text[]
);

-- List items (queue, blocked, favorites)
create table public.list_items (
  id bigserial primary key,
  household_id uuid not null references public.households on delete cascade,
  tmdb_id integer not null references public.movies(tmdb_id) on delete cascade,
  list_type text not null check (list_type in ('queue','blocked','favorite')),
  added_by uuid,                         -- profiles.id (optional)
  created_at timestamptz not null default now(),
  unique (household_id, tmdb_id, list_type)
);

create index if not exists list_items_household_idx on public.list_items (household_id, list_type);
create index if not exists list_items_tmdb_idx on public.list_items (tmdb_id);

-- Watch history
create table public.watches (
  id bigserial primary key,
  household_id uuid not null references public.households on delete cascade,
  profile_id uuid references public.profiles on delete set null,
  tmdb_id integer not null references public.movies(tmdb_id) on delete cascade,
  watched_at timestamptz not null default now(),
  rewatch boolean not null default false
);

create index if not exists watches_household_idx on public.watches (household_id);
create index if not exists watches_profile_idx on public.watches (profile_id);
create index if not exists watches_tmdb_idx on public.watches (tmdb_id);
create index if not exists watches_watched_at_idx on public.watches (watched_at desc);

-- Ratings
create table public.ratings (
  household_id uuid not null references public.households on delete cascade,
  profile_id uuid references public.profiles on delete set null,
  tmdb_id integer not null references public.movies(tmdb_id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  rated_at timestamptz not null default now(),
  primary key (household_id, profile_id, tmdb_id)
);

create index if not exists ratings_household_idx on public.ratings (household_id);
create index if not exists ratings_tmdb_idx on public.ratings (tmdb_id);

-- Family taste vector (collaborative filtering)
create table public.family_taste (
  household_id uuid primary key references public.households on delete cascade,
  taste vector(1536),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- RLS HELPER FUNCTIONS
-- ============================================================================

-- Check if current user is member of household
create or replace function public.is_member(h uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.household_members
    where household_id = h and user_id = auth.uid()
  );
$$;

-- Get current user's household IDs
create or replace function public.user_households()
returns setof uuid language sql stable security definer as $$
  select household_id from public.household_members
  where user_id = auth.uid();
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all household tables
alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.profiles          enable row level security;
alter table public.family_prefs      enable row level security;
alter table public.list_items        enable row level security;
alter table public.watches           enable row level security;
alter table public.ratings           enable row level security;
alter table public.family_taste      enable row level security;

-- Households policies
create policy select_household on public.households
  for select using (is_member(id));

create policy insert_household on public.households
  for insert with check (true);  -- Users can create households

create policy update_household on public.households
  for update using (is_member(id));

create policy delete_household on public.households
  for delete using (is_member(id));

-- Household members policies
create policy select_household_members on public.household_members
  for select using (is_member(household_id));

create policy insert_household_members on public.household_members
  for insert with check (is_member(household_id));

create policy update_household_members on public.household_members
  for update using (is_member(household_id));

create policy delete_household_members on public.household_members
  for delete using (is_member(household_id));

-- Profiles policies
create policy select_profiles on public.profiles
  for select using (is_member(household_id));

create policy insert_profiles on public.profiles
  for insert with check (is_member(household_id));

create policy update_profiles on public.profiles
  for update using (is_member(household_id));

create policy delete_profiles on public.profiles
  for delete using (is_member(household_id));

-- Family prefs policies
create policy select_family_prefs on public.family_prefs
  for select using (is_member(household_id));

create policy insert_family_prefs on public.family_prefs
  for insert with check (is_member(household_id));

create policy update_family_prefs on public.family_prefs
  for update using (is_member(household_id));

create policy delete_family_prefs on public.family_prefs
  for delete using (is_member(household_id));

-- List items policies
create policy select_list_items on public.list_items
  for select using (is_member(household_id));

create policy insert_list_items on public.list_items
  for insert with check (is_member(household_id));

create policy update_list_items on public.list_items
  for update using (is_member(household_id));

create policy delete_list_items on public.list_items
  for delete using (is_member(household_id));

-- Watches policies
create policy select_watches on public.watches
  for select using (is_member(household_id));

create policy insert_watches on public.watches
  for insert with check (is_member(household_id));

create policy update_watches on public.watches
  for update using (is_member(household_id));

create policy delete_watches on public.watches
  for delete using (is_member(household_id));

-- Ratings policies
create policy select_ratings on public.ratings
  for select using (is_member(household_id));

create policy insert_ratings on public.ratings
  for insert with check (is_member(household_id));

create policy update_ratings on public.ratings
  for update using (is_member(household_id));

create policy delete_ratings on public.ratings
  for delete using (is_member(household_id));

-- Family taste policies
create policy select_family_taste on public.family_taste
  for select using (is_member(household_id));

create policy insert_family_taste on public.family_taste
  for insert with check (is_member(household_id));

create policy update_family_taste on public.family_taste
  for update using (is_member(household_id));

create policy delete_family_taste on public.family_taste
  for delete using (is_member(household_id));

-- Global tables (movies, movie_providers) remain public readable
-- No RLS needed - they're shared metadata

-- ============================================================================
-- STORED PROCEDURES / RPCs
-- ============================================================================

-- Refresh family taste vector based on high ratings
create or replace function public.refresh_family_taste(p_household_id uuid)
returns void language plpgsql security definer as $$
begin
  -- Compute mean vector of movies rated >= 4
  insert into public.family_taste (household_id, taste, updated_at)
  select
    p_household_id,
    avg(m.embedding)::vector(1536) as taste,
    now()
  from public.ratings r
  join public.movies m on m.tmdb_id = r.tmdb_id
  where r.household_id = p_household_id
    and r.rating >= 4
    and m.embedding is not null
  group by r.household_id
  on conflict (household_id) do update set
    taste = excluded.taste,
    updated_at = excluded.updated_at;
end;
$$;

-- Get recommendations for household
create or replace function public.recommend_for_household(
  p_household_id uuid,
  p_limit int default 10
)
returns table (
  tmdb_id integer,
  title text,
  year int,
  poster_path text,
  mpaa text,
  runtime int,
  genres text[],
  distance float
) language plpgsql stable security definer as $$
declare
  v_taste vector(1536);
  v_prefs record;
begin
  -- Get household taste
  select taste into v_taste from public.family_taste where household_id = p_household_id;

  -- Get household preferences
  select * into v_prefs from public.family_prefs where household_id = p_household_id;

  if v_taste is null then
    -- No taste vector: return popular movies filtered by prefs
    return query
    select
      m.tmdb_id,
      m.title,
      m.year,
      m.poster_path,
      m.mpaa,
      m.runtime,
      m.genres,
      0::float as distance
    from public.movies m
    where (v_prefs.allowed_ratings is null or m.mpaa = any(v_prefs.allowed_ratings))
      and (v_prefs.max_runtime is null or m.runtime <= v_prefs.max_runtime)
      and not exists (
        select 1 from public.list_items li
        where li.household_id = p_household_id
          and li.tmdb_id = m.tmdb_id
          and li.list_type = 'blocked'
      )
      and not exists (
        select 1 from public.watches w
        where w.household_id = p_household_id
          and w.tmdb_id = m.tmdb_id
          and not w.rewatch
      )
    order by m.popularity desc nulls last
    limit p_limit;
  else
    -- Use vector similarity
    return query
    select
      m.tmdb_id,
      m.title,
      m.year,
      m.poster_path,
      m.mpaa,
      m.runtime,
      m.genres,
      (m.embedding <=> v_taste)::float as distance
    from public.movies m
    where m.embedding is not null
      and (v_prefs.allowed_ratings is null or m.mpaa = any(v_prefs.allowed_ratings))
      and (v_prefs.max_runtime is null or m.runtime <= v_prefs.max_runtime)
      and not exists (
        select 1 from public.list_items li
        where li.household_id = p_household_id
          and li.tmdb_id = m.tmdb_id
          and li.list_type = 'blocked'
      )
      and not exists (
        select 1 from public.watches w
        where w.household_id = p_household_id
          and w.tmdb_id = m.tmdb_id
          and not w.rewatch
      )
    order by m.embedding <=> v_taste
    limit p_limit;
  end if;
end;
$$;
