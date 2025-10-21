import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { markWatched } from '@/server/tools/mark-watched';

export async function POST(request: Request) {
  try {
    const { tmdbId, rating } = await request.json();
    if (!tmdbId || typeof tmdbId !== 'number') {
      return NextResponse.json({ ok: false, error: 'tmdbId required' }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { data: member } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .single();
    if (!member) {
      // Best-effort create household if missing
      const name = user.email?.split('@')[0] || 'Family';
      const { data: household } = await supabase
        .from('households')
        .insert({ name: `${name}'s Family` })
        .select('id')
        .single();
      if (!household) return NextResponse.json({ ok: false, error: 'No household' }, { status: 404 });
      await supabase
        .from('household_members')
        .insert({ household_id: household.id, user_id: user.id, role: 'admin' });
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('household_id', household.id)
        .maybeSingle();
      const result = await markWatched({ tmdb_id: tmdbId, rating }, household.id, profile?.id);
      return NextResponse.json({ ok: true, watchId: result.watch_id, result });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('household_id', member.household_id)
      .maybeSingle();

    const result = await markWatched({ tmdb_id: tmdbId, rating }, member.household_id, profile?.id);
    return NextResponse.json({ ok: true, watchId: result.watch_id, result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Failed to mark watched' }, { status: 500 });
  }
}
