import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * DELETE /api/watch/remove
 * Remove a watch record (and optionally its rating)
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const watchId = searchParams.get('watchId');
    const tmdbId = searchParams.get('tmdbId');
    const removeRating = searchParams.get('removeRating') === 'true';

    if (!watchId) {
      return NextResponse.json({ error: 'Watch ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's household
    const { data: householdMember } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .single();

    if (!householdMember) {
      return NextResponse.json({ error: 'No household found' }, { status: 404 });
    }

    // Delete the watch record (verify it belongs to this household)
    const { error: deleteError } = await supabase
      .from('watches')
      .delete()
      .eq('id', parseInt(watchId))
      .eq('household_id', householdMember.household_id);

    if (deleteError) {
      console.error('Error deleting watch:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete watch record' },
        { status: 500 }
      );
    }

    // If requested, also remove the rating (if this was the only watch)
    if (removeRating && tmdbId) {
      // Check if there are any other watches for this movie
      const { data: otherWatches, error: watchCheckError } = await supabase
        .from('watches')
        .select('id')
        .eq('household_id', householdMember.household_id)
        .eq('tmdb_id', parseInt(tmdbId))
        .limit(1);

      if (!watchCheckError && (!otherWatches || otherWatches.length === 0)) {
        // No other watches exist, safe to remove rating
        await supabase
          .from('ratings')
          .delete()
          .eq('household_id', householdMember.household_id)
          .eq('tmdb_id', parseInt(tmdbId));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove watch API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
