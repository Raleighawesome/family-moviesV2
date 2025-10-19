import { createClient } from '@/lib/supabase/server';
import { getCompleteMovieData, searchMovies } from '@/lib/tmdb';
import { normalizeTMDBMovie } from '@/lib/tmdb/normalize';
import { generateMovieEmbedding, embeddingToVector } from '@/lib/openai/embeddings';
import {
  recommendSchema,
  type RecommendInput,
  type RecommendResult,
  ValidationError,
  DatabaseError,
  ToolError,
} from './types';

/**
 * Fetch and store popular family movies from TMDB to expand the database
 */
async function fetchAndStorePopularMovies(
  supabase: any,
  allowedRatings: string[],
  maxRuntime: number,
  targetCount: number
): Promise<number> {
  console.log(`[recommend] Fetching popular movies from TMDB to expand database...`);

  let addedCount = 0;
  const queries = [
    'disney',
    'pixar',
    'dreamworks',
    'animation',
    'family',
    'kids',
    'adventure',
  ];

  for (const query of queries) {
    if (addedCount >= targetCount) break;

    try {
      const searchResults = await searchMovies(query);

      for (const result of searchResults.results.slice(0, 10)) {
        if (addedCount >= targetCount) break;

        try {
          // Check if movie already exists
          const { data: existing } = await supabase
            .from('movies')
            .select('tmdb_id')
            .eq('tmdb_id', result.id)
            .maybeSingle();

          if (existing) continue;

          // Fetch complete movie data
          const movieData = await getCompleteMovieData(result.id);
          const normalizedMovie = normalizeTMDBMovie(
            movieData.details,
            movieData.mpaaRating,
            movieData.keywords.keywords?.map((k: any) => k.name) || []
          );

          // Check if it meets the household's preferences
          const meetsRating = normalizedMovie.mpaa && allowedRatings.includes(normalizedMovie.mpaa);
          const meetsRuntime = !normalizedMovie.runtime || normalizedMovie.runtime <= maxRuntime;

          if (!meetsRating || !meetsRuntime) {
            console.log(`  ⏭️  Skipping ${normalizedMovie.title} - doesn't meet preferences`);
            continue;
          }

          // Generate embedding
          const embedding = await generateMovieEmbedding({
            title: normalizedMovie.title,
            overview: normalizedMovie.overview || '',
            genres: normalizedMovie.genres,
            keywords: normalizedMovie.keywords,
          });

          // Insert into database
          const { error: insertError } = await supabase
            .from('movies')
            .insert({
              ...normalizedMovie,
              embedding: embeddingToVector(embedding),
            });

          if (!insertError) {
            console.log(`  ✅ Added ${normalizedMovie.title} (${normalizedMovie.mpaa})`);
            addedCount++;
          }
        } catch (err) {
          console.warn(`  ⚠️  Failed to process movie ${result.id}:`, err);
          continue;
        }
      }
    } catch (err) {
      console.warn(`  ⚠️  Failed to search for "${query}":`, err);
      continue;
    }
  }

  console.log(`[recommend] Added ${addedCount} new movies to database`);
  return addedCount;
}

/**
 * Get personalized movie recommendations for the household
 *
 * This tool:
 * 1. Validates the limit parameter
 * 2. Calls the recommend_for_household RPC function
 * 3. If not enough results, automatically fetches more movies from TMDB
 * 4. Joins with movie_providers to get streaming availability
 * 5. Returns recommendations sorted by similarity (if taste vector exists) or popularity
 */
export async function recommend(
  input: unknown,
  householdId: string
): Promise<RecommendResult[]> {
  // Validate input
  const validatedInput = recommendSchema.safeParse(input);
  if (!validatedInput.success) {
    throw new ValidationError(
      'Invalid recommend parameters',
      validatedInput.error.format()
    );
  }

  const { limit } = validatedInput.data;
  const supabase = await createClient();

  try {
    // Get household preferences for logging
    const { data: prefs } = await supabase
      .from('family_prefs')
      .select('allowed_ratings, max_runtime, blocked_keywords, preferred_streaming_services')
      .eq('household_id', householdId)
      .single();

    console.log('[recommend] Household preferences:', prefs);
    const preferredServices = prefs?.preferred_streaming_services || [];

    // Get household region for watch providers
    const { data: household, error: householdError } = await supabase
      .from('households')
      .select('region')
      .eq('id', householdId)
      .single();

    if (householdError) {
      throw new DatabaseError('Failed to fetch household info', householdError);
    }

    const region = household?.region || 'US';

    // Call the recommend_for_household RPC
    const { data: recommendations, error: recommendError } = await supabase
      .rpc('recommend_for_household', {
        p_household_id: householdId,
        p_limit: limit,
      });

    if (recommendError) {
      throw new DatabaseError('Failed to get recommendations', recommendError);
    }

    // If we don't have enough recommendations, fetch more movies from TMDB
    if (!recommendations || recommendations.length < limit) {
      const currentCount = recommendations?.length || 0;
      const needed = limit - currentCount;

      console.log(`[recommend] Only found ${currentCount} recommendations, need ${limit}. Fetching more from TMDB...`);

      // Get preferences for filtering
      const allowedRatings = prefs?.allowed_ratings || ['G', 'PG', 'PG-13'];
      const maxRuntime = prefs?.max_runtime || 140;

      // Fetch and store more movies (try to get 2x what we need to have a buffer)
      const addedCount = await fetchAndStorePopularMovies(
        supabase,
        allowedRatings,
        maxRuntime,
        needed * 2
      );

      if (addedCount > 0) {
        // Re-run the recommendation query
        console.log(`[recommend] Re-running recommendation query after adding ${addedCount} movies...`);
        const { data: newRecommendations, error: newError } = await supabase
          .rpc('recommend_for_household', {
            p_household_id: householdId,
            p_limit: limit,
          });

        if (!newError && newRecommendations && newRecommendations.length > 0) {
          recommendations.push(...newRecommendations.slice(currentCount));
        }
      }

      // If still no recommendations, return empty
      if (!recommendations || recommendations.length === 0) {
        console.log(`[recommend] No movies found even after fetching from TMDB`);
        return [];
      }
    }

    // Fetch watch providers for each recommendation
    const tmdbIds = recommendations.map((r: any) => r.tmdb_id);
    const { data: providers } = await supabase
      .from('movie_providers')
      .select('tmdb_id, providers')
      .eq('region', region)
      .in('tmdb_id', tmdbIds);

    // Create a map of tmdb_id -> providers
    const providersMap = new Map(
      providers?.map(p => [p.tmdb_id, p.providers]) || []
    );

    console.log(`[recommend] Got ${recommendations.length} recommendations from database`);
    recommendations.forEach((rec: any) => {
      console.log(`  - ${rec.title} (${rec.year}) - ${rec.mpaa}, ${rec.runtime}min`);
    });

    // Combine recommendations with providers
    const results: RecommendResult[] = recommendations.map((rec: any) => {
      const movieProviders = providersMap.get(rec.tmdb_id);

      return {
        tmdb_id: rec.tmdb_id,
        title: rec.title,
        year: rec.year,
        poster_path: rec.poster_path,
        mpaa: rec.mpaa,
        runtime: rec.runtime,
        genres: rec.genres || [],
        distance: rec.distance !== undefined ? rec.distance : undefined,
        providers: movieProviders
          ? {
              flatrate: movieProviders.flatrate?.map((p: any) => ({
                provider_name: p.provider_name,
                logo_path: p.logo_path,
              })),
              rent: movieProviders.rent?.map((p: any) => ({
                provider_name: p.provider_name,
                logo_path: p.logo_path,
              })),
              buy: movieProviders.buy?.map((p: any) => ({
                provider_name: p.provider_name,
                logo_path: p.logo_path,
              })),
            }
          : undefined,
      };
    });

    // If the household has preferred streaming services, prioritize movies available on those services
    if (preferredServices.length > 0) {
      console.log(`[recommend] Prioritizing ${preferredServices.length} preferred services:`, preferredServices);

      // Sort results: movies on preferred services first, then by distance/popularity
      results.sort((a, b) => {
        const aHasPreferred = a.providers?.flatrate?.some(p =>
          preferredServices.includes(p.provider_name)
        ) || false;
        const bHasPreferred = b.providers?.flatrate?.some(p =>
          preferredServices.includes(p.provider_name)
        ) || false;

        // If one has preferred service and other doesn't, prioritize the one that does
        if (aHasPreferred && !bHasPreferred) return -1;
        if (!aHasPreferred && bHasPreferred) return 1;

        // If both or neither have preferred service, maintain original order (by distance/popularity)
        return 0;
      });

      const onPreferredCount = results.filter(r =>
        r.providers?.flatrate?.some(p => preferredServices.includes(p.provider_name))
      ).length;

      console.log(`[recommend] ${onPreferredCount}/${results.length} recommendations available on preferred services`);
    }

    return results;
  } catch (error) {
    if (error instanceof ToolError) {
      throw error;
    }

    throw new ToolError(
      `Failed to get recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'RECOMMEND_ERROR',
      error
    );
  }
}
