import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type ToolInvocation = {
  toolCallId: string;
  toolName: string;
  args: Record<string, any> | null;
  state: 'call' | 'result';
  result?: any;
};

function toToolInvocations(metadata: any): ToolInvocation[] | undefined {
  if (!metadata?.toolInvocations || !Array.isArray(metadata.toolInvocations)) {
    return undefined;
  }
  return metadata.toolInvocations.map((invocation: any) => ({
    toolCallId: invocation.toolCallId,
    toolName: invocation.toolName,
    args: invocation.args ?? null,
    state: invocation.state === 'result' ? 'result' : 'call',
    result: invocation.result ?? undefined,
  }));
}

export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = params;

  const { data: householdMember, error: memberError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();

  if (memberError || !householdMember) {
    return NextResponse.json({ error: 'No household found for user' }, { status: 404 });
  }

  const { data: session, error: sessionError } = await supabase
    .from('chat_sessions')
    .select('id, household_id, title, started_at, last_activity_at')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionError) {
    console.error('[Chat History] Failed to load session', sessionError);
    return NextResponse.json({ error: 'Failed to load chat session' }, { status: 500 });
  }

  if (!session || session.household_id !== householdMember.household_id) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, metadata, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Chat History] Failed to load messages', error);
    return NextResponse.json({ error: 'Failed to load chat history' }, { status: 500 });
  }

  const formatted = (messages || []).map((message) => ({
    id: message.id ? String(message.id) : undefined,
    role: message.role,
    content: message.content,
    created_at: message.created_at,
    toolInvocations: toToolInvocations(message.metadata),
  }));

  return NextResponse.json({
    session: {
      id: session.id,
      title: session.title,
      started_at: session.started_at,
      last_activity_at: session.last_activity_at,
    },
    messages: formatted,
  });
}
