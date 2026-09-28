# Journal Accreditation Evaluator — Portable Edition

Aplikasi evaluasi diri jurnal dengan **HTML + JavaScript biasa, Tailwind CSS terkompilasi, Node.js 24+, dan SQLite**. Tidak membutuhkan React, layanan Sites, atau database cloud. Antarmuka dan rekomendasi utama menggunakan Bahasa Indonesia.

Paket ini merupakan implementasi baru untuk dihosting sendiri. Situs lama tidak diubah. Data dan akun pada situs lama tidak otomatis berpindah; impor JSON hanya menerima format ekspor aplikasi versi ini.

## Mulai dalam beberapa langkah

1. Instal **Node.js 24 LTS atau versi lebih baru yang mendukung `node:sqlite`**.
2. Ekstrak ZIP dan buka terminal pada folder `journal-accreditation-evaluator`.
3. Salin konfigurasi:

   ```bash
   cp .env.example .env
   ```

   Windows Command Prompt: `copy .env.example .env`. PowerShell: `Copy-Item .env.example .env`.

4. Buat akun pertama:

   ```bash
   npm run create-user
   ```

   Isi nama, email, dan kata sandi minimal 12 karakter. Input kata sandi disembunyikan. Tidak ada akun atau kata sandi bawaan. Jalankan perintah dari terminal interaktif.

5. Jalankan:

   ```bash
   npm start
   ```

6. Buka **http://localhost:3000**, masuk, lalu pilih **Evaluasi baru**.

CSS sudah dibangun. **Tidak perlu `npm install` untuk menjalankan aplikasi.** Jangan membuka `public/index.html` dengan klik ganda: login, penyimpanan, dan AI memerlukan server HTTP. Hosting yang hanya menyajikan berkas HTML tidak cukup untuk fitur tersebut.

## Apa yang tersedia

- Login, logout, ubah kata sandi, dan akun yang dibuat administrator. Pendaftaran publik dapat diaktifkan secara sengaja.
- Evaluasi tersimpan per pengguna. Akun lain tidak dapat membaca atau mengubah evaluasi Anda.
- Delapan bagian serta huruf a, b, c mengikuti workbook. Deskripsi dan pilihan skor sumber dipertahankan.
- Skor aktual, kelengkapan, disinsentif, estimasi menurut formula workbook, dan simulasi target.
- Rekomendasi per kriteria dan transisi skor, bukti yang perlu disiapkan, serta pemeriksaan keberhasilan.
- Catatan, bukti berupa teks/URL, impor bukti `.txt`/`.md`, penanggung jawab, tenggat, dan status tindakan.
- Saran AI opsional berdasarkan konteks yang Anda berikan, tanpa otomatis mengubah skor.
- Ekspor/impor JSON dan cetak seluruh hasil melalui **Print → Save as PDF** di browser.
- Perubahan disimpan dengan tombol **Simpan**. Peringatan tampil sebelum meninggalkan perubahan yang belum disimpan.

## Struktur borang

Sumber disertakan sebagai `reference/Borang.xlsx`, salinan workbook yang diberikan pengguna. Hash SHA-256 dan lokasi baris/sel terdapat dalam `public/rubric.json`.

| Bagian | Nama | Kriteria | Maksimum |
|---|---|---:|---:|
| 1 | Konsistensi Identitas Jurnal Ilmiah | 1 | 2 |
| 2 | Tata Kelola dan Keberagaman Jurnal Ilmiah | 5 | 22 |
| 3 | Kelengkapan Laman Jurnal Ilmiah | 4 | 7 |
| 4 | Keberkalaan Penerbitan Jurnal Ilmiah | 2 | 3 |
| 5 | Penyebarluasan Jurnal Ilmiah | 2 | 12 |
| 6 | Mutu Artikel (Substansi) | 9 | 34 |
| 7 | Gaya Penulisan dan Penyuntingan Artikel | 7 | 20 |
| 8 | Disinsentif | 2 | 0; pengurang hingga −23 |

Jumlah: **32 kriteria, 114 opsi asli, maksimum positif 100**. Dua opsi nol ditambahkan untuk mencatat “tidak ada disinsentif yang teridentifikasi setelah verifikasi”. Keduanya ditandai sebagai opsi aplikasi, bukan teks asli workbook. Kriteria positif yang tidak menyediakan skor nol tetap tidak diberi opsi nol tambahan.

**Belum dinilai bukan nol.** Estimasi peringkat baru ditampilkan setelah 32 kriteria terisi, termasuk disinsentif. Formula mengikuti D159: ≥90 SINTA 1, ≥80 SINTA 2, ≥70 SINTA 3, ≥60 SINTA 4, dan <60 “Tidak Terakreditasi (model borang)”. Ini mereproduksi workbook, bukan verifikasi aturan nasional terkini, kelayakan pengajuan, atau keputusan asesor.

Target awal adalah skor berikutnya yang lebih tinggi; pengguna dapat memilih target lain atau mempertahankan skor sekarang. Potensi merupakan selisih target dan skor aktual. Menandai tugas “Bukti diverifikasi” tidak otomatis mengubah skor atau menghapus penalti. Prioritas aplikasi: tinggi untuk disinsentif atau kenaikan ≥3; sedang untuk kenaikan ≥1; rendah untuk kenaikan <1.

### Contoh abstrak yang diminta

**Kriteria 6b: Abstrak** — Prioritas sedang, skor 2 → 3, potensi +1.

Tindakan mencakup pemangkasan pengulangan, abstrak Bahasa Inggris maksimal 250 kata, urutan **background, purpose, method, result, implication, conclusion**, hasil utama yang konkret, serta penyuntingan bahasa. Batas kata dapat diubah di profil jurnal. Aplikasi menyebutkannya sebagai **rekomendasi editorial**, karena workbook hanya mensyaratkan kejelasan dan keringkasan, tanpa angka 250 atau struktur enam unsur.

Workbook juga tidak merinci sembilan unsur kelengkapan galley dan rentang tahun untuk rujukan “mutakhir”. Aplikasi meminta verifikasi pedoman pendamping dan tidak mengarang kedua rincian tersebut.

## Aktivasi AI

### 1. Siapkan proyek API

Buka [OpenAI Platform](https://platform.openai.com/api-keys), buat API key untuk proyek Anda, dan pastikan billing/kuota serta akses model tersedia. Simpan key sebagai rahasia server. Tidak ada key yang disertakan pada paket.

### 2. Isi `.env`

```dotenv
OPENAI_API_KEY=isi_api_key_anda_di_server
OPENAI_MODEL=gpt-4.1-mini
AI_DAILY_LIMIT=20
```

Model di atas adalah contoh konfigurasi yang mendukung Responses API dan Structured Outputs. Anda dapat menggantinya dengan model yang kompatibel dan tersedia pada proyek. Periksa akses dan biaya aktual pada akun API. Model tidak dikunci pada frontend.

**Jangan menaruh API key pada HTML, `public/app.js`, `localStorage`, atau repositori publik.** Server memanggil `https://api.openai.com/v1/responses`. Endpoint dikunci ke OpenAI; tidak ada pengiriman key ke URL yang dimasukkan pengguna.

### 3. Restart dan coba

Restart aplikasi, buka **Panduan & aktivasi AI**, lalu periksa status konfigurasi. Status “AI tersedia” berarti key telah dikonfigurasi, bukan bukti koneksi telah berhasil.

Buat atau buka evaluasi. Pada **6b Abstrak**, pilih skor 2 dan target 3. Isi catatan, misalnya “Abstrak 320 kata, metode belum disebutkan, hasil hanya bersifat umum”, lalu tempel abstrak yang sudah dipublikasikan atau kutipan yang boleh dibagikan. Simpan dan buka **Rencana perbaikan → Personalisasi dengan AI**. Tinjau ringkasan data dan konfirmasi pengiriman. Jawaban akan berisi langkah spesifik, verifikasi, bukti yang kurang, keterbatasan, model, dan tanggal.

### Ruang lingkup AI

- Masukan: nama/profil jurnal, satu kriteria, kondisi, target, rekomendasi dasar, catatan, dan bukti teks pada kriteria itu.
- Tidak membuka URL, tidak melakukan crawling, dan tidak mengekstrak PDF/DOCX. URL disimpan sebagai referensi yang belum diverifikasi. Gunakan teks kutipan atau `.txt`/`.md`.
- Tidak menjalankan peer review naskah rahasia. Kriteria kebijakan AI di borang tetap mempertahankan larangan penggunaan AI oleh mitra bestari yang tertulis pada sumber.
- Pengiriman harus dikonfirmasi. Gunakan hanya data yang berwenang Anda bagikan.
- Permintaan memakai `store:false`. Ini bukan jaminan zero retention; tata kelola data tetap mengikuti kebijakan penyedia dan konfigurasi akun Anda.
- Skor tidak diubah AI. Hasil harus ditinjau. Perubahan sumber masukan menyembunyikan hasil AI yang sudah tidak sesuai.
- Batas bawaan 20 permintaan yang dimulai per akun per hari UTC dan 4 per menit. Percobaan gagal tetap dihitung. Timeout layanan 60 detik. Konfigurasi ini membantu membatasi pemakaian tetapi bukan batas biaya global; atur juga kontrol proyek API.
- Tanpa key atau ketika layanan gagal, rekomendasi dasar tetap tersedia.

### Pemecahan masalah

| Pesan | Yang perlu diperiksa |
|---|---|
| AI belum diaktifkan | `.env` ada di direktori kerja; `OPENAI_API_KEY` terisi; aplikasi telah direstart. |
| API key belum valid | Key masih aktif dan berasal dari proyek yang sesuai. |
| Kuota / rate limit | Billing, kuota, atau batas permintaan proyek API. |
| Model tidak tersedia | Akses proyek serta ejaan `OPENAI_MODEL`; pilih model Responses + Structured Outputs. |
| Tidak terjangkau / timeout | Akses HTTPS keluar dari server ke `api.openai.com:443`; ringkas bukti jika perlu. |
| Asal permintaan tidak valid | Buka alamat yang persis sesuai `APP_ORIGIN`, termasuk skema dan port. |
| Data berubah saat AI memproses | Simpan data terbaru, lalu ulangi pada versi tersebut. |

Integrasi memakai format JSON terstruktur dan penanganan refusal/incomplete/error. Pengujian paket tidak menggunakan API key nyata atau permintaan AI berbayar; uji koneksi langsung setelah konfigurasi Anda.

## Hosting mandiri

### Pilihan A — Server / hosting dengan Node.js

Gunakan layanan yang menyediakan proses Node.js berjalan terus dan **disk persisten**. Aplikasi dirancang untuk satu instance dengan SQLite lokal. Jangan menjalankannya pada beberapa replika dengan salinan database berbeda atau filesystem sementara.

1. Unggah direktori aplikasi ke lokasi privat server, bukan seluruhnya ke document root publik.
2. Siapkan Node.js 24+; CSS sudah tersedia.
3. Buat `.env` pada server:

   ```dotenv
   NODE_ENV=production
   HOST=127.0.0.1
   PORT=3000
   APP_ORIGIN=https://journal-evaluator.example.org
   DATA_DIR=/path/to/persistent/journal-data
   ALLOW_REGISTRATION=false
   OPENAI_API_KEY=
   OPENAI_MODEL=gpt-4.1-mini
   AI_DAILY_LIMIT=20
   ```

4. Buat akun melalui `npm run create-user` dengan direktori kerja dan `DATA_DIR` yang sama dengan aplikasi.
5. Jalankan `npm start` sebagai layanan yang otomatis restart. Pada panel hosting, gunakan `server.mjs` sebagai entrypoint bila panel mendukung ES modules dan Node 24; definisikan variabel lingkungan lewat panel apabila `.env` tidak dimuat oleh launcher panel.
6. Arahkan reverse proxy HTTPS ke `127.0.0.1:3000`. Contoh Nginx disertakan pada `docs/nginx.conf.example`; sertifikat dan domain harus Anda siapkan. Jika hosting mengharuskan bind semua interface, atur `HOST=0.0.0.0` di lingkungan privatnya.
7. Buka alamat persis seperti `APP_ORIGIN`, uji login, simpan evaluasi, keluar, lalu masuk kembali untuk memeriksa persistensi.

Production menolak origin non-HTTPS. Cookie sesi menggunakan Secure, HttpOnly, SameSite=Strict, dan awalan `__Host-`. Jangan mematikan mode production untuk memperbaiki masalah sertifikat.

### Pilihan B — Docker

Dockerfile menggunakan Node 24 dan pengguna non-root. Konfigurasikan `.env` dengan `APP_ORIGIN=https://domain-anda`, lalu:

```bash
docker compose up -d --build
docker compose exec evaluator npm run create-user
```

Volume `journal-data` menyimpan SQLite. Port diterbitkan hanya ke `127.0.0.1:3000`; siapkan reverse proxy HTTPS di host. Jangan menjalankan `docker compose down -v` kecuali memang ingin menghapus data. Docker/reverse proxy tidak dijalankan sebagai bagian dari pengujian paket ini.

### Pengelolaan akun

Pendaftaran publik ditutup secara bawaan. Buat akun tambahan dengan `npm run create-user`. Untuk membuka pendaftaran secara sengaja, set `ALLOW_REGISTRATION=true` dan restart. Pendaftaran ini tidak memiliki verifikasi email, SSO, MFA, atau undangan; jangan membuka pendaftaran jika aplikasi hanya untuk tim internal.

Pengguna dapat mengganti kata sandi setelah login. Untuk pengguna yang lupa kata sandi, administrator menjalankan:

```bash
npm run create-user -- --reset
```

Masukkan email yang sama. Reset mencabut sesi lama. Tidak ada pemulihan melalui email otomatis. Proteksi percobaan login menggunakan alamat koneksi server dan email; pada reverse proxy, pembatasan per alamat dapat berlaku bersama untuk pengguna di balik proxy. Sesuaikan deployment untuk beban yang lebih besar.

### Backup dan pemulihan

```bash
npm run backup
```

Perintah membuat snapshot SQLite konsisten dalam `backups/`, termasuk data akun dan evaluasi. Salin backup ke lokasi aman di luar server. Untuk Docker, jalankan perintah di container dan salin snapshot keluar sebelum container diganti.

Untuk pemulihan: hentikan aplikasi, simpan salinan database saat ini, ganti `DATA_DIR/evaluator.sqlite` dengan backup yang benar, singkirkan berkas WAL/SHM lama **hanya ketika proses berhenti**, lalu jalankan kembali. Lindungi backup seperti data pengguna. Ekspor JSON hanya mencadangkan satu evaluasi tanpa akun dan tanpa saran AI.

## Menyesuaikan tampilan atau logika

| Berkas | Fungsi |
|---|---|
| `public/index.html` | Dokumen HTML dan metadata |
| `public/app.js` | Antarmuka, formulir, navigasi, impor/ekspor, dan laporan cetak |
| `src/styles.css` | Sumber Tailwind dan komponen visual |
| `public/styles.css` | CSS terkompilasi untuk hosting; tanpa CDN |
| `public/rubric.json` | Rubrik, opsi skor, sumber sel, hash, dan versi |
| `public/engine.js` | Kalkulasi serta 32 kelompok rekomendasi per kriteria |
| `server.mjs` | HTTP, login, sesi, kontrol akses, penyimpanan, dan endpoint AI |
| `src/ai.mjs` | Prompt, skema jawaban, dan pemanggilan OpenAI |
| `src/validation.mjs` | Validasi server atas skor, target, dan isian |
| `scripts/extract-rubric.py` | Ekstraksi read-only workbook; Python standard library |

Untuk mengubah styling:

```bash
npm ci
npm run build:css
npm test
```

Paket Tailwind hanya dependency pengembangan. Lockfile disertakan. Sumber CSS memindai kelas di `public/*.html` dan `public/*.js`. Browser modern diperlukan untuk Tailwind 4.

Untuk mengganti versi borang, ekstrak lalu **tinjau ulang** semua ID, skor, formula, rekomendasi, dan tes; jangan menganggap workbook baru mempunyai struktur sama. Script ekstraksi saat ini khusus untuk tata letak workbook yang disertakan. Perubahan semantik rubrik harus memakai versi baru dan strategi migrasi evaluasi yang disengaja.

## Keamanan dan batasan implementasi

Kata sandi di-hash dengan scrypt dan salt acak; token sesi disimpan dalam bentuk hash. Semua operasi evaluasi dibatasi pada pemilik. Validasi origin dan CSRF diterapkan pada operasi perubahan; skor tidak dipercaya dari klien. SQL menggunakan parameter terikat, isian pengguna di-escape saat ditampilkan, CSP membatasi skrip dan sumber koneksi. Berkas `.env`, SQLite, dan source server tidak disajikan melalui HTTP. Konflik revisi antar tab ditolak agar perubahan tidak tertimpa diam-diam.

Aplikasi cocok sebagai dasar hosting mandiri untuk tim kecil dengan satu proses/instance. Penskalaan, SSO/MFA, email verification, pemulihan email, unggahan PDF/DOCX, crawling website, dan migrasi otomatis data situs lama tidak termasuk. Ketersediaan halaman publik tidak membuktikan akun telah diautentikasi; API selalu memeriksa sesi. Ini bukan audit keamanan independen.

## Rujukan implementasi

Diakses 28 September 2026:

- [Tailwind CLI](https://tailwindcss.com/docs/installation/tailwind-cli)
- [Node.js SQLite](https://nodejs.org/api/sqlite.html)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
- [OpenAI production best practices](https://developers.openai.com/api/docs/guides/production-best-practices)

Rubrik penilaian bersumber dari workbook pengguna, bukan dari halaman dokumentasi teknis di atas.
