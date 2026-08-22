# Simplifikasi Total Import Exam JSON

## Tujuan
Mengubah **khusus Import Exam** menjadi alur create-only: setiap file JSON menghasilkan satu Exam baru beserta Section, Question, dan Answer baru. Import berikutnya tidak mencari, memperbarui, atau memakai ulang entity dari import sebelumnya. Import Question Bank dan Lesson tetap memakai perilaku yang ada.

## Perubahan
1. **Pisahkan jalur Exam create-only**
   - Refactor `importExam` agar menerima bundle Exam terbaru dan selalu membuat record baru.
   - Wajib satu Exam per file; bundle tanpa tepat satu Exam ditolak dengan pesan jelas.
   - Generate slug unik (`slug`, `slug-2`, dst.) tanpa mengubah record lama.
   - Buat Questions dari `question_bundle`, Answers untuk Question baru, Sections baru, lalu hubungan Exam–Question menggunakan mapping lokal source key → ID baru.
   - Abaikan seluruh `source_id` database dari JSON; ID database selalu berasal dari hasil insert baru.
   - Tidak melakukan pencarian/upsert/update berdasarkan slug, title, external key, index, atau import sebelumnya.

2. **Sederhanakan UI Import Exam**
   - Hapus conflict selector dan dua toggle terkait bundled/missing questions untuk mode Exam, termasuk option state yang tidak lagi dikirim ke `importExam`.
   - Preview Exam membaca file terbaru dan hanya menampilkan identitas serta jumlah Section/Question.
   - Tombol menjadi **Import Exam**.
   - Gunakan operation immutable `{ operationId: crypto.randomUUID(), fileName, bundle }`; eksekusi hanya membaca snapshot operation tersebut.
   - Reset native file input setelah pembacaan dan ganti seluruh preview/operation saat file baru dipilih.

3. **Pertahankan fitur shared**
   - Conflict handling untuk Question Bank dan Lesson tidak dihapus karena masih dipakai kedua fitur tersebut.
   - Media URL, rich text, related lesson, audit, progress, dan invalidasi daftar Exam tetap dipertahankan.
   - Tidak membuat migration dan tidak mengubah scoring, timer, security, audio, Cloudinary, snapshot, atau TWA.

4. **Kegagalan dan isolasi**
   - Validasi semua referensi Section/Question sebelum write.
   - Jika insert turunan gagal, laporkan import gagal; jangan pernah mengubah Exam lama.
   - Bersihkan entity yang baru dibuat pada operasi gagal sejauh relasi/cascade schema mengizinkan, tanpa menyentuh import sebelumnya.

## Pengujian
- Ganti test conflict lama dengan functional service test create-only memakai database in-memory:
  - `A → B → C` menghasilkan tiga Exam dan konten unik yang tetap utuh.
  - `A → B → A → C → B` menghasilkan lima Exam dengan slug suffix dan Question/Answer baru per operasi.
  - Verifikasi IDs Exam/Section/Question/Answer berbeda dan relasi/correct-answer/order benar.
  - Verifikasi kegagalan import baru tidak mengubah import lama.
- Perluas test dialog tanpa remount/reload:
  - Preview selalu cocok dengan file terbaru.
  - Klik import memakai bundle preview terbaru.
  - Tidak ada lagi lima kontrol conflict/missing/bundled pada mode Exam.
- Jalankan regression test Import Lesson/Question Bank, typecheck, dan production build.
- Jika koneksi database live tersedia, lakukan uji create-only nyata; jika tidak tersedia, laporkan functional live DB sebagai **UNVERIFIED**, terpisah dari test functional in-memory.
