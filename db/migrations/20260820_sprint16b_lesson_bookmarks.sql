-- Sprint 16B — Lesson Bookmarks (materi tersimpan per siswa)
-- Idempotent: aman dijalankan ulang.

create table if not exists public.lesson_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index if not exists lesson_bookmarks_user_idx on public.lesson_bookmarks(user_id);
create index if not exists lesson_bookmarks_lesson_idx on public.lesson_bookmarks(lesson_id);

grant select, insert, delete on public.lesson_bookmarks to authenticated;
grant all on public.lesson_bookmarks to service_role;

alter table public.lesson_bookmarks enable row level security;

drop policy if exists "bookmark owner can read" on public.lesson_bookmarks;
create policy "bookmark owner can read"
on public.lesson_bookmarks for select to authenticated
using (user_id = auth.uid());

drop policy if exists "bookmark owner can insert" on public.lesson_bookmarks;
create policy "bookmark owner can insert"
on public.lesson_bookmarks for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "bookmark owner can delete" on public.lesson_bookmarks;
create policy "bookmark owner can delete"
on public.lesson_bookmarks for delete to authenticated
using (user_id = auth.uid());
