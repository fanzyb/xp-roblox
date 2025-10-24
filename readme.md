# 🎮 Discord Roblox XP Bot

Bot Discord untuk mengelola sistem XP berbasis **Roblox username** dan **MongoDB**.  
Fitur meliputi: pemberian XP, pengecekan rank, dan leaderboard.  

---

## 🚀 Fitur Utama

- **XP Management (`/xp`)**  
  Tambah, kurangi, atau set XP Roblox user (hanya untuk admin atau role tertentu).  

- **Rank System (`/rank`)**  
  Menampilkan XP, level, dan progress Roblox user.  

- **Leaderboard (`/leaderboard`)**  
  Menampilkan top user berdasarkan XP dengan pagination (next/prev).  

- **Leveling**  
  - Level diatur lewat `config.json`  
  - Progress bar berbentuk blok emoji  
  - Level-up announcement otomatis  

---

## 📦 Dependencies

- [discord.js](https://discord.js.org/) v14  
- [mongoose](https://mongoosejs.com/)  
- [dotenv](https://www.npmjs.com/package/dotenv)  
- [node-fetch](https://www.npmjs.com/package/node-fetch)  

Install dengan:

```
bash
npm install discord.js mongoose dotenv node-fetch
```

## ⚙️ Setup
1. Buat file .env
```
TOKEN=DISCORD_BOT_TOKEN
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
GUILD_ID=
CLIENT_ID=
```

2. Buat file config.json
```
{
  "groupId": 1234567,
  "xpManagerRoles": ["ROLE_ID_1", "ROLE_ID_2"],
  "xpLogChannelId": "LOG_CHANNEL_ID",
  "levels": [
    { "name": "Beginner", "xp": 0 },
    { "name": "Novice", "xp": 100 },
    { "name": "Intermediate", "xp": 250 },
    { "name": "Expert", "xp": 500 },
    { "name": "Master", "xp": 1000 }
  ]
}
```

## 📜 Slash Commands
🔹 /xp <add|remove|set> <username> <amount>

Tambah, kurangi, atau set jumlah XP user.

Hanya bisa digunakan oleh Admin atau role dengan akses.

🔹 /rank <username>

Menampilkan profil Roblox user:

- XP

- Level

- Progress bar

- XP needed untuk level selanjutnya

🔹 /leaderboard

- Menampilkan Top 10 XP Users dengan pagination tombol ⬅️ ➡️.

## 🗄 Database (MongoDB)

Schema User:

```
{
  robloxId: String,       // ID Roblox
  robloxUsername: String, // Username Roblox
  xp: Number              // Jumlah XP
}
```

## 📊 Alur Bot

1. Admin/member dengan role khusus jalankan /xp
2. Bot validasi user Roblox & cek apakah ada di group Roblox
3. XP ditambahkan/diubah di MongoDB
4. Jika naik level → announce level up
5. Semua aksi dicatat di XP Log Channel
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
