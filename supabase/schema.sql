-- =====================================================================
--  Speakly — Supabase schema
--  Run this once in:  Supabase Dashboard → SQL Editor → New query → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) PROFILES  — one row per signed-in user (auto-created on signup)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  streak      int  not null default 1,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Each user can only see / edit their own profile row.
drop policy if exists "own profile read"  on public.profiles;
drop policy if exists "own profile write" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile write"  on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile row the moment a user signs up (Google login).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2) HISTORY  — saved practice items (limit "D": only for signed-in users)
-- ---------------------------------------------------------------------
create table if not exists public.history (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null,                 -- 'correct' | 'native' | 'modes' | 'ielts' | 'voice'
  input_text  text,
  output_text text,
  created_at  timestamptz not null default now()
);

create index if not exists history_user_idx on public.history (user_id, created_at desc);

alter table public.history enable row level security;

drop policy if exists "own history read"  on public.history;
drop policy if exists "own history write" on public.history;
create policy "own history read"  on public.history for select using (auth.uid() = user_id);
create policy "own history write" on public.history for insert with check (auth.uid() = user_id);
