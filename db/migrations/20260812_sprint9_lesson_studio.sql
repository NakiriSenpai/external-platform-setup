-- =====================================================================
-- SPRINT 9 — LESSON STUDIO
-- Jalankan seluruh isi file ini di Supabase SQL Editor
-- (project eksternal: https://ihcxyatlhgmyhiecghcn.supabase.co).
-- Idempotent: aman dijalankan ulang.
-- Prasyarat: migration Sprint 2, 3, 4, 6, 7, dan 8 sudah dijalankan.
--
-- ARSITEKTUR:
-- Lesson HANYA menyimpan referensi Question (public.lesson_questions).
-- Question tetap Single Source of Truth di public.questions.
-- =====================================================================

-- 1. ENUM --------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'lesson_status') then
    create type public.lesson_status as enum ('draft', 'published', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'lesson_block_type') then
    create type public.lesson_block_type as enum (
      'heading', 'paragraph', 'bullet_list', 'image',
      'audio', 'callout', 'divider', 'grammar_highlight'
    );
  end if;
end$$;

-- 2. LESSONS (perluasan tabel minimal Sprint 7) ------------------------
alter table public.lessons
  add column if not exists description text,
  add column if not exists category text not null default 'umum',
  add column if not exists thumbnail_url text,
  add column if not exists difficulty public.exam_difficulty not null default 'sedang',
  add column if not exists status public.lesson_status not null default 'draft',
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

-- 3. SECTION -----------------------------------------------------------
create table if not exists public.lesson_sections (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  title text not null,
  description text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. CONTENT BLOCK -----------------------------------------------------
create table if not exists public.lesson_blocks (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.lesson_sections (id) on delete cascade,
  type public.lesson_block_type not null default 'paragraph',
  content text,
  items text[] not null default '{}',
  media_url text,
  grammar_tag_id uuid references public.grammar_tags (id) on delete set null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. PRACTICE (referensi soal, TIDAK menduplikasi Question) ------------
create table if not exists public.lesson_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  section_id uuid not null references public.lesson_sections (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, question_id)
);

-- 6. INDEX -------------------------------------------------------------
create index if not exists lesson_sections_lesson_idx on public.lesson_sections (lesson_id, order_index);
create index if not exists lesson_blocks_section_idx on public.lesson_blocks (section_id, order_index);
create index if not exists lesson_questions_lesson_idx on public.lesson_questions (lesson_id);
create index if not exists lesson_questions_section_idx on public.lesson_questions (section_id, order_index);
create index if not exists lesson_questions_question_idx on public.lesson_questions (question_id);
create index if not exists lessons_status_idx on public.lessons (status);
create index if not exists lessons_category_idx on public.lessons (category);
create index if not exists lessons_difficulty_idx on public.lessons (difficulty);

-- 7. TRIGGER updated_at ------------------------------------------------
drop trigger if exists lesson_sections_touch_updated_at on public.lesson_sections;
create trigger lesson_sections_touch_updated_at before update on public.lesson_sections
  for each row execute function public.touch_updated_at();

drop trigger if exists lesson_blocks_touch_updated_at on public.lesson_blocks;
create trigger lesson_blocks_touch_updated_at before update on public.lesson_blocks
  for each row execute function public.touch_updated_at();

drop trigger if exists lesson_questions_touch_updated_at on public.lesson_questions;
create trigger lesson_questions_touch_updated_at before update on public.lesson_questions
  for each row execute function public.touch_updated_at();

-- 8. GRANTS ------------------------------------------------------------
grant select, insert, update, delete on public.lesson_sections to authenticated;
grant select, insert, update, delete on public.lesson_blocks to authenticated;
grant select, insert, update, delete on public.lesson_questions to authenticated;
grant all on public.lesson_sections to service_role;
grant all on public.lesson_blocks to service_role;
grant all on public.lesson_questions to service_role;

-- 9. RLS ---------------------------------------------------------------
alter table public.lesson_sections enable row level security;
alter table public.lesson_blocks enable row level security;
alter table public.lesson_questions enable row level security;

drop policy if exists "lesson_sections_owner_all" on public.lesson_sections;
create policy "lesson_sections_owner_all" on public.lesson_sections for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "lesson_sections_select" on public.lesson_sections;
create policy "lesson_sections_select" on public.lesson_sections for select to authenticated
  using (exists (
    select 1 from public.lessons l
    where l.id = lesson_id
      and (l.tenant_id is null or l.tenant_id = public.current_tenant_id())
  ));

drop policy if exists "lesson_blocks_owner_all" on public.lesson_blocks;
create policy "lesson_blocks_owner_all" on public.lesson_blocks for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "lesson_blocks_select" on public.lesson_blocks;
create policy "lesson_blocks_select" on public.lesson_blocks for select to authenticated
  using (exists (
    select 1
    from public.lesson_sections s
    join public.lessons l on l.id = s.lesson_id
    where s.id = section_id
      and (l.tenant_id is null or l.tenant_id = public.current_tenant_id())
  ));

drop policy if exists "lesson_questions_owner_all" on public.lesson_questions;
create policy "lesson_questions_owner_all" on public.lesson_questions for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "lesson_questions_select" on public.lesson_questions;
create policy "lesson_questions_select" on public.lesson_questions for select to authenticated
  using (exists (
    select 1 from public.lessons l
    where l.id = lesson_id
      and (l.tenant_id is null or l.tenant_id = public.current_tenant_id())
  ));
