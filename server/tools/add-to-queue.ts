import { getCompleteMovieData, extractMPAARating, normalizeTMDBMovie } from '@/lib/tmdb';
import { generateMovieEmbedding, embeddingToVector } from '@/lib/openai';
import { createClient } from '@/lib/supabase/server';
import {
  addToQueueSchema,
  type AddToQueueInput,
  type AddToQueueResult,
  ValidationError,
  NotFoundError,
  DatabaseError,
  ToolError,
} from './types';

/**
 * Add a movie to the household's queue
 *
 * This tool:
 * 1. Validates the TMDB ID
 * 2. Checks if movie exists in our database
 * 3. If not, fetches from TMDB, generates embedding, and inserts
 * 4. Adds movie to household's queue (list_items)
 * 5. Returns success with movie details
 */
export async function addToQueue(
  input: unknown,
  householdId: string,
  profileId?: string
): Promise<AddToQueueResult> {
  // Validate input
  const validatedInput = addToQueueSchema.safeParse(input);
  if (!validatedInput.success) {
    throw new ValidationError(
      'Invalid add-to-queue parameters',
      validatedInput.error.format()
    );
  }

  const { tmdb_id } = validatedInput.data;
  const supabase = await createClient();

  try {
    // Check if movie already exists in database
    const { data: existingMovie, error: fetchError } = await supabase
      .from('movies')
      .select('tmdb_id, title, year, poster_path, embedding')
      .eq('tmdb_id', tmdb_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new DatabaseError('Failed to check if movie exists', fetchError);
    }

    let movie = existingMovie;

    // If movie doesn't exist in our database, fetch from TMDB and add it
    if (!movie) {
      console.log(`Movie ${tmdb_id} not in database, fetching from TMDB...`);

      // Fetch complete movie data from TMDB
      const movieData = await getCompleteMovieData(tmdb_id);
      const mpaaRating = extractMPAARating(movieData.releaseDates);

      // Normalize to database format
      const normalizedMovie = normalizeTMDBMovie(
        movieData.details,
        mpaaRating,
        movieData.keywords.keywords.map(k => k.name)
      );

      // Generate embedding
      console.log(`Generating embedding for "${normalizedMovie.title}"...`);
      const embedding = await generateMovieEmbedding({
        title: normalizedMovie.title,
        overview: normalizedMovie.overview,
        genres: normalizedMovie.genres,
        keywords: normalizedMovie.keywords.slice(0, 10), // Top 10 keywords
      });

      // Insert movie into database
      const { data: insertedMovie, error: insertError } = await supabase
        .from('movies')
        .insert({
          ...normalizedMovie,
          embedding: embeddingToVector(embedding),
        })
        .select('tmdb_id, title, year, poster_path')
        .single();

      if (insertError) {
        throw new DatabaseError('Failed to insert movie into database', insertError);
      }

      movie = insertedMovie;
      console.log(`✅ Added "${movie.title}" to movies database`);
    }

    // Check if already in queue
    const { data: existingQueueItem } = await supabase
      .from('list_items')
      .select('id')
      .eq('household_id', householdId)
      .eq('tmdb_id', tmdb_id)
      .eq('list_type', 'queue')
      .single();

    if (existingQueueItem) {
      return {
        success: true,
        movie: {
          tmdb_id: movie.tmdb_id,
          title: movie.title,
          year: movie.year,
          poster_path: movie.poster_path,
        },
        message: `"${movie.title}" is already in your queue`,
      };
    }

    // Add to queue
    const { error: queueError } = await supabase
      .from('list_items')
      .insert({
        household_id: householdId,
        tmdb_id: tmdb_id,
        list_type: 'queue',
        added_by: profileId || null,
      });

    if (queueError) {
      throw new DatabaseError('Failed to add movie to queue', queueError);
    }

    return {
      success: true,
      movie: {
        tmdb_id: movie.tmdb_id,
        title: movie.title,
        year: movie.year,
        poster_path: movie.poster_path,
      },
      message: `Added "${movie.title}"${movie.year ? ` (${movie.year})` : ''} to your queue`,
    };
  } catch (error) {
    if (error instanceof ToolError) {
      throw error;
    }

    // Check if it's a TMDB "not found" error
    if (error instanceof Error && error.message.includes('404')) {
      throw new NotFoundError(`Movie with TMDB ID ${tmdb_id} not found`);
    }

    throw new ToolError(
      `Failed to add movie to queue: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'ADD_TO_QUEUE_ERROR',
      error
    );
  }
}
