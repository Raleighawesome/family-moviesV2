import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { tmdbIds } = await request.json();
    if (!Array.isArray(tmdbIds) || tmdbIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'tmdbIds required' }, { status: 400 });
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
    if (!member) return NextResponse.json({ ok: false, error: 'No household' }, { status: 404 });

    const { data } = await supabase
      .from('list_items')
      .select('tmdb_id')
      .eq('household_id', member.household_id)
      .eq('list_type', 'queue')
      .in('tmdb_id', tmdbIds);

    const inQueueSet = new Set((data || []).map((d: any) => d.tmdb_id));
    return NextResponse.json({ ok: true, inQueue: Array.from(inQueueSet) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Failed to fetch state' }, { status: 500 });
  }
}

