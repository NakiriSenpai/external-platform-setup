-- =====================================================================
-- SPRINT 8 — QUESTION METADATA & CONTENT FOUNDATION
-- Jalankan seluruh isi file ini di Supabase SQL Editor
-- (project eksternal: https://ihcxyatlhgmyhiecghcn.supabase.co).
-- Idempotent: aman dijalankan ulang.
-- Prasyarat: migration Sprint 2, 3, 4, 6, dan 7 sudah dijalankan.
--
-- Sprint ini HANYA menyempurnakan model Question:
-- version, archive, question_type, origin, visibility, tagging umum,
-- search index, question health, dan history (created_by/updated_by).
-- =====================================================================

-- 1. ENUM BARU ---------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'question_type') then
    create type public.question_type as enum
      ('reading', 'listening', 'grammar', 'vocabulary', 'conversation', 'mixed');
  end if;

  if not exists (select 1 from pg_type where typname = 'question_origin') then
    create type public.question_origin as enum ('manual', 'exam', 'lesson', 'import');
  end if;

  if not exists (select 1 from pg_type where typname = 'question_visibility') then
    create type public.question_visibility as enum ('private', 'public');
  end if;
end$$;

-- 2. KOLOM BARU PADA public.questions ----------------------------------
alter table public.questions
  add column if not exists version integer not null default 1,
  add column if not exists is_archived boolean not null default false,
  add column if not exists question_type public.question_type not null default 'reading',
  add column if not exists origin public.question_origin not null default 'manual',
  add column if not exists visibility public.question_visibility not null default 'private',
  add column if not exists correct_count integer not null default 0,
  add column if not exists wrong_count integer not null default 0,
  add column if not exists skip_count integer not null default 0,
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

-- Backfill origin dari source_type (asal pertama soal dibuat).
update public.questions
set origin = source_type::text::public.question_origin
where origin = 'manual' and source_type::text <> 'manual';

-- Backfill question_type untuk data lama berbasis media (sekali saja).
update public.questions
set question_type = 'listening'
where audio_url is not null and question_type = 'reading';

-- 3. TAGGING UMUM (bukan Grammar Tag) ----------------------------------
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.question_tags (
  question_id uuid not null references public.questions (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (question_id, tag_id)
);

insert into public.tags (slug, name) values
  ('eps-topik', 'EPS-TOPIK'),
  ('simulasi', 'Simulasi'),
  ('latihan', 'Latihan'),
  ('bab-1', 'Bab 1'),
  ('bab-2', 'Bab 2'),
  ('bab-3', 'Bab 3'),
  ('bab-4', 'Bab 4')
on conflict (slug) do nothing;

-- 4. VERSION OTOMATIS --------------------------------------------------
-- version bertambah setiap isi Question berubah (bukan statistik/arsip).
create or replace function public.bump_question_version()
returns trigger
language plpgsql
as $$
begin
  if (new.text is distinct from old.text)
     or (new.image_url is distinct from old.image_url)
     or (new.audio_url is distinct from old.audio_url)
     or (new.explanation is distinct from old.explanation)
     or (new.category is distinct from old.category)
     or (new.difficulty is distinct from old.difficulty)
     or (new.question_type is distinct from old.question_type)
     or (new.lesson_id is distinct from old.lesson_id)
     or (new.visibility is distinct from old.visibility)
  then
    new.version := coalesce(old.version, 1) + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists questions_bump_version on public.questions;
create trigger questions_bump_version before update on public.questions
  for each row execute function public.bump_question_version();

-- origin tidak boleh berubah setelah dibuat.
create or replace function public.freeze_question_origin()
returns trigger
language plpgsql
as $$
begin
  new.origin := old.origin;
  return new;
end;
$$;

drop trigger if exists questions_freeze_origin on public.questions;
create trigger questions_freeze_origin before update on public.questions
  for each row execute function public.freeze_question_origin();

-- 5. SEARCH INDEX ------------------------------------------------------
create extension if not exists pg_trgm;

create index if not exists questions_text_trgm_idx
  on public.questions using gin (text gin_trgm_ops);
create index if not exists questions_explanation_trgm_idx
  on public.questions using gin (explanation gin_trgm_ops);
create index if not exists questions_archived_idx on public.questions (is_archived);
create index if not exists questions_type_idx on public.questions (question_type);
create index if not exists questions_origin_idx on public.questions (origin);
create index if not exists questions_visibility_idx on public.questions (visibility);
create index if not exists tags_name_trgm_idx on public.tags using gin (name gin_trgm_ops);
create index if not exists grammar_tags_name_trgm_idx
  on public.grammar_tags using gin (name gin_trgm_ops);
create index if not exists lessons_title_trgm_idx
  on public.lessons using gin (title gin_trgm_ops);
create index if not exists question_tags_tag_idx on public.question_tags (tag_id);

-- 6. GRANTS ------------------------------------------------------------
grant select, insert on public.tags to authenticated;
grant select, insert, delete on public.question_tags to authenticated;
grant all on public.tags to service_role;
grant all on public.question_tags to service_role;

-- 7. RLS ---------------------------------------------------------------
alter table public.tags enable row level security;
alter table public.question_tags enable row level security;

drop policy if exists "tags readable" on public.tags;
create policy "tags readable" on public.tags
  for select to authenticated using (true);

drop policy if exists "tags insert" on public.tags;
create policy "tags insert" on public.tags
  for insert to authenticated with check (true);

drop policy if exists "question tags readable" on public.question_tags;
create policy "question tags readable" on public.question_tags
  for select to authenticated using (true);

drop policy if exists "question tags manage" on public.question_tags;
create policy "question tags manage" on public.question_tags
  for all to authenticated using (true) with check (true);
