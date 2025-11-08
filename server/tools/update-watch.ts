import { createClient } from '@/lib/supabase/server';
import {
  updateWatchSchema,
  type UpdateWatchResult,
  ValidationError,
  DatabaseError,
  NotFoundError,
  ToolError,
} from './types';

/**
 * Update an existing watch entry for a movie in the household history
 */
export async function updateWatch(
  input: unknown,
  householdId: string,
  _profileId?: string
): Promise<UpdateWatchResult> {
  const validation = updateWatchSchema.safeParse(input);
  if (!validation.success) {
    throw new ValidationError('Invalid update-watch parameters', validation.error.format());
  }

  const { tmdb_id, watch_id, original_watched_at, watched_at, notes, rewatch } = validation.data;
  const supabase = await createClient();

  const selectColumns = `
    id,
    watched_at,
    notes,
    rewatch,
    tmdb_id,
    movies (
      tmdb_id,
      title,
      year
    )
  `;

  try {
    let watchRecord: any = null;

    if (watch_id) {
      const { data, error } = await supabase
        .from('watches')
        .select(selectColumns)
        .eq('household_id', householdId)
        .eq('id', watch_id)
        .maybeSingle();

      if (error) {
        throw new DatabaseError('Failed to find watch entry by ID', error);
      }

      if (!data) {
        throw new NotFoundError('Watch entry not found for this household');
      }

      if (data.tmdb_id !== tmdb_id) {
        throw new ValidationError('The specified watch entry does not belong to that movie');
      }

      watchRecord = data;
    } else {
      let query = supabase
        .from('watches')
        .select(selectColumns)
        .eq('household_id', householdId)
        .eq('tmdb_id', tmdb_id)
        .order('watched_at', { ascending: false });

      if (original_watched_at) {
        query = query.eq('watched_at', original_watched_at);
      }

      const { data, error } = await query.limit(1);

      if (error) {
        throw new DatabaseError('Failed to locate watch entry', error);
      }

      if (!data || data.length === 0) {
        throw new NotFoundError('No watch history found for that movie');
      }

      watchRecord = data[0];
    }

    const updates: Record<string, any> = {};

    if (watched_at !== undefined) {
      updates.watched_at = watched_at;
    }

    if (notes !== undefined) {
      if (typeof notes === 'string') {
        const trimmed = notes.trim();
        updates.notes = trimmed.length > 0 ? trimmed : null;
      } else {
        updates.notes = null;
      }
    }

    if (rewatch !== undefined) {
      updates.rewatch = rewatch;
    }

    if (Object.keys(updates).length === 0) {
      return {
        success: true,
        watch: {
          id: watchRecord.id,
          tmdb_id: watchRecord.tmdb_id,
          watched_at: watchRecord.watched_at,
          notes: watchRecord.notes ?? null,
          rewatch: watchRecord.rewatch ?? null,
        },
        message: 'No changes were applied to the watch entry.',
      };
    }

    const { data: updated, error: updateError } = await supabase
      .from('watches')
      .update(updates)
      .eq('household_id', householdId)
      .eq('id', watchRecord.id)
      .select(selectColumns)
      .maybeSingle();

    if (updateError) {
      throw new DatabaseError('Failed to update watch entry', updateError);
    }

    if (!updated) {
      throw new ToolError('Watch entry update returned no data', 'UPDATE_WATCH_NO_DATA');
    }

    const movieTitle = updated.movies?.title ?? 'the movie';
    const movieYear = updated.movies?.year;

    const updatesApplied: string[] = [];

    if (updates.watched_at !== undefined) {
      const newDate = new Date(updated.watched_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      updatesApplied.push(`set the watch date to ${newDate}`);
    }

    if (updates.notes !== undefined) {
      if (updated.notes) {
        updatesApplied.push(`updated the note to "${updated.notes}"`);
      } else {
        updatesApplied.push('cleared the note');
      }
    }

    if (updates.rewatch !== undefined) {
      updatesApplied.push(
        updated.rewatch ? 'marked this entry as a rewatch' : 'marked this entry as the first watch'
      );
    }

    const summary = updatesApplied.join('; ');
    const messageParts = [`Updated your watch entry for "${movieTitle}"${movieYear ? ` (${movieYear})` : ''}`];
    if (summary) {
      messageParts.push(`— ${summary}.`);
    }

    return {
      success: true,
      watch: {
        id: updated.id,
        tmdb_id: updated.tmdb_id,
        watched_at: updated.watched_at,
        notes: updated.notes ?? null,
        rewatch: updated.rewatch ?? null,
      },
      message: messageParts.join(' '),
    };
  } catch (error) {
    if (error instanceof ToolError) {
      throw error;
    }

    throw new ToolError(
      `Failed to update watch entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'UPDATE_WATCH_ERROR',
      error
    );
  }
}
