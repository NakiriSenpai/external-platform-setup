-- =========================================================================
-- Sprint 30b — Infrastruktur migrasi referensi pilihan (DITUNDA / PAUSED)
-- JANGAN dijalankan sampai migrasi pembahasan dilanjutkan.
-- File ini hanya membuat tabel backup + fungsi apply/restore. Menjalankannya
-- TIDAK mengubah pembahasan apa pun; perubahan hanya terjadi bila Owner
-- memanggil apply_explanation_migration dari halaman Migrasi Pembahasan.
-- Tidak bergantung pada Sprint 30a.
-- =========================================================================

begin;

-- -------------------------------------------------------------------------
-- 2) Migrasi referensi pilihan: backup + apply + restore
-- -------------------------------------------------------------------------
create table if not exists public.explanation_migration_backups (
  id bigserial primary key,
  run_id uuid not null,
  question_id uuid not null references public.questions (id) on delete cascade,
  answer_label text,               -- null = pembahasan umum soal
  original_text text not null,
  migrated_text text not null,
  applied_by uuid references public.profiles (id) on delete set null,
  applied_at timestamptz not null default now(),
  restored_at timestamptz
);

create index if not exists emb_run_idx on public.explanation_migration_backups (run_id);

alter table public.explanation_migration_backups enable row level security;
revoke all on public.explanation_migration_backups from anon, authenticated;
grant select on public.explanation_migration_backups to authenticated;
grant all on public.explanation_migration_backups to service_role;

drop policy if exists "emb_select_owner" on public.explanation_migration_backups;
create policy "emb_select_owner"
on public.explanation_migration_backups for select to authenticated
using (public.is_owner());

-- p_changes: [{question_id, answer_label|null, original, migrated}]
-- Field hanya diubah bila isinya SAMA PERSIS dengan `original` saat pratinjau
-- (bila sudah diedit/dimigrasi, dilewati) → aman diulang & dilanjutkan.
create or replace function public.apply_explanation_migration(p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run uuid := gen_random_uuid();
  v_item jsonb;
  v_qid uuid;
  v_label text;
  v_orig text;
  v_new text;
  v_count integer;
  v_applied integer := 0;
  v_skipped integer := 0;
begin
  if not public.is_owner() then
    raise exception 'Hanya Owner yang dapat menjalankan migrasi pembahasan.';
  end if;
  if jsonb_typeof(p_changes) <> 'array' then
    raise exception 'Format perubahan tidak valid.';
  end if;

  for v_item in select * from jsonb_array_elements(p_changes) loop
    v_qid := (v_item ->> 'question_id')::uuid;
    v_label := nullif(v_item ->> 'answer_label', '');
    v_orig := v_item ->> 'original';
    v_new := v_item ->> 'migrated';

    if v_new is null or v_orig is null or v_new = v_orig
       or v_new !~ '\[\[pilihan:[A-D]\]\]' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if v_label is null then
      update public.questions set explanation = v_new
      where id = v_qid and explanation = v_orig;
    else
      update public.question_answers set explanation = v_new
      where question_id = v_qid and label::text = v_label and explanation = v_orig;
    end if;
    get diagnostics v_count = row_count;

    if v_count > 0 then
      insert into public.explanation_migration_backups
        (run_id, question_id, answer_label, original_text, migrated_text, applied_by)
      values (v_run, v_qid, v_label, v_orig, v_new, auth.uid());
      v_applied := v_applied + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;

  return jsonb_build_object('run_id', v_run, 'applied', v_applied, 'skipped', v_skipped);
end;
$$;

revoke all on function public.apply_explanation_migration(jsonb) from public;
grant execute on function public.apply_explanation_migration(jsonb) to authenticated;

create or replace function public.restore_explanation_migration(p_run_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
  v_count integer;
  v_restored integer := 0;
begin
  if not public.is_owner() then
    raise exception 'Hanya Owner yang dapat memulihkan pembahasan.';
  end if;
  for b in
    select * from public.explanation_migration_backups
    where run_id = p_run_id and restored_at is null
  loop
    if b.answer_label is null then
      update public.questions set explanation = b.original_text
      where id = b.question_id and explanation = b.migrated_text;
    else
      update public.question_answers set explanation = b.original_text
      where question_id = b.question_id and label::text = b.answer_label
        and explanation = b.migrated_text;
    end if;
    get diagnostics v_count = row_count;
    if v_count > 0 then
      update public.explanation_migration_backups set restored_at = now() where id = b.id;
      v_restored := v_restored + 1;
    end if;
  end loop;
  return v_restored;
end;
$$;

revoke all on function public.restore_explanation_migration(uuid) from public;
grant execute on function public.restore_explanation_migration(uuid) to authenticated;

commit;

-- ROLLBACK:
-- drop function if exists public.apply_explanation_migration(jsonb);
-- drop function if exists public.restore_explanation_migration(uuid);
-- drop table if exists public.explanation_migration_backups;
