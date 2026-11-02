-- Habit Tracker: initial schema.
-- Mirrors AppState in src/lib/app-state.ts. Every row belongs to one user (auth.users) and row
-- level security limits each user to their own rows. `updated_at` is set by the database on every
-- write so clients can pull only what changed since their last sync. Deletes of habits are soft
-- (`deleted_at`) so they propagate to other devices.

-- Keeps updated_at current on every insert/update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- One row per user: settings, the challenge in progress, and onboarding status.
create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  onboarded boolean not null default false,
  sound boolean not null default true,
  reminder_morning text check (reminder_morning ~ '^\d{2}:\d{2}$'),
  reminder_evening text check (reminder_evening ~ '^\d{2}:\d{2}$'),
  challenge_length smallint check (challenge_length in (3, 7, 21)),
  challenge_started_on date,
  celebrated_perfect_day date,
  updated_at timestamptz not null default now(),
  check ((challenge_length is null) = (challenge_started_on is null))
);

create table public.habits (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  name text not null check (char_length(name) between 1 and 100),
  emoji text not null check (char_length(emoji) between 1 and 16),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  kind text not null check (kind in ('check', 'count')),
  target smallint not null check (target between 1 and 20),
  -- Earlier targets, oldest first: [{ "until": "YYYY-MM-DD", "target": n }].
  target_history jsonb not null default '[]' check (jsonb_typeof(target_history) = 'array'),
  intention_time text check (intention_time ~ '^\d{2}:\d{2}$'),
  created_on date not null,
  position integer not null default 0,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- One row per habit per day. count = 0 means the day's logs were undone.
create table public.habit_logs (
  user_id uuid not null default auth.uid(),
  habit_id text not null,
  day date not null,
  count smallint not null check (count between 0 and 1000),
  updated_at timestamptz not null default now(),
  primary key (user_id, habit_id, day),
  foreign key (user_id, habit_id) references public.habits (user_id, id) on delete cascade
);

create table public.badges (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  length smallint not null check (length in (3, 7, 21)),
  earned_on date not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, length, earned_on)
);

-- Incremental sync: "everything of mine changed since T".
create index habits_user_updated on public.habits (user_id, updated_at);
create index habit_logs_user_updated on public.habit_logs (user_id, updated_at);
create index badges_user_updated on public.badges (user_id, updated_at);

create trigger profiles_updated_at before insert or update on public.profiles
  for each row execute function public.set_updated_at();
create trigger habits_updated_at before insert or update on public.habits
  for each row execute function public.set_updated_at();
create trigger habit_logs_updated_at before insert or update on public.habit_logs
  for each row execute function public.set_updated_at();
create trigger badges_updated_at before insert or update on public.badges
  for each row execute function public.set_updated_at();

-- Row level security: signed-in users can only see and change their own rows.
-- Nothing is granted to anonymous (signed-out) requests.
alter table public.profiles enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.badges enable row level security;

create policy "own profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own habits" on public.habits for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own habit logs" on public.habit_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own badges" on public.badges for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.profiles, public.habits, public.habit_logs, public.badges from anon;
