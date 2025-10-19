-- Fix ratings table to allow NULL profile_id
-- This allows household-level ratings when no specific profile is set

-- Drop the existing primary key constraint
ALTER TABLE public.ratings DROP CONSTRAINT ratings_pkey;

-- Make profile_id explicitly nullable (it already is, but let's be clear)
ALTER TABLE public.ratings ALTER COLUMN profile_id DROP NOT NULL;

-- Add a new primary key that handles NULLs
-- We'll use COALESCE to treat NULL as a special UUID
CREATE UNIQUE INDEX ratings_unique_idx ON public.ratings (
  household_id,
  tmdb_id,
  COALESCE(profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Comment explaining the index
COMMENT ON INDEX ratings_unique_idx IS 'Unique constraint for ratings that treats NULL profile_id as a special value to allow household-level ratings';
