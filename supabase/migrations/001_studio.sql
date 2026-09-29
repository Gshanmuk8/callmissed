-- Run once in the Supabase SQL editor. Uses the publishable key with Auth + RLS.
create table if not exists public.studio_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('voice','chat','images')),
  title text not null check (char_length(title) <= 120),
  messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array' and octet_length(messages::text) <= 200000),
  updated_at timestamptz not null default now()
);
create index if not exists studio_sessions_user_updated on public.studio_sessions(user_id, updated_at desc);
alter table public.studio_sessions enable row level security;
revoke all on public.studio_sessions from anon;
grant select, insert, update, delete on public.studio_sessions to authenticated;
create policy "Read own sessions" on public.studio_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own sessions" on public.studio_sessions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own sessions" on public.studio_sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own sessions" on public.studio_sessions for delete to authenticated using ((select auth.uid()) = user_id);
