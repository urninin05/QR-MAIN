-- PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student'
    check (role in ('student', 'teacher')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- EVENTS
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_code text not null unique,
  title text not null,
  start_time timestamptz,
  end_time timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ATTENDANCE
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null
    references auth.users (id) on delete cascade,
  event_id uuid not null
    references public.events (id) on delete cascade,
  scanned_at timestamptz not null default now(),
  unique (student_id, event_id)
);

-- ENABLE ROW LEVEL SECURITY
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;

-- PROFILES POLICIES
create policy "Users can view own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id);

-- EVENTS POLICIES
create policy "Authenticated users can view events"
on public.events
for select
to authenticated
using (true);

create policy "Authenticated users can create events"
on public.events
for insert
to authenticated
with check (auth.uid() = created_by or created_by is null);

-- ATTENDANCE POLICIES
create policy "Users can view own attendance"
on public.attendance
for select
to authenticated
using (auth.uid() = student_id);

create policy "Users can insert own attendance"
on public.attendance
for insert
to authenticated
with check (auth.uid() = student_id);

-- AUTO-CREATE PROFILE AFTER SIGNUP
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();