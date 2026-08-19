# Redesign Halaman Analitik Guru / Platform Analytics

## Hasil Audit (existing)

- Halaman: `TeacherAnalyticsDashboard` dipakai oleh 2 route (`/teacher_/analytics` untuk staf, `/admin_/analytics` untuk admin). 5 komponen, ~720 baris total.
- Data: 5 RPC dari Sprint 12 (`teacher_analytics_overview`, `teacher_exam_analytics`, `teacher_student_analytics`, `teacher_student_detail`, `teacher_exam_detail`), semuanya `security definer` + `analytics_require_staff(p_tenant_id)` → tenant isolation sudah benar dan akan dipertahankan.
- Sumber nilai: `exam_attempt_results` (hasil beku per attempt). Snapshot, scoring, timer, review tidak perlu disentuh sama sekali.

### 3 gap utama vs permintaan

1. **Semantics salah.** Semua RPC sekarang memakai *semua* attempt untuk rata-rata nilai & kelulusan. Permintaan: nilai/kelulusan = **first completed attempt per siswa per exam**, sedangkan total attempt = **semua completed attempt**.
2. **Filter tanggal cuma preset** (`7/30/90/all`), belum date-range nyata. Belum ada filter siswa aktif/nonaktif untuk analytics.
3. **Attendance belum ada sama sekali.** Tidak ada tabel attendance; yang ada hanya `profiles.last_login_at`. Jadi tab Attendance butuh tabel baru + pencatatan sesi dari aplikasi (tidak ada "sistem attendance existing" yang bisa di-reuse).

## Rencana Implementasi

### Migration baru: `db/migrations/20260838_sprint28_teacher_analytics.sql`

Tanpa mengubah/menghapus tabel existing:

- `profiles.analytics_excluded boolean not null default false` — status aktif/nonaktif siswa untuk perhitungan analitik (persistent, hanya bisa diubah staf dalam tenant sendiri). Tidak memakai `is_active` supaya tidak merusak login/user management.
- Tabel baru `student_activity_sessions` (user_id, tenant_id, day, first_seen_at, last_seen_at, duration_seconds) + RPC heartbeat `record_student_activity()` yang dipanggil app saat foreground. RLS: siswa hanya menulis miliknya, staf hanya membaca tenant-nya.
- RPC baru (versi date-range + first-attempt semantics), semua lewat `analytics_require_staff`:
  - `analytics_overview_v2(p_from, p_to, p_exam_id, p_student_ids)` → total_students, total_attempts (all), average_score & pass_rate (first-attempt), total benar/salah/kosong.
  - `analytics_daily_trend(...)` → per hari: attempts (all), avg score & pass rate (first-attempt).
  - `analytics_exam_performance(...)` → per set ujian: attempts (all) + avg/pass (first-attempt).
  - `analytics_student_rows(...)` → paginated + search: avg/pass first-attempt, total attempt all.
  - `analytics_student_attempts(p_student_id, ...)` → seluruh attempt per set ujian + flag `is_first`, untuk tabel Riwayat Attempt.
  - `analytics_score_matrix(...)` → data Tabel Nilai (siswa × set ujian, nilai first-attempt) untuk render + export.
  - `analytics_question_stats(p_exam_id, ...)` → per nomor soal: %benar, %salah, tidak dijawab, distribusi pilihan A–D, kunci jawaban (dari snapshot attempt yang dipakai).
  - `analytics_attendance(...)` → ringkasan + per hari + per siswa dari `student_activity_sessions`.

RPC Sprint 12 lama tetap ada (dipakai dashboard guru & lesson analytics), tidak dihapus.

### Frontend

Struktur baru `src/features/teacher-analytics/`:

- `analytics-page.tsx` — header + tab (Ringkasan / Siswa / Tabel Nilai / Analisis / Attendance), tab horizontal-scroll di mobile.
- `filters/` — context filter global (exam, date range, siswa) yang dibagi ke semua tab, disimpan di URL search params.
- `tabs/ringkasan.tsx` — line chart perkembangan harian (metric switch: nilai / kelulusan / jumlah attempt), kartu ringkasan, performa per set ujian, daftar siswa ringkas.
- `tabs/siswa.tsx` — Kelola Siswa (checkbox aktif/nonaktif + Aktifkan/Nonaktifkan Semua, persistent), detail siswa, performa per set, Riwayat Attempt per set dengan tombol Review → `/ujian/review/$attemptId` memakai attemptId baris tersebut.
- `tabs/tabel-nilai.tsx` — matriks nilai first-attempt + Export Excel / PDF mengikuti filter aktif.
- `tabs/analisis.tsx` — ringkasan, chart per nomor soal, distribusi jawaban, dan "Insight Pintar" deterministik (soal tersulit/termudah, pengecoh dominan, set dengan kelulusan terendah, siswa naik/turun) — insight hanya dirender bila data cukup.
- `tabs/attendance.tsx` — ringkasan, chart harian, tabel siswa (card di mobile).
- `components/` — komponen reusable: `StatTile`, `SectionCard`, `TrendChart`, `ScrollRow`, `DataTable` (auto jadi card di mobile), `FilterBar`, `EmptyState`, `ErrorState` + tombol Coba lagi, skeleton.

Warna memakai token semantik existing (accent ungu, hijau lulus, merah gagal, oranye warning) — ditambahkan ke `src/styles.css` bila token-nya belum ada. Recharts sudah tersedia di project untuk chart.

Export: Excel via SheetJS/CSV dan PDF via jsPDF (di-install bila belum ada), sumber data dari RPC teragregasi, bukan looping per siswa.

Halaman existing tidak dihapus sampai tab baru selesai; dashboard guru/admin tetap menunjuk ke halaman baru di akhir.

## Catatan penting

- Attendance akan mulai terisi setelah migration dijalankan dan siswa membuka aplikasi; data historis sebelum itu tidak ada (tidak akan diisi dummy).
- Tidak ada dummy data di mana pun; section tanpa data menampilkan empty state.
- Migration harus dijalankan manual di Supabase external sebelum halaman baru berfungsi penuh.
