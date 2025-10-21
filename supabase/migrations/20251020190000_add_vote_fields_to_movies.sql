-- Add vote_average and vote_count to movies for rating-based logic
ALTER TABLE public.movies
  ADD COLUMN IF NOT EXISTS vote_average numeric,
  ADD COLUMN IF NOT EXISTS vote_count integer;

-- Optional indexes to speed up rating-based queries
CREATE INDEX IF NOT EXISTS movies_vote_average_idx ON public.movies (vote_average DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS movies_vote_count_idx ON public.movies (vote_count DESC NULLS LAST);

