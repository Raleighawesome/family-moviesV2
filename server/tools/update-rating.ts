import { createClient } from '@/lib/supabase/server';
import {
  updateRatingSchema,
  type UpdateRatingInput,
  type UpdateRatingResult,
  ValidationError,
  DatabaseError,
  NotFoundError,
  ToolError,
} from './types';

/**
 * Update the rating for a movie that was already watched
 *
 * This tool:
 * 1. Validates the TMDB ID and rating
 * 2. Checks if the movie exists in the database
 * 3. Verifies the household has watched this movie
 * 4. Updates (upserts) the rating WITHOUT creating a new watch record
 * 5. Calls refresh_family_taste RPC if rating >= 4 to update recommendations
 * 6. Returns success with movie details
 *
 * IMPORTANT: This tool only updates ratings. It does NOT create new watch records.
 * Use mark_watched to record that a movie was watched for the first time.
 */
export async function updateRating(
  input: unknown,
  householdId: string,
  profileId?: string
): Promise<UpdateRatingResult> {
  // Validate input
  const validatedInput = updateRatingSchema.safeParse(input);
  if (!validatedInput.success) {
    throw new ValidationError(
      'Invalid update-rating parameters',
      validatedInput.error.format()
    );
  }

  const { tmdb_id, rating } = validatedInput.data;
  const supabase = await createClient();

  try {
    // Check if movie exists in our database
    const { data: movie, error: movieError } = await supabase
      .from('movies')
      .select('tmdb_id, title, year')
      .eq('tmdb_id', tmdb_id)
      .single();

    if (movieError || !movie) {
      throw new NotFoundError(
        `Movie with TMDB ID ${tmdb_id} not found in database. The movie must be watched first before you can rate it.`
      );
    }

    // Verify the household has watched this movie at least once
    const { data: watchRecord, error: watchError } = await supabase
      .from('watches')
      .select('id')
      .eq('household_id', householdId)
      .eq('tmdb_id', tmdb_id)
      .maybeSingle();

    if (watchError) {
      throw new DatabaseError('Failed to check watch history', watchError);
    }

    if (!watchRecord) {
      throw new NotFoundError(
        `The household hasn't watched "${movie.title}" yet. The movie must be watched before you can rate it.`
      );
    }

    // Update rating (or insert if not exists)
    // First, try to update the existing rating for this household + tmdb_id combination
    // We match on household_id and tmdb_id, updating whichever rating exists (profile or household level)
    console.log(`[update-rating] Updating rating for ${movie.title} (${tmdb_id}) to ${rating} stars`);

    const { data: updateData, error: updateError } = await supabase
      .from('ratings')
      .update({
        rating: rating,
        rated_at: new Date().toISOString(),
      })
      .eq('household_id', householdId)
      .eq('tmdb_id', tmdb_id)
      .select();

    if (updateError) {
      console.error('[update-rating] Rating update error:', updateError);
      throw new DatabaseError('Failed to update rating', updateError);
    }

    // If no rows were updated, insert a new rating
    if (!updateData || updateData.length === 0) {
      console.log('[update-rating] No existing rating found, inserting new one');
      const { error: insertError } = await supabase
        .from('ratings')
        .insert({
          household_id: householdId,
          profile_id: profileId || null,
          tmdb_id: tmdb_id,
          rating: rating,
          rated_at: new Date().toISOString(),
        } as any);

      if (insertError) {
        console.error('[update-rating] Rating insert error:', insertError);
        throw new DatabaseError('Failed to insert rating', insertError);
      }
    } else {
      console.log('[update-rating] Updated existing rating');
    }

    console.log('[update-rating] Rating updated successfully');

    // Refresh family taste vector (this updates personalized recommendations)
    // Only refresh if rating >= 4 stars (ratings >= 4 influence taste)
    if (rating >= 4) {
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

    // Build result message
    const message = `Updated rating for "${movie.title}"${movie.year ? ` (${movie.year})` : ''} to ${rating} star${rating !== 1 ? 's' : ''}`;

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
      `Failed to update rating: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'UPDATE_RATING_ERROR',
      error
    );
  }
}
