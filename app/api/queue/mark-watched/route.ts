import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { itemId, tmdbId, rating } = await req.json();

    if (!itemId || !tmdbId) {
      return NextResponse.json(
        { error: 'Item ID and TMDB ID required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user and household
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: householdMember } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .single();

    if (!householdMember) {
      return NextResponse.json({ error: 'No household found' }, { status: 404 });
    }

    // Get user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('household_id', householdMember.household_id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'No profile found' }, { status: 404 });
    }

    // Get movie data
    const { data: movie } = await supabase
      .from('movies')
      .select('id')
      .eq('tmdb_id', tmdbId)
      .single();

    if (!movie) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }

    // Insert watch record
    const { error: watchError } = await supabase.from('watches').insert({
      household_id: householdMember.household_id,
      profile_id: profile.id,
      movie_id: movie.id,
      watched_at: new Date().toISOString(),
    });

    if (watchError) {
      console.error('Error creating watch record:', watchError);
      return NextResponse.json(
        { error: 'Failed to create watch record' },
        { status: 500 }
      );
    }

    // Insert rating if provided (1-10 scale)
    if (rating && rating >= 1 && rating <= 10) {
      const { error: ratingError } = await supabase.from('ratings').insert({
        household_id: householdMember.household_id,
        profile_id: profile.id,
        movie_id: movie.id,
        rating,
      });

      if (ratingError) {
        console.error('Error creating rating:', ratingError);
        // Don't fail the whole operation if rating fails
      }

      // If rating is 4+, refresh taste vector
      if (rating >= 4) {
        try {
          await supabase.rpc('refresh_household_taste', {
            p_household_id: householdMember.household_id,
          });
        } catch (tasteError) {
          console.error('Error refreshing taste vector:', tasteError);
          // Don't fail the operation
        }
      }
    }

    // Remove from queue
    const { error: deleteError } = await supabase
      .from('list_items')
      .delete()
      .eq('id', itemId);

    if (deleteError) {
      console.error('Error removing from queue:', deleteError);
      // Don't fail the operation - the watch was recorded
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark watched error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
