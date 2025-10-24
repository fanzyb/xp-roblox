# Roblox XP Bot untuk Discord

Bot Discord yang terintegrasi dengan Roblox untuk melacak XP (Experience Points), ekspedisi, dan pencapaian (achievements) untuk komunitas game. Bot ini terhubung dengan Firebase Firestore sebagai database dan menggunakan API Roblox untuk verifikasi dan pengambilan data.

## Fitur Utama

  * **Sistem XP & Level**: Memberi dan mengelola XP untuk pengguna. Pengguna dapat naik level berdasarkan jumlah XP yang terkumpul.
  * **Pelacakan Ekspedisi**: Mencatat jumlah ekspedisi yang diikuti oleh setiap pengguna.
  * **Papan Peringkat (Leaderboard)**: Menampilkan peringkat pengguna berdasarkan XP atau jumlah ekspedisi, dengan sistem paginasi.
  * **Verifikasi Akun Roblox**: Menghubungkan akun Discord pengguna dengan akun Roblox mereka, dengan dukungan integrasi RoVer.
  * **Manajemen Peran (Role)**: Memberikan peran (roles) kepada pengguna secara otomatis berdasarkan rank mereka di grup Roblox.
  * **Sistem Pencapaian (Achievements)**: Memberikan penghargaan/pencapaian khusus kepada pengguna yang dapat ditampilkan di profil mereka.
  * **Log Administratif**: Mencatat semua tindakan administratif (pemberian XP, hadiah, dll.) di channel khusus untuk transparansi.
  * **Pemberitahuan Milestone**: Secara otomatis mengirimkan pengumuman ketika jumlah anggota grup Roblox mencapai milestone tertentu.

## Perintah yang Tersedia

### Perintah Pengguna

  * `/rank [target]` - Menampilkan rank, level, XP, dan pencapaian. Bisa untuk diri sendiri atau pengguna lain.
  * `/leaderboard [type] [page]` - Menampilkan papan peringkat berdasarkan XP atau Ekspedisi.
  * `/hall-of-fame` - Menampilkan daftar pengguna yang memiliki pencapaian.
  * `/list-reward` - Menampilkan semua pencapaian yang tersedia.
  * `/verify [username]` - Memulai proses verifikasi untuk menautkan akun Roblox.
  * `/getrole [target]` - Sinkronisasi rank dari grup Roblox ke peran (role) di Discord.

### Perintah Admin

  * `/xp <add|remove|set|bonus>` - Mengelola XP pengguna berdasarkan nama pengguna Roblox.
  * `/xpd <add|remove|set|bonus>` - Mengelola XP pengguna berdasarkan akun Discord yang sudah terverifikasi.
  * `/expo <add|remove|set>` - Mengelola jumlah ekspedisi pengguna berdasarkan nama pengguna Roblox.
  * `/expod <add|remove|set>` - Mengelola jumlah ekspedisi pengguna berdasarkan akun Discord yang terverifikasi.
  * `/reward <add|remove>` - Memberi atau menghapus pencapaian dari pengguna.
  * `/summit <add|remove|set>` - (Event) Mengelola data partisipasi event "Summit Guide".
  * `/summitd <add|remove|set>` - (Event) Mengelola data partisipasi event "Summit Guide" untuk pengguna Discord yang terverifikasi.
  * `/link <member|status|remove|setup|initiate>` - Perintah administratif untuk mengelola tautan akun.
  * `/debug` - Menampilkan informasi debug sistem.

## Instalasi & Penggunaan

1.  **Prasyarat**:

      * Node.js
      * Akun Firebase dengan Firestore diaktifkan.
      * Bot Discord dengan token.

2.  **Setup Proyek**:

      * Clone repositori.
      * Jalankan `npm install` untuk menginstal semua dependensi yang ada di `package.json`.
      * Buat file `.env` di direktori root dan isi dengan variabel berikut:
        ```
        TOKEN=DISCORD_BOT_TOKEN_ANDA
        CLIENT_ID=DISCORD_BOT_CLIENT_ID_ANDA
        ROVER_API_KEY=ROVER_API_KEY_ANDA (Opsional, untuk integrasi RoVer)
        ```
      * Letakkan file `firebase-adminsdk.json` Anda di direktori root.

3.  **Konfigurasi**:

      * Buka `src/config.json` dan sesuaikan semua ID (Group ID, Guild ID, Channel ID, Role ID) sesuai dengan server Discord dan grup Roblox Anda.

4.  **Menjalankan Bot**:

      * Gunakan perintah `npm start` untuk menjalankan bot.

5.  **Pembersihan Perintah (Opsional)**:

      * `clearguild.js`: Menghapus semua perintah slash yang terdaftar di server (guild) tertentu.
      * `clear.js`: Menghapus semua perintah slash yang terdaftar secara global.

## Struktur File

```
.
├── index.js              # File utama bot
├── config.json           # Konfigurasi utama
├── package.json          #
├── clearguild.js         # Skrip pembersihan perintah Guild
├── clear.js              # Skrip pembersihan perintah Global
├── src/
│   ├── commands/         # File untuk setiap perintah slash
│   ├── db/
│   │   └── firestore.js  # Logika interaksi dengan Firebase Firestore
│   └── utils/
│       ├── components.js # Handler untuk komponen interaktif (tombol, menu)
│       ├── errorLogger.js# Fungsi untuk logging error
│       └── helpers.js    # Fungsi bantuan (API calls, kalkulasi level)
└── firebase-adminsdk.json # Kunci service account Firebase (JANGAN DIBAGIKAN)
```
