# LPK Foundation Studio

# SPRINT 0 — PROJECT FOUNDATION (FINAL)



Project ini adalah LMS Multi-Tenant Production yang akan digunakan oleh LPK sendiri dan juga dijual ke LPK lain.



Sprint ini HANYA membangun fondasi project.



Jangan mengerjakan Sprint 1.



==================================================

TUJUAN

==================================================



Membangun fondasi project yang stabil, production-ready, mengikuti arsitektur resmi Loveable sehingga tidak memerlukan workaround maupun modifikasi build di kemudian hari.



Semua keputusan arsitektur pada Sprint 0 dianggap FINAL.



==================================================

TECH STACK (WAJIB)

==================================================



Framework



- React 19

- TypeScript

- Vite 7

- TanStack Start (default Loveable)

- TanStack Router

- TanStack Query



UI



- TailwindCSS

- shadcn/ui

- Lucide Icons



Backend



Supabase (External)



URL



https://ihcxyatlhgmyhiecghcn.supabase.co



Publishable Key



sb_publishable_OeVYFm-H9QhiRBrB-wTAbw_TfqmUya1



Media



Cloudinary (External)



Cloud Name



iwcvk9dw



Upload Preset



aquilacafe_upload



Deployment



Cloudflare



Source Code



GitHub Repository



==================================================

ARSITEKTUR

==================================================



Gunakan arsitektur resmi Loveable.



Jangan mencoba mengubah:



- TanStack Start

- TanStack Router

- Build Pipeline

- Runtime

- Deployment Pipeline bawaan



Jika ada konfigurasi resmi Loveable, gunakan konfigurasi tersebut.



Jangan membuat workaround.



==================================================

PWA

==================================================



Aktifkan PWA menggunakan konfigurasi resmi yang kompatibel dengan Loveable.



Harus mendukung:



✓ Install Android



✓ Install iOS



✓ Offline Cache



✓ Manifest



✓ Service Worker



==================================================

SUPABASE

==================================================



Hubungkan Supabase External.



Siapkan folder yang rapi.



Contoh



lib/



services/



hooks/



types/



auth/



Jangan membuat database schema.



Belum ada authentication.



Hanya koneksi.



==================================================

CLOUDINARY

==================================================



Hubungkan Cloudinary External.



Buat helper upload.



Belum digunakan.



==================================================

ROUTING

==================================================



Siapkan route kosong berikut.



/



login



dashboard



ujian



materi



leaderboard



profile



teacher



admin



owner



tenant



exam-studio



lesson-studio



Belum ada isi.



==================================================

THEME

==================================================



Siapkan Theme System.



Dark



Light



Menggunakan localStorage.



==================================================

UI

==================================================



Seluruh UI menggunakan Bahasa Indonesia.



Mobile First.



Touch Friendly.



Responsive.



Target performa minimal 60 FPS.



==================================================

PROJECT STRUCTURE

==================================================



Rapikan struktur project.



Pisahkan:



components/



features/



hooks/



lib/



services/



types/



contexts/



layouts/



routes/



assets/



styles/



utils/



Project harus mudah dikembangkan sampai puluhan fitur.



==================================================

QUALITY

==================================================



Konfigurasi:



ESLint



Prettier



TypeScript Strict



Alias Path



Error Boundary



Not Found



Loading



==================================================

GITHUB

==================================================



Hubungkan project dengan GitHub.



Semua perubahan Sprint harus di-commit.



Jangan membuat branch baru.



Gunakan branch utama project.



==================================================

CLOUDFLARE

==================================================



Pastikan project dapat dipublish menggunakan pipeline resmi Loveable ke Cloudflare.



Jangan membuat workflow deployment alternatif.



==================================================

YANG DILARANG

==================================================



❌ Authentication



❌ CRUD



❌ Dashboard



❌ Database Schema



❌ User Management



❌ Exam



❌ Lesson



❌ Leaderboard



❌ Tenant



❌ Sprint 1



❌ Workaround Build



❌ Mengubah arsitektur Loveable



==================================================

ACCEPTANCE TEST

==================================================



Semua wajib lolos.



✓ Project berhasil dijalankan.



✓ Tidak ada error build.



✓ Tidak ada error TypeScript.



✓ Tidak ada error ESLint.



✓ Supabase berhasil terkoneksi.



✓ Cloudinary berhasil terkoneksi.



✓ PWA aktif.



✓ Theme berjalan.



✓ Routing berjalan.



✓ Mobile responsive.



✓ GitHub berhasil sinkron.



✓ Publish Cloudflare berhasil.



==================================================

SETELAH SELESAI

==================================================



Commit seluruh perubahan ke GitHub.



Pastikan publish Cloudflare berhasil.



Berikan ringkasan:



- Struktur project

- Stack yang digunakan

- Struktur folder

- Konfirmasi Supabase

- Konfirmasi Cloudinary

- Konfirmasi PWA

- Konfirmasi GitHub

- Konfirmasi Publish Cloudflare



Lalu BERHENTI.



Jangan mengerjakan Sprint 1.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/217f8e21-42c2-48b4-94ae-d166ac6197e8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

<!-- Cloudflare build trigger: 2026-08-10 -->
