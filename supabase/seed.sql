-- Seed data for local development
-- This creates a demo household with sample data for testing

-- Note: In local Supabase, the default test user has ID:
-- '3e5b0c12-e3cd-4be3-a25a-2e8f4e162c9a'
-- You can create test users via Supabase Studio at http://127.0.0.1:54323

-- Create a demo household
insert into public.households (id, name, region)
values ('11111111-1111-1111-1111-111111111111', 'Demo Family', 'US')
on conflict (id) do nothing;

-- Link the default local user to the household (update user_id as needed)
insert into public.household_members (household_id, user_id, role)
values (
  '11111111-1111-1111-1111-111111111111',
  '3e5b0c12-e3cd-4be3-a25a-2e8f4e162c9a',
  'owner'
)
on conflict (household_id, user_id) do nothing;

-- Create a profile for the user
insert into public.profiles (user_id, household_id, display_name)
values (
  '3e5b0c12-e3cd-4be3-a25a-2e8f4e162c9a',
  '11111111-1111-1111-1111-111111111111',
  'Demo User'
)
on conflict (user_id, household_id) do nothing;

-- Set family preferences
insert into public.family_prefs (household_id, allowed_ratings, max_runtime, blocked_keywords)
values (
  '11111111-1111-1111-1111-111111111111',
  array['G','PG','PG-13'],
  140,
  array[]::text[]
)
on conflict (household_id) do nothing;

-- Sample movies (minimal data for testing - will be enriched from TMDB API)
insert into public.movies (tmdb_id, title, year, mpaa, runtime, genres, popularity)
values
  (862, 'Toy Story', 1995, 'G', 81, array['Animation','Comedy','Family'], 150.5),
  (597, 'Titanic', 1997, 'PG-13', 194, array['Drama','Romance'], 180.3),
  (13, 'Forrest Gump', 1994, 'PG-13', 142, array['Comedy','Drama','Romance'], 170.2)
on conflict (tmdb_id) do nothing;

-- Note: Embeddings will be generated when movies are fetched from TMDB API
-- This is just sample data for initial testing
