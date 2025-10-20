import { createClient } from '@/lib/supabase/server';
import { getCompleteMovieData } from '@/lib/tmdb/client';
import { normalizeTMDBMovie } from '@/lib/tmdb/normalize';
import { generateMovieEmbedding, embeddingToVector } from '@/lib/openai/embeddings';
import {
  markWatchedSchema,
  type MarkWatchedInput,
  type MarkWatchedResult,
  ValidationError,
  DatabaseError,
  NotFoundError,
  ToolError,
} from './types';

/**
 * Mark a movie as watched with optional rating
 *
 * This tool:
 * 1. Validates the TMDB ID and optional rating
 * 2. Checks if movie exists in database
 * 3. Inserts watch record into watches table
 * 4. If rating provided, upserts into ratings table
 * 5. Calls refresh_family_taste RPC to update recommendations
 * 6. Returns success with movie details
 */
export async function markWatched(
  input: unknown,
  householdId: string,
  profileId?: string
): Promise<MarkWatchedResult> {
  // Validate input
  const validatedInput = markWatchedSchema.safeParse(input);
  if (!validatedInput.success) {
    throw new ValidationError(
      'Invalid mark-watched parameters',
      validatedInput.error.format()
    );
  }

  const { tmdb_id, rating, watched_at, notes } = validatedInput.data;
  const supabase = await createClient();

  try {
    // Check if this movie was already watched recently (within last 24 hours) to prevent duplicates
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentWatch } = await supabase
      .from('watches')
      .select('id')
      .eq('household_id', householdId)
      .eq('tmdb_id', tmdb_id)
      .gte('watched_at', oneDayAgo)
      .maybeSingle();

    if (recentWatch) {
      console.log(`[mark-watched] Movie ${tmdb_id} was already marked as watched recently, skipping duplicate`);
      return {
        success: true,
        movie: {
          tmdb_id: tmdb_id,
          title: 'Movie',
        },
        rating,
        message: 'This movie was already marked as watched recently',
      };
    }

    // Check if movie exists in our database
    let movie = await supabase
      .from('movies')
      .select('tmdb_id, title, year')
      .eq('tmdb_id', tmdb_id)
      .single()
      .then(({ data }) => data);

    // If movie doesn't exist, fetch from TMDB and add it
    if (!movie) {
      console.log(`Movie ${tmdb_id} not found in database, fetching from TMDB...`);

      const tmdbData = await getCompleteMovieData(tmdb_id);
      const normalizedMovie = normalizeTMDBMovie(
        tmdbData.details,
        tmdbData.mpaaRating,
        tmdbData.keywords.keywords.map(k => k.name) // Extract keyword names from TMDBKeywordsResponse
      );

      // Generate embedding
      const embedding = await generateMovieEmbedding({
        title: normalizedMovie.title,
        overview: normalizedMovie.overview || '',
        genres: normalizedMovie.genres,
        keywords: normalizedMovie.keywords,
      });

      // Insert movie into database
      const { data: insertedMovie, error: insertError } = await supabase
        .from('movies')
        .insert({
          ...normalizedMovie,
          embedding: embeddingToVector(embedding),
        })
        .select('tmdb_id, title, year')
        .single();

      if (insertError) {
        throw new DatabaseError('Failed to insert movie', insertError);
      }

      movie = insertedMovie;
      console.log(`✅ Added movie "${movie.title}" to database`);
    }

    // Insert watch record
    console.log(`[mark-watched] Inserting watch record:`, {
      household_id: householdId,
      profile_id: profileId || null,
      tmdb_id: tmdb_id,
      movie_title: movie.title,
    });

    const { data: watchData, error: watchError } = await supabase
      .from('watches')
      .insert({
        household_id: householdId,
        profile_id: profileId || null,
        tmdb_id: tmdb_id,
        watched_at: watched_at || new Date().toISOString(),
        rewatch: false,
        notes: notes || null,
      })
      .select();

    if (watchError) {
      console.error('[mark-watched] Watch insert error:', watchError);
      throw new DatabaseError('Failed to record watch', watchError);
    }

    console.log('[mark-watched] Watch inserted successfully:', watchData);

    // If rating provided, upsert rating
    if (rating !== undefined) {
      const { error: ratingError } = await supabase
        .from('ratings')
        .upsert({
          household_id: householdId,
          profile_id: profileId || null,
          tmdb_id: tmdb_id,
          rating: rating,
          rated_at: new Date().toISOString(),
        });

      if (ratingError) {
        // Log but don't fail if rating fails
        console.error('Failed to save rating:', ratingError);
      }
    }

    // Refresh family taste vector (this updates personalized recommendations)
    // Only refresh if a rating was provided and is high (>= 8/10)
    if (rating !== undefined && rating >= 8) {
      try {
        await supabase.rpc('refresh_family_taste', {
          p_household_id: householdId,
        });
        console.log(`✅ Refreshed family taste for household ${householdId}`);
      } catch (tasteError) {
        // Log but don't fail if taste refresh fails
        console.error('Failed to refresh family taste:', tasteError);
      }
    }

    // Build result message (include watched date if provided)
    const watchedAtDate = watched_at ? new Date(watched_at) : new Date();
    const watchedDateStr = watchedAtDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let message = `I've marked "${movie.title}"${movie.year ? ` (${movie.year})` : ''} as watched on ${watchedDateStr}`;
    if (rating !== undefined) {
      message += `, with a rating of ${rating} star${rating !== 1 ? 's' : ''}`;
    }
    message += '.';

    return {
      success: true,
      movie: {
        tmdb_id: movie.tmdb_id,
        title: movie.title,
      },
      rating,
      message,
    };
  } catch (error) {
    if (error instanceof ToolError) {
      throw error;
    }

    throw new ToolError(
      `Failed to mark movie as watched: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'MARK_WATCHED_ERROR',
      error
    );
  }
}
