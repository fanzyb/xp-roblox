// clearGlobalCommands.js
// Script untuk menghapus SEMUA slash command yang terdaftar secara Global.

import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";

// Muat variabel lingkungan dari file .env
dotenv.config();

// Inisialisasi client Discord (hanya perlu intent Guilds)
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function clearGlobalCommands() {
    if (!client.isReady()) {
        console.error("❌ Klien belum siap. Pastikan bot sudah login.");
        return;
    }

    try {
        console.log("Memulai penghapusan semua Slash Command GLOBAL...");
        
        // Ambil semua command Global yang ada
        const commands = await client.application.commands.fetch();
        
        // Hapus semua command dengan mengirim array kosong
        await client.application.commands.set([]); 
        
        console.log(`✅ Sukses! ${commands.size} Slash Command telah dihapus secara GLOBAL.`);
        console.log("===================================================================");
        console.log("⚠️ PENTING: Penghapusan GLOBAL dapat memakan waktu hingga 1 jam penuh ");
        console.log("   untuk diterapkan di semua server karena caching Discord.");
        console.log("   Coba restart Discord Anda (Ctrl/Cmd + R) setelah 15 menit.");
        console.log("===================================================================");

    } catch (error) {
        console.error("❌ Gagal menghapus Slash Command Global:", error.message);
    } finally {
        // Selalu tutup koneksi bot setelah selesai
        client.destroy();
    }
}

client.on("ready", () => {
    console.log(`✅ Bot terhubung sebagai ${client.user.tag}`);
    clearGlobalCommands();
});

// Koneksi ke Discord
const token = process.env.TOKEN;
if (!token) {
    console.error("❌ Variabel TOKEN tidak ditemukan di .env");
    process.exit(1);
}

client.login(token).catch(err => {
    console.error("❌ Gagal login ke Discord:", err.message);
    process.exit(1);
});