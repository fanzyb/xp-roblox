import { SlashCommandBuilder } from "discord.js";
import { generateLeaderboardEmbed } from "../utils/components.js";

export const data = new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show XP or Expedition leaderboard")
    .addStringOption(opt =>
        opt.setName("type")
            .setDescription("Type of leaderboard (XP or Expedition)")
            .setRequired(false)
            .addChoices(
                { name: 'XP', value: 'xp' },
                { name: 'Expedition', value: 'expo' },
            )
    )
    .addIntegerOption(opt => opt.setName("page").setDescription("Page number").setRequired(false));

export async function execute(interaction) {
    // Tugas perintah ini sekarang sederhana:
    // 1. Ambil opsi awal dari pengguna.
    // 2. Buat halaman pertama leaderboard.
    // 3. Kirim balasan.
    // Semua klik tombol akan ditangani oleh listener utama di index.js.

    const page = interaction.options.getInteger("page") || 1;
    const type = interaction.options.getString("type") || 'xp';

    const leaderboardPayload = await generateLeaderboardEmbed(page, type);

    await interaction.reply(leaderboardPayload);
}