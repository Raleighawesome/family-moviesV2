import { searchMovies, getCompleteMovieData, extractMPAARating } from '@/lib/tmdb';
import { createClient } from '@/lib/supabase/server';
import {
  tmdbSearchSchema,
  type TMDBSearchInput,
  type TMDBSearchResult,
  ValidationError,
  NotFoundError,
  ToolError,
} from './types';

/**
 * Search TMDB for movies and return candidates filtered by household preferences
 *
 * This tool:
 * 1. Searches TMDB API for movies matching the query
 * 2. Fetches full details for each result
 * 3. Applies household filters (allowed ratings, max runtime)
 * 4. Returns 3-8 candidates for the AI to present to the user
 */
export async function tmdbSearch(
  input: unknown,
  householdId: string
): Promise<TMDBSearchResult[]> {
  // Validate input
  const validatedInput = tmdbSearchSchema.safeParse(input);
  if (!validatedInput.success) {
    throw new ValidationError(
      'Invalid search parameters',
      validatedInput.error.format()
    );
  }

  const { query, year } = validatedInput.data;

  try {
    // Search TMDB
    const searchResults = await searchMovies(query, year);

    if (searchResults.results.length === 0) {
      throw new NotFoundError(`No movies found matching "${query}"${year ? ` (${year})` : ''}`);
    }

    // Get household preferences
    const supabase = await createClient();
    const { data: prefs, error: prefsError } = await supabase
      .from('family_prefs')
      .select('allowed_ratings, max_runtime, blocked_keywords')
      .eq('household_id', householdId)
      .single();

    if (prefsError && prefsError.code !== 'PGRST116') {
      // PGRST116 is "not found" - use defaults if no prefs exist
      throw new ToolError('Failed to fetch household preferences', 'DATABASE_ERROR', prefsError);
    }

    // Default preferences if none exist
    const allowedRatings = prefs?.allowed_ratings || ['G', 'PG', 'PG-13'];
    const maxRuntime = prefs?.max_runtime || 140;
    const blockedKeywords = prefs?.blocked_keywords || [];

    console.log('[tmdb-search] Household preferences:', {
      allowedRatings,
      maxRuntime,
      blockedKeywords,
    });

    // Fetch full details for top results and filter
    const candidates: TMDBSearchResult[] = [];
    const maxCandidates = 8;
    const maxAttempts = Math.min(searchResults.results.length, 15); // Check up to 15 results

    for (let i = 0; i < maxAttempts && candidates.length < maxCandidates; i++) {
      const result = searchResults.results[i];

      try {
        // Fetch complete data
        const movieData = await getCompleteMovieData(result.id);
        const mpaaRating = extractMPAARating(movieData.releaseDates);

        // Apply filters
        const meetsRatingFilter =
          !mpaaRating || allowedRatings.includes(mpaaRating);

        const meetsRuntimeFilter =
          !movieData.details.runtime || movieData.details.runtime <= maxRuntime;

        // Check keywords
        const hasBlockedKeywords = blockedKeywords.some((keyword: string) =>
          movieData.keywords.keywords?.some((k: any) => k.name.toLowerCase().includes(keyword.toLowerCase())) || false
        );

        if (meetsRatingFilter && meetsRuntimeFilter && !hasBlockedKeywords) {
          console.log(`✅ [tmdb-search] "${movieData.details.title}" passed filters (${mpaaRating}, ${movieData.details.runtime}min)`);
          candidates.push({
            tmdb_id: result.id,
            title: movieData.details.title,
            year: movieData.details.release_date
              ? parseInt(movieData.details.release_date.split('-')[0], 10)
              : null,
            poster_path: movieData.details.poster_path,
            overview: movieData.details.overview,
            mpaa: mpaaRating,
            runtime: movieData.details.runtime,
            genres: movieData.details.genres.map(g => g.name),
          });
        } else {
          const reasons = [];
          if (!meetsRatingFilter) reasons.push(`rating: ${mpaaRating}`);
          if (!meetsRuntimeFilter) reasons.push(`runtime: ${movieData.details.runtime}min`);
          if (hasBlockedKeywords) reasons.push('blocked keywords');
          console.log(`❌ [tmdb-search] "${movieData.details.title}" filtered out (${reasons.join(', ')})`);
        }
      } catch (error) {
        // Skip this result if we can't fetch details
        console.warn(`Failed to fetch details for TMDB ID ${result.id}:`, error);
        continue;
      }
    }

    if (candidates.length === 0) {
      throw new NotFoundError(
        `No movies found matching "${query}" that meet your household's content filters (ratings: ${allowedRatings.join(', ')}, max runtime: ${maxRuntime} min)`
      );
    }

    // Return at least 3 candidates, up to 8
    return candidates.slice(0, Math.max(3, Math.min(candidates.length, maxCandidates)));
  } catch (error) {
    if (error instanceof ToolError) {
      throw error;
    }

    throw new ToolError(
      `Failed to search movies: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'TMDB_ERROR',
      error
    );
  }
}
