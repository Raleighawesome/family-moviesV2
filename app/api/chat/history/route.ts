import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function normalizeTitle(title?: string | null) {
  if (!title) return null;
  const cleaned = title.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: householdMember, error: memberError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();

  if (memberError || !householdMember) {
    return NextResponse.json({ error: 'No household found for user' }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('household_id', householdMember.household_id)
    .single();

  let title: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    title = normalizeTitle(body?.title);
  } catch (error) {
    title = null;
  }

  const { data: session, error } = await supabase
    .from('chat_sessions')
    .insert({
      household_id: householdMember.household_id,
      profile_id: profile?.id ?? null,
      title,
    })
    .select('id, started_at, last_activity_at, title')
    .single();

  if (error || !session) {
    console.error('[Chat History] Failed to create session', error);
    return NextResponse.json({ error: 'Failed to create chat session' }, { status: 500 });
  }

  return NextResponse.json({ sessionId: session.id, session });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: householdMember, error: memberError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();

  if (memberError || !householdMember) {
    return NextResponse.json({ error: 'No household found for user' }, { status: 404 });
  }

  const { data: sessions, error } = await supabase
    .from('chat_sessions')
    .select(
      `
        id,
        title,
        started_at,
        last_activity_at,
        chat_messages(count)
      `
    )
    .eq('household_id', householdMember.household_id)
    .order('last_activity_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[Chat History] Failed to fetch sessions', error);
    return NextResponse.json({ error: 'Failed to load chat history' }, { status: 500 });
  }

  const formatted = (sessions || []).map((session: any) => ({
    id: session.id,
    title: session.title,
    started_at: session.started_at,
    last_activity_at: session.last_activity_at,
    message_count: session.chat_messages?.[0]?.count ?? 0,
  }));

  return NextResponse.json({ sessions: formatted });
}
