# Quran Community

Platform komunitas Al-Qur'an bergaya Substack: penulis (ustadz, penghafal, pengajar, pelajar) membuat **publikasi** sendiri, menulis artikel tadabbur, tafsir ringkas, catatan hafalan, atau kajian, lalu pembaca **berlangganan** dan menerima tulisan baru lewat web dan email.

---

## 1. Tujuan

- Tempat menulis yang tenang dan fokus untuk konten Al-Qur'an, tanpa gangguan iklan.
- Setiap penulis punya halaman publikasi sendiri (`/@nama`) dan daftar pelanggan sendiri.
- Pembaca bisa mengikuti penulis, berkomentar, menyukai, dan berdiskusi.

## 2. Fitur (dibandingkan dengan Substack)

| Substack                    | Versi kita                                             |
| --------------------------- | ------------------------------------------------------ |
| Publication                 | Publikasi per penulis / majelis / lembaga              |
| Post                        | Artikel: tadabbur, tafsir, kajian, catatan hafalan     |
| Newsletter email            | Email tulisan baru ke pelanggan                        |
| Subscribe (gratis/berbayar) | Berlangganan gratis dulu; dukungan/infaq di fase akhir |
| Notes                       | **Catatan**: tulisan pendek, renungan singkat          |
| Comments, likes             | Komentar berutas, suka, simpan                         |
| Recommendations             | Penulis merekomendasikan publikasi lain                |
| Discover                    | Jelajah per kategori dan tag                           |

Fokus aplikasi ada di **platform** (publikasi, menulis, berlangganan, komunitas). Tidak ada database ayat bawaan; jika penulis mengutip ayat, ia menuliskannya sendiri di editor.

- Kategori: Tadabbur, Tafsir, Tajwid, Hafalan, Kajian, Kisah, ditambah tag bebas.
- Moderasi konten (laporan, peninjauan admin), karena konten agama butuh kehati-hatian.

## 3. Stack

| Bagian    | Pilihan                                                                      |
| --------- | ---------------------------------------------------------------------------- |
| Framework | **Next.js** (App Router, TypeScript)                                         |
| Deploy    | **Cloudflare Workers** lewat `@opennextjs/cloudflare`                        |
| Database  | **Cloudflare D1** (SQLite)                                                   |
| ORM       | **Drizzle ORM** + `drizzle-kit` untuk migrasi                                |
| Auth      | **Better Auth** (email + Google), sesi disimpan di D1                        |
| Gambar    | **Cloudflare R2** (cover artikel, avatar)                                    |
| Email     | Resend (atau penyedia lain) via `fetch`, antrean pakai **Cloudflare Queues** |
| Editor    | Tiptap (rich text)                                                           |
| Styling   | Tailwind CSS                                                                 |
| Validasi  | Zod                                                                          |

Alasan: semuanya berjalan di Cloudflare (satu tagihan, satu dashboard) dan D1 cukup untuk skala komunitas.

## 4. Model data (rancangan awal)

```
users            id, name, email, image, username, bio, role (user|admin), created_at
sessions/accounts/verifications   (tabel Better Auth)

publications     id, owner_id → users, slug, name, tagline, description, logo_url, created_at
publication_members  publication_id, user_id, role (owner|editor|writer)

posts            id, publication_id, author_id, slug, title, subtitle, cover_url,
                 content_json, content_html, category, status (draft|published|archived),
                 published_at, created_at, updated_at
tags             id, slug, name
post_tags        post_id, tag_id

notes            id, author_id, body, created_at   -- "Catatan" pendek

subscriptions    id, publication_id, user_id (nullable), email, status, created_at
follows          follower_id, following_user_id

comments         id, post_id, user_id, parent_id, body, created_at, deleted_at
likes            user_id, target_type (post|note|comment), target_id
bookmarks        user_id, post_id

recommendations  publication_id, recommended_publication_id
reports          id, reporter_id, target_type, target_id, reason, status
```

## 5. Struktur folder (rencana)

```
quran-community/
├─ src/
│  ├─ app/
│  │  ├─ (public)/            beranda, discover, /@[slug], /@[slug]/p/[post]
│  │  ├─ dashboard/           area penulis: tulisan, pelanggan, pengaturan
│  │  ├─ admin/               moderasi
│  │  └─ api/                 route handler (auth, upload, webhook)
│  ├─ components/             UI + editor
│  ├─ db/
│  │  ├─ schema.ts            skema Drizzle
│  │  └─ index.ts             getDb() dari binding D1
│  ├─ lib/                    auth, email, r2, validasi
│  └─ server/                 server actions per fitur
├─ drizzle/                   file migrasi SQL
├─ wrangler.jsonc
├─ open-next.config.ts
└─ PROGRES.md                 catatan progres per fitur
```

## 6. Menjalankan

```bash
npm install
npm install-scripts approve esbuild workerd      # npm 11: izinkan postinstall binary
npm run db:migrate:local                         # terapkan migrasi ke D1 lokal
npm run dev                                      # http://localhost:3000, cek /api/health
```

Perintah lain:

```bash
npx wrangler d1 create quran-community-db        # sekali sebelum deploy, salin id ke wrangler.jsonc
npx wrangler r2 bucket create quran-community-media
npx wrangler queues create quran-community-email
npm run db:generate                              # buat migrasi baru dari schema.ts
npm run db:migrate:remote                        # terapkan migrasi ke D1 produksi
npm run preview                                  # uji di runtime Workers lokal
npm run deploy                                   # build + deploy ke Cloudflare
```

Variabel lingkungan (`.dev.vars` lokal, `wrangler secret put` di produksi):

```
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=        # kosong = email hanya dicetak ke log
EMAIL_FROM=
APP_URL=               # URL publik, untuk tautan di email
```

Menjadikan akun sebagai admin:

```bash
npx wrangler d1 execute quran-community-db --remote --command "UPDATE users SET role='admin' WHERE email='EMAIL_ANDA'"
```
