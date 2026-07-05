-- Hobby Hall database schema
-- Run this once in your Supabase project: Dashboard -> SQL Editor -> paste -> Run

-- ============ TABLES ============

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text unique not null check (char_length(name) between 1 and 40),
  bio text default '' check (char_length(bio) <= 200),
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

-- ============ ROW LEVEL SECURITY ============
-- Everyone can read; users can only write/delete their own rows.

alter table public.profiles enable row level security;
alter table public.posts    enable row level security;
alter table public.comments enable row level security;
alter table public.likes    enable row level security;

create policy "profiles are readable by everyone" on public.profiles for select using (true);
create policy "users manage own profile"          on public.profiles for insert with check (auth.uid() = id);
create policy "users update own profile"          on public.profiles for update using (auth.uid() = id);

create policy "posts are readable by everyone" on public.posts for select using (true);
create policy "users create own posts"         on public.posts for insert with check (auth.uid() = user_id);
create policy "users delete own posts"         on public.posts for delete using (auth.uid() = user_id);

create policy "comments are readable by everyone" on public.comments for select using (true);
create policy "users create own comments"         on public.comments for insert with check (auth.uid() = user_id);
create policy "users delete own comments"         on public.comments for delete using (auth.uid() = user_id);

create policy "likes are readable by everyone" on public.likes for select using (true);
create policy "users create own likes"         on public.likes for insert with check (auth.uid() = user_id);
create policy "users remove own likes"         on public.likes for delete using (auth.uid() = user_id);

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
