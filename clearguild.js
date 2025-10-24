import { REST, Routes } from "discord.js";
import dotenv from "dotenv";
import config from "./config.json" assert { type: "json" };

dotenv.config();

// Ambil TOKEN, dan CLIENT_ID dari .env
const TOKEN = process.env.TOKEN; 
// Coba ambil CLIENT_ID dari .env. Anda bisa menggunakan CLIENT_ID atau APPLICATION_ID
const CLIENT_ID = process.env.CLIENT_ID || process.env.APPLICATION_ID; 

// Ambil GUILD_ID dari config.json
const GUILD_ID = config.guildId; 

/**
 * Menghapus semua (/) perintah yang terdaftar di Guild tertentu.
 */
async function clearGuildCommands() {
    if (!TOKEN || !GUILD_ID || !CLIENT_ID) {
        console.error("⚠️ TOKEN, GUILD_ID, atau CLIENT_ID (dari .env) tidak ditemukan/diatur. Pembatalan penghapusan perintah.");
        
        // Tampilkan informasi debugging untuk user
        if (!TOKEN) console.error("  - Pastikan TOKEN ada di .env.");
        if (!GUILD_ID) console.error("  - Pastikan guildId ada di config.json.");
        if (!CLIENT_ID) console.error("  - Pastikan CLIENT_ID atau APPLICATION_ID ada di .env.");
        
        return;
    }
    
    // Inisialisasi REST
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    try {
        console.log(`\n======================================================`);
        console.log(`🚀 MULAI MENGHAPUS PERINTAH DARI GUILD ID: ${GUILD_ID}...`);
        
        // Menghapus semua perintah Guild
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), 
            { body: [] }
        );

        console.log("✅ Berhasil menghapus semua (/) perintah khusus Guild.");
        console.log(`======================================================\n`);
    } catch (error) {
        console.error("❌ Gagal menghapus perintah Guild:", error);
    }
}

// Panggil fungsi utama saat script dijalankan
clearGuildCommands();