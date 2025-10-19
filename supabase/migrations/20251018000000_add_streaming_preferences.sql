-- Add streaming service preferences to family_prefs
-- This allows households to specify which streaming services they have access to

-- Add preferred_streaming_services column to family_prefs
ALTER TABLE public.family_prefs
ADD COLUMN preferred_streaming_services text[] DEFAULT '{}';

COMMENT ON COLUMN public.family_prefs.preferred_streaming_services IS
'List of streaming service provider names that the household has access to (e.g., Netflix, Disney Plus, Hulu). Used to prioritize recommendations based on availability.';
