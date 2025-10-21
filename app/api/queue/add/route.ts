import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { addToQueue } from '@/server/tools/add-to-queue';

export async function POST(request: Request) {
  try {
    const { tmdbId, movie } = await request.json();
    if (!tmdbId || typeof tmdbId !== 'number') {
      return NextResponse.json({ ok: false, error: 'tmdbId required' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Load existing household membership; do not create a new household here
    const { data: householdMember, error: memberErr } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberErr && memberErr.code !== 'PGRST116') {
      return NextResponse.json({ ok: false, error: 'Failed to load household' }, { status: 500 });
    }
    if (!householdMember) {
      return NextResponse.json({ ok: false, error: 'No household found' }, { status: 400 });
    }

    // Optional profile id for added_by
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('household_id', householdMember.household_id)
      .maybeSingle();

    try {
      const result = await addToQueue({ tmdb_id: tmdbId }, householdMember.household_id, profile?.id);
      return NextResponse.json({ ok: true, queueItemId: result.queue_item_id ?? null });
    } catch (e) {
      // Fallback: minimal insert without embedding if TMDB/OpenAI fails and client supplied movie data
      if (!movie) throw e;
      const service = createServiceClient();
      const { data: existing } = await service
        .from('movies')
        .select('tmdb_id')
        .eq('tmdb_id', tmdbId)
        .maybeSingle();
      if (!existing) {
        await service.from('movies').insert({
          tmdb_id: tmdbId,
          title: movie.title,
          year: movie.year ?? null,
          poster_path: movie.poster_path ?? null,
          overview: null,
          runtime: movie.runtime ?? null,
          mpaa: movie.rating ?? null,
          genres: movie.genres ?? [],
          keywords: [],
          embedding: null,
        });
      }
      const { data: row } = await service
        .from('list_items')
        .insert({ household_id: householdMember.household_id, tmdb_id: tmdbId, list_type: 'queue', added_by: profile?.id || null })
        .select('id')
        .single();
      return NextResponse.json({ ok: true, queueItemId: row?.id || null });
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Failed to add to queue' }, { status: 500 });
  }
}

