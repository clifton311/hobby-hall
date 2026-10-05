-- Hobby Hall database schema
-- Run this once in your Supabase project: Dashboard -> SQL Editor -> paste -> Run

-- ============ TABLES ============

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text unique not null check (char_length(name) between 1 and 40),
  bio text default '' check (char_length(bio) <= 200),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  title text not null check (char_length(title) between 1 and 120),
  body text default '' check (char_length(body) <= 2000),
  image_url text,
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);

create table public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 300),
  created_at timestamptz not null default now(),
  check (num_nonnulls(post_id, comment_id) = 1),
  unique (reporter_id, post_id),
  unique (reporter_id, comment_id)
);

-- ============ ADMIN ROLE ============
-- Make someone an admin from the SQL editor:
--   update public.profiles set is_admin = true where name = 'YourName';

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

-- API users (anon/authenticated) can never set or change is_admin.
create function public.protect_is_admin() returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and new.is_admin then
      raise exception 'is_admin cannot be set by users';
    elsif tg_op = 'UPDATE' and new.is_admin is distinct from old.is_admin then
      raise exception 'is_admin cannot be changed by users';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_protect_is_admin
  before insert or update on public.profiles
  for each row execute function public.protect_is_admin();

-- ============ ROW LEVEL SECURITY ============
-- Everyone can read; users can only write/delete their own rows.

alter table public.profiles enable row level security;
alter table public.posts    enable row level security;
alter table public.comments enable row level security;
alter table public.likes    enable row level security;
alter table public.reports  enable row level security;

create policy "profiles are readable by everyone" on public.profiles for select using (true);
create policy "users manage own profile"          on public.profiles for insert with check (auth.uid() = id);
create policy "users update own profile"          on public.profiles for update using (auth.uid() = id);

create policy "posts are readable by everyone" on public.posts for select using (true);
create policy "users create own posts"         on public.posts for insert with check (auth.uid() = user_id);
create policy "users delete own posts"         on public.posts for delete using (auth.uid() = user_id);
create policy "admins delete any post"         on public.posts for delete using (public.is_admin());

create policy "comments are readable by everyone" on public.comments for select using (true);
create policy "users create own comments"         on public.comments for insert with check (auth.uid() = user_id);
create policy "users delete own comments"         on public.comments for delete using (auth.uid() = user_id);
create policy "admins delete any comment"         on public.comments for delete using (public.is_admin());

create policy "likes are readable by everyone" on public.likes for select using (true);
create policy "users create own likes"         on public.likes for insert with check (auth.uid() = user_id);
create policy "users remove own likes"         on public.likes for delete using (auth.uid() = user_id);

create policy "users file own reports"   on public.reports for insert with check (auth.uid() = reporter_id);
create policy "admins read reports"      on public.reports for select using (public.is_admin());

-- ============ PHOTO STORAGE ============

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true);

create policy "photos are readable by everyone"
  on storage.objects for select using (bucket_id = 'photos');

create policy "authenticated users upload to own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owners and admins delete photos"
  on storage.objects for delete
  using (
    bucket_id = 'photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
