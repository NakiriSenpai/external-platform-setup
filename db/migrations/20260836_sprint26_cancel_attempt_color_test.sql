-- =====================================================================
-- SPRINT 26 — CANCEL EXAM ATTEMPT DARI COLOR TEST
-- ---------------------------------------------------------------------
-- Color Test adalah tahap WAJIB setelah submit ujian. Bila user keluar
-- paksa dari Color Test, attempt ujian induk harus dianggap TIDAK PERNAH
-- SELESAI: tidak muncul di riwayat, hasil, statistik, maupun leaderboard.
--
-- Satu RPC transactional (fungsi plpgsql = satu transaksi):
--   cancel_exam_attempt_with_color_test(p_attempt_id uuid)
--
-- Keamanan:
-- - hanya pemilik attempt (auth.uid()) yang dapat membatalkan
-- - attempt milik user lain TIDAK dapat dibatalkan
-- - Color Test session yang dihapus hanya milik attempt tersebut
-- - snapshot yang dihapus adalah snapshot per-attempt (1:1), bukan bank
--   soal global; exam/questions/color_test_questions tidak tersentuh
-- =====================================================================

create or replace function public.cancel_exam_attempt_with_color_test(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_status public.exam_attempt_status;
begin
  select user_id, status into v_owner, v_status
  from public.exam_attempts
  where id = p_attempt_id
  for update;

  if v_owner is null then
    raise exception 'Attempt tidak ditemukan.';
  end if;

  if v_owner <> auth.uid() then
    raise exception 'Anda tidak berhak membatalkan attempt ini.';
  end if;

  if v_status = 'cancelled' then
    return;
  end if;

  -- Attempt hanya dapat dibatalkan lewat jalur ini bila Color Test-nya
  -- memang masih berjalan (belum dinilai).
  if not exists (
    select 1 from public.color_test_sessions s
    where s.exam_attempt_id = p_attempt_id
      and s.user_id = v_owner
      and s.status = 'in_progress'
  ) then
    raise exception 'Attempt ini tidak berada pada tahap tes buta warna yang dapat dibatalkan.';
  end if;

  -- color_test_sessions & color_test_session_questions ikut terhapus
  -- lewat FK ON DELETE CASCADE milik exam_attempts.
  delete from public.exam_attempt_answers where attempt_id = p_attempt_id;
  delete from public.exam_attempt_snapshots where attempt_id = p_attempt_id;
  delete from public.exam_attempt_results where attempt_id = p_attempt_id;
  delete from public.exam_attempts where id = p_attempt_id;
end;
$$;

revoke all on function public.cancel_exam_attempt_with_color_test(uuid) from public;
grant execute on function public.cancel_exam_attempt_with_color_test(uuid) to authenticated;
