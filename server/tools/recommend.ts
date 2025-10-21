import { createClient } from '@/lib/supabase/server';
import { getCompleteMovieData, searchMovies } from '@/lib/tmdb';
import { normalizeTMDBMovie, normalizeTMDBProviders } from '@/lib/tmdb/normalize';
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
    const { year_min, year_max, genres: filterGenres, min_popularity, min_vote_average, streaming_only, limit } = validatedInput.data as any;
    const filtersPresent = Boolean(year_min || year_max || (filterGenres && filterGenres.length) || min_popularity || min_vote_average);
    const candidateLimit = filtersPresent ? Math.max(limit * 10, 60) : limit;
    // Get household preferences for logging
    const { data: prefs } = await supabase
      .from('family_prefs')
      .select('allowed_ratings, max_runtime, blocked_keywords, preferred_streaming_services, rewatch_exclusion_days')
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
        p_limit: candidateLimit,
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
            p_limit: candidateLimit,
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
    let recs: any[] = recommendations || [];

    // Apply optional filters (year range, genres) before provider fetch to reduce load
    if (year_min || year_max) {
      recs = recs.filter((r: any) => {
        if (r.year == null) return false;
        if (year_min && r.year < year_min) return false;
        if (year_max && r.year > year_max) return false;
        return true;
      });
    }
    if (filterGenres && filterGenres.length > 0) {
      const set = new Set(filterGenres.map((g) => g.toLowerCase()));
      recs = recs.filter((r: any) => (r.genres || []).some((g: string) => set.has(g.toLowerCase())));
    }

    // Determine the final set we plan to present
    const finalRecs = recs.slice(0, limit);
    const finalIds = finalRecs.map((r: any) => r.tmdb_id);

    // Fetch existing cached providers for fallback
    const { data: providers } = await supabase
      .from('movie_providers')
      .select('tmdb_id, providers')
      .eq('region', region)
      .in('tmdb_id', finalIds);

    const providersMap = new Map(providers?.map(p => [p.tmdb_id, p.providers]) || []);

    // Refresh TMDB details and providers for final recommendations
    const updatedProvidersMap = new Map<number, any>();
    for (const rec of finalRecs) {
      try {
        const movieData = await getCompleteMovieData(rec.tmdb_id);

        // Update movie details in DB (no embedding changes)
        const normalizedMovie = normalizeTMDBMovie(
          movieData.details,
          movieData.mpaaRating,
          movieData.keywords.keywords?.map((k: any) => k.name) || []
        );
        await supabase
          .from('movies')
          .update({
            title: normalizedMovie.title,
            year: normalizedMovie.year,
            poster_path: normalizedMovie.poster_path,
            overview: normalizedMovie.overview,
            runtime: normalizedMovie.runtime,
            mpaa: normalizedMovie.mpaa,
            genres: normalizedMovie.genres,
            keywords: normalizedMovie.keywords,
            popularity: normalizedMovie.popularity,
            vote_average: (normalizedMovie as any).vote_average ?? null,
            vote_count: (normalizedMovie as any).vote_count ?? null,
            last_fetched_at: new Date().toISOString(),
          })
          .eq('tmdb_id', rec.tmdb_id);

        // Update providers cache for the household region
        const normalizedProviders = normalizeTMDBProviders(rec.tmdb_id, region, movieData.watchProviders);
        if (normalizedProviders) {
          await supabase
            .from('movie_providers')
            .upsert(
              {
                tmdb_id: rec.tmdb_id,
                region,
                providers: normalizedProviders.providers as any,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'tmdb_id,region' }
            );
          updatedProvidersMap.set(rec.tmdb_id, normalizedProviders.providers);
        }
      } catch (e) {
        // Best-effort refresh; fall back to existing providers if refresh fails
        // console.warn('[recommend] refresh failed for', rec.tmdb_id, e);
      }
    }

    console.log(`[recommend] Got ${finalRecs.length} recommendations from database (post-filter)`);
    finalRecs.forEach((rec: any) => {
      console.log(`  - ${rec.title} (${rec.year}) - ${rec.mpaa}, ${rec.runtime}min`);
    });

    // Combine recommendations with providers
    const maxRuntimePref = prefs?.max_runtime ?? null;
    const allowedRatingsPref: string[] = prefs?.allowed_ratings ?? [];
    // Optionally fetch popularity and vote metrics for filtering
    let popularityMap = new Map<number, number>();
    let voteAvgMap = new Map<number, number>();
    if (min_popularity || min_vote_average) {
      const { data: statRows } = await supabase
        .from('movies')
        .select('tmdb_id, popularity, vote_average, vote_count')
        .in('tmdb_id', tmdbIds);
      for (const r of statRows || []) {
        popularityMap.set(r.tmdb_id, Number(r.popularity) || 0);
        voteAvgMap.set(r.tmdb_id, Number(r.vote_average) || 0);
      }
      if (min_popularity) {
        recs = recs.filter((r: any) => (popularityMap.get(r.tmdb_id) || 0) >= min_popularity);
      }
      if (min_vote_average) {
        recs = recs.filter((r: any) => (voteAvgMap.get(r.tmdb_id) || 0) >= min_vote_average);
      }
    }

    let results: RecommendResult[] = finalRecs.map((rec: any) => {
      const movieProviders = updatedProvidersMap.get(rec.tmdb_id) ?? providersMap.get(rec.tmdb_id);

      // Build a concise reason based on Family Settings
      const reasons: string[] = [];
      if (rec.mpaa && allowedRatingsPref.includes(rec.mpaa)) {
        reasons.push(`Rated ${rec.mpaa} (within your allowed ratings)`);
      }
      if (rec.runtime && maxRuntimePref && rec.runtime <= maxRuntimePref) {
        reasons.push(`Under your ${maxRuntimePref}m runtime limit`);
      }
      const preferredMatches = preferredServices.length > 0 && movieProviders?.flatrate
        ? movieProviders.flatrate.filter((p: any) => preferredServices.includes(p.provider_name)).map((p: any) => p.provider_name)
        : [];
      if (preferredMatches && preferredMatches.length > 0) {
        const list = preferredMatches.slice(0, 2).join(', ');
        reasons.push(`Available on your preferred services (${list})`);
      }
      if (year_min || year_max) {
        if (year_min === 1990 && year_max === 1999) reasons.push('From the 1990s');
        else if (year_min && year_max) reasons.push(`From ${year_min}-${year_max}`);
      }
      if (filterGenres && filterGenres.length > 0) {
        reasons.push(`Matches your genre preference (${filterGenres[0]})`);
      }
      if (min_vote_average) reasons.push('Highly rated pick');
      else if (min_popularity) reasons.push('Popular pick');
      const reason = reasons.length > 0 ? reasons[0] : undefined;

      return {
        tmdb_id: rec.tmdb_id,
        title: rec.title,
        year: rec.year,
        poster_path: rec.poster_path,
        mpaa: rec.mpaa,
        runtime: rec.runtime,
        genres: rec.genres || [],
        distance: rec.distance !== undefined ? rec.distance : undefined,
        reason,
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

    // If streaming_only is requested, filter to titles with flatrate availability
    if (streaming_only) {
      results = results.filter(r => (r.providers?.flatrate?.length || 0) > 0);
    }

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

    // Ensure we return at most the requested limit
    return results.slice(0, limit);
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
