-- Enhance watch tracking with notes, 10-star ratings, and better watch history
-- Migration: 20251017210000_enhance_watch_tracking.sql

-- 1. Update ratings to support 10 stars instead of 5
ALTER TABLE public.ratings DROP CONSTRAINT ratings_rating_check;
ALTER TABLE public.ratings ADD CONSTRAINT ratings_rating_check CHECK (rating between 1 and 10);

-- 2. Add notes field to watches table for personal comments
ALTER TABLE public.watches ADD COLUMN notes text;

-- 3. Add index for finding all watches of a specific movie by household
CREATE INDEX IF NOT EXISTS watches_household_tmdb_idx ON public.watches (household_id, tmdb_id);

-- Note: Multiple watch dates are already supported by the existing schema
-- Each watch is a separate row with its own watched_at timestamp
-- The 'rewatch' boolean helps identify if it's a first watch or a rewatch
