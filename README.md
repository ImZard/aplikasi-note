# Catatanku

Aplikasi web progresif (PWA) untuk mencatat dan mengatur pengingat harian. Bekerja sepenuhnya secara offline tanpa dependensi server eksternal, seluruh data disimpan di media penyimpanan lokal peramban (*LocalStorage*).

---

## Fitur Utama

- **Penyuntingan Catatan:** Membuat, memperbarui, dan menghapus catatan teks dengan cepat.
- **Daftar Tugas (Checklist):** Mengelola butir tugas langsung di dalam catatan.
- **Pengingat Waktu:** Mengatur pengingat waktu satu kali atau berulang (harian, mingguan, bulanan).
- **Pengelompokan & Label:** Memberi label kategori berwarna dan menyematkan catatan penting ke bagian teratas.
- **Arsip & Pemfilteran:** Mengarsipkan catatan lama serta memfilter catatan berdasarkan status atau label.
- **Pencarian & Pengurutan:** Mencari catatan berdasarkan kata kunci judul/isi dan mengurutkannya secara alfabetis atau kronologis.
- **Portabilitas Data:** Ekspor dan impor seluruh data dalam format berkas JSON untuk pencadangan mandiri.
- **PWA & Offline:** Dapat dipasang (*install*) ke layar utama ponsel (Android/iOS) atau desktop dan tetap berfungsi tanpa internet.

---

## Cara Menjalankan Secara Lokal

Aplikasi ini dibangun menggunakan berkas statis murni (HTML, CSS, dan JavaScript) tanpa dependensi kompilasi.

### Opsi 1: Menggunakan Peramban Langsung
Buka berkas `index.html` langsung menggunakan peramban web (Google Chrome, Microsoft Edge, Firefox, Safari).

### Opsi 2: Menggunakan Server Lokal Ringan (Direkomendasikan untuk PWA)
Agar fitur Service Worker dan instalasi PWA aktif saat pengujian, jalankan server statis:

```bash
# Menggunakan Node.js (npx)
npx serve .

# Atau menggunakan Python 3
python -m http.server 3000
```

Buka alamat `http://localhost:3000` di peramban Anda. Tidak memerlukan sertifikat SSL/HTTPS saat diuji pada lingkungan `localhost`.

---

## Penyimpanan Data

Seluruh data catatan dan label disimpan langsung di media **LocalStorage** peramban Anda:
- Data tidak pernah dikirim ke peladen luar (*zero-telemetry*).
- Riwayat catatan tetap ada selama data peramban tidak dibersihkan secara manual.
- Gunakan fitur **Ekspor JSON** pada menu samping untuk mencadangkan berkas data secara berkala.

---

## Pintasan Papan Ketik

| Pintasan | Fungsi |
|---|---|
| `Ctrl + N` / `Cmd + N` | Membuka editor catatan baru |
| `Ctrl + B` / `Cmd + B` | Menyembunyikan / menampilkan menu samping (*toggle sidebar*) |
| `Ctrl + Shift + D` / `Cmd + Shift + D` | Beralih antara mode gelap dan terang (*toggle dark mode*) |
| `Ctrl + F` / `Cmd + F` | Memfokuskan kursor ke bilah pencarian |
| `Ctrl + Enter` / `Cmd + Enter` | Menyimpan catatan saat editor aktif |
| `Escape` | Menutup jendela editor atau dialog konfirmasi |

---

## Struktur Berkas

```
aplikasi note/
├── index.html          # Struktur antarmuka semantik
├── style.css           # Lembar gaya tata letak responsif
├── app.js              # Logika aplikasi dan manajemen data
├── manifest.json       # Konfigurasi PWA
├── service-worker.js   # Penanganan tembolok offline
└── icons/
    └── icon.svg        # Ikon vektor aplikasi
```

---

## Lisensi

Proyek ini dirilis di bawah lisensi [MIT](LICENSE).
