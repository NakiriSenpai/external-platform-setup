# Perbaikan Integrasi Safe Area Bottom Navigation

## Implementasi
- Ubah Bottom Navigation menjadi dua lapisan eksplisit: outer shell `fixed bottom-0` dengan background aplikasi solid, lalu navigation surface existing tanpa perubahan desain.
- Letakkan spacer `env(safe-area-inset-bottom)` sebagai child outer shell dengan background yang sama, bukan sebagai area transparan atau margin di luar surface.
- Hapus offset/margin vertikal ekstra pada card yang membuatnya tampak terlalu tinggi, sambil mempertahankan ukuran, rounded corner, glow, ikon, state aktif, dan lima item.
- Pertahankan padding konten sebesar tinggi navigation surface ditambah satu safe-area saja agar konten terakhir tidak tertutup tanpa double count.
- Sinkronkan warna PWA manifest dengan background aplikasi untuk mengurangi strip warna berbeda pada system navigation area; tidak mengubah TWA, Digital Asset Links, package ID, signing, atau aset Android.

## Verifikasi
- Jalankan typecheck dan production build.
- Verifikasi layout portrait 390px, fixed position, scrolling, overflow, dan lima target navigasi di preview.
- Laporkan Cloudflare deploy, commit/origin status, dan Android device verification secara faktual; pengujian perangkat nyata akan dinyatakan UNVERIFIED bila tidak tersedia dari environment ini.

## Batasan
- Tidak menyentuh auth, database, migration, RLS, notification, exam, lesson, profile, tenant, Cloudinary, atau pembuatan APK.
