-- Add re-watch exclusion period to family preferences
-- This allows households to exclude recently watched movies from recommendations

-- Add rewatch_exclusion_days column to family_prefs
ALTER TABLE public.family_prefs
ADD COLUMN rewatch_exclusion_days integer DEFAULT 365;

COMMENT ON COLUMN public.family_prefs.rewatch_exclusion_days IS
'Number of days to exclude recently watched movies from recommendations.
For example, 365 means don''t recommend movies watched in the last year.
Set to 0 to allow all rewatches. NULL means use default (365 days).';

-- Update the recommend_for_household function to respect the rewatch exclusion period
CREATE OR REPLACE FUNCTION public.recommend_for_household(
  p_household_id uuid,
  p_limit int default 10
)
RETURNS TABLE (
  tmdb_id integer,
  title text,
  year int,
  poster_path text,
  mpaa text,
  runtime int,
  genres text[],
  distance float
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_taste vector(1536);
  v_prefs record;
  v_exclusion_cutoff timestamptz;
BEGIN
  -- Get household taste
  SELECT taste INTO v_taste FROM public.family_taste WHERE household_id = p_household_id;

  -- Get household preferences including rewatch exclusion period
  SELECT * INTO v_prefs FROM public.family_prefs WHERE household_id = p_household_id;

  -- Calculate the cutoff date for excluding recently watched movies
  -- Default to 365 days if not set
  v_exclusion_cutoff := now() - INTERVAL '1 day' * COALESCE(v_prefs.rewatch_exclusion_days, 365);

  IF v_taste IS NULL THEN
    -- No taste vector: return popular movies filtered by prefs
    RETURN QUERY
    SELECT
      m.tmdb_id,
      m.title,
      m.year,
      m.poster_path,
      m.mpaa,
      m.runtime,
      m.genres,
      0::float as distance
    FROM public.movies m
    WHERE (v_prefs.allowed_ratings IS NULL OR m.mpaa = ANY(v_prefs.allowed_ratings))
      AND (v_prefs.max_runtime IS NULL OR m.runtime <= v_prefs.max_runtime)
      AND NOT EXISTS (
        SELECT 1 FROM public.list_items li
        WHERE li.household_id = p_household_id
          AND li.tmdb_id = m.tmdb_id
          AND li.list_type = 'blocked'
      )
      -- Exclude movies watched within the exclusion period (unless rewatch_exclusion_days is 0)
      AND NOT EXISTS (
        SELECT 1 FROM public.watches w
        WHERE w.household_id = p_household_id
          AND w.tmdb_id = m.tmdb_id
          AND (v_prefs.rewatch_exclusion_days = 0 OR w.watched_at >= v_exclusion_cutoff)
      )
    ORDER BY m.popularity DESC NULLS LAST
    LIMIT p_limit;
  ELSE
    -- Use vector similarity
    RETURN QUERY
    SELECT
      m.tmdb_id,
      m.title,
      m.year,
      m.poster_path,
      m.mpaa,
      m.runtime,
      m.genres,
      (m.embedding <=> v_taste)::float as distance
    FROM public.movies m
    WHERE m.embedding IS NOT NULL
      AND (v_prefs.allowed_ratings IS NULL OR m.mpaa = ANY(v_prefs.allowed_ratings))
      AND (v_prefs.max_runtime IS NULL OR m.runtime <= v_prefs.max_runtime)
      AND NOT EXISTS (
        SELECT 1 FROM public.list_items li
        WHERE li.household_id = p_household_id
          AND li.tmdb_id = m.tmdb_id
          AND li.list_type = 'blocked'
      )
      -- Exclude movies watched within the exclusion period (unless rewatch_exclusion_days is 0)
      AND NOT EXISTS (
        SELECT 1 FROM public.watches w
        WHERE w.household_id = p_household_id
          AND w.tmdb_id = m.tmdb_id
          AND (v_prefs.rewatch_exclusion_days = 0 OR w.watched_at >= v_exclusion_cutoff)
      )
    ORDER BY m.embedding <=> v_taste
    LIMIT p_limit;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.recommend_for_household IS
'Get movie recommendations for a household, excluding movies watched within the rewatch_exclusion_days period.
Uses vector similarity if taste vector exists, otherwise returns popular movies.
All results are filtered by household preferences (ratings, runtime, blocked keywords, rewatch exclusion).';
