-- Chat history tables for preserving conversations

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  profile_id uuid references public.profiles on delete set null,
  title text,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create index chat_sessions_household_idx on public.chat_sessions (household_id, last_activity_at desc);

create table public.chat_messages (
  id bigserial primary key,
  session_id uuid not null references public.chat_sessions on delete cascade,
  role text not null check (role in ('user','assistant','system','tool')),
  content text not null default '',
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index chat_messages_session_idx on public.chat_messages (session_id, created_at asc);

-- Enable RLS
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

-- Policies for chat sessions
create policy select_chat_sessions on public.chat_sessions
  for select using (is_member(household_id));

create policy insert_chat_sessions on public.chat_sessions
  for insert with check (is_member(household_id));

create policy update_chat_sessions on public.chat_sessions
  for update using (is_member(household_id));

create policy delete_chat_sessions on public.chat_sessions
  for delete using (is_member(household_id));

-- Policies for chat messages
create policy select_chat_messages on public.chat_messages
  for select using (
    exists (
      select 1 from public.chat_sessions cs
      where cs.id = chat_messages.session_id
        and is_member(cs.household_id)
    )
  );

create policy insert_chat_messages on public.chat_messages
  for insert with check (
    exists (
      select 1 from public.chat_sessions cs
      where cs.id = chat_messages.session_id
        and is_member(cs.household_id)
    )
  );

create policy update_chat_messages on public.chat_messages
  for update using (
    exists (
      select 1 from public.chat_sessions cs
      where cs.id = chat_messages.session_id
        and is_member(cs.household_id)
    )
  );

create policy delete_chat_messages on public.chat_messages
  for delete using (
    exists (
      select 1 from public.chat_sessions cs
      where cs.id = chat_messages.session_id
        and is_member(cs.household_id)
    )
  );
