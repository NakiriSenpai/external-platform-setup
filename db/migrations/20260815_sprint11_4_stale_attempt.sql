-- =====================================================================
-- SPRINT 11.4 — STALE ATTEMPT / RESUME CLEANUP
-- Jalankan di Supabase SQL Editor (project eksternal).
-- Idempotent. Prasyarat: migration Sprint 10A & 10B sudah dijalankan.
--
-- TUJUAN:
-- Attempt dengan status in_progress DAN expires_at <= now() (waktu SERVER)
-- tidak boleh lagi dianggap aktif. Attempt seperti ini difinalisasi memakai
-- lifecycle yang sudah ada (public.submit_exam_attempt) — tanpa scoring engine
-- baru, tanpa menghapus attempt/snapshot/result.
-- =====================================================================

-- 1. FINALISASI SATU ATTEMPT BILA SUDAH LEWAT WAKTU -------------------
-- Return: 'active' | 'finished' | 'finalized' | 'missing_snapshot' | 'not_found'
create or replace function public.finalize_attempt_if_stale(p_attempt_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_has_snapshot boolean;
begin
  select * into v_attempt from public.exam_attempts where id = p_attempt_id;
  if not found then
    return 'not_found';
  end if;
  if v_attempt.user_id <> auth.uid() and not public.is_owner() then
    return 'not_found';
  end if;

  if v_attempt.status <> 'in_progress' then
    return 'finished';
  end if;

  -- Waktu SERVER, bukan jam perangkat user.
  if v_attempt.expires_at is null or v_attempt.expires_at > now() then
    return 'active';
  end if;

  select exists (
    select 1 from public.exam_attempt_snapshots where attempt_id = p_attempt_id
  ) into v_has_snapshot;

  if not v_has_snapshot then
    -- Tidak dapat dinilai: tutup attempt agar tidak lagi aktif, data tetap disimpan.
    update public.exam_attempts
    set status = 'expired'::public.exam_attempt_status,
        finished_at = coalesce(finished_at, now()),
        submitted_at = coalesce(submitted_at, now()),
        auto_submitted = true,
        submit_reason = 'time_up'
    where id = p_attempt_id;
    return 'missing_snapshot';
  end if;

  -- Idempotent: submit_exam_attempt mengembalikan result lama bila sudah ada.
  perform public.submit_exam_attempt(p_attempt_id, 'time_up');
  return 'finalized';
end;
$$;

grant execute on function public.finalize_attempt_if_stale(uuid) to authenticated;

-- 2. FINALISASI SELURUH ATTEMPT KADALUARSA MILIK PEMANGGIL ------------
create or replace function public.finalize_my_stale_attempts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  if auth.uid() is null then
    return 0;
  end if;
  for v_id in
    select id from public.exam_attempts
    where user_id = auth.uid()
      and status = 'in_progress'
      and expires_at is not null
      and expires_at <= now()
  loop
    perform public.finalize_attempt_if_stale(v_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.finalize_my_stale_attempts() to authenticated;
