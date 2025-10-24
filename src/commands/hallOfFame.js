import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { embedColor, achievementsConfig } from "../utils/helpers.js";
import { getAllUsers } from "../db/firestore.js";

export const data = new SlashCommandBuilder()
    .setName("hall-of-fame")
    .setDescription("Show climbers with achievements");

export async function execute(interaction) {
    await interaction.deferReply();

    // Mengambil semua user dan memfilter di sisi klien (Karena Firestore limitasi array-contains-any)
    const allUsers = await getAllUsers();

    // Filter user yang punya achievement dan sorting berdasarkan XP (desc)
    let users = allUsers
        .filter(u => u.achievements && u.achievements.length > 0)
        .sort((a, b) => (b.xp || 0) - (a.xp || 0));

    if (!users.length) return interaction.editReply({ content: "⚠️ No climbers with achievements yet." });

    let desc = "";
    for (const u of users) {
        // Ambil nama achievement dari ID
        const list = (u.achievements || [])
            .map(id => achievementsConfig.find(a => a.id === id)?.name)
            .filter(Boolean)
            .join(", ");
        desc += `🏅 **${u.robloxUsername}** (XP: ${u.xp || 0}) → ${list}\n`;
    }

    const embed = new EmbedBuilder()
        .setTitle("🏆 Hall of Fame")
        .setColor(embedColor)
        .setDescription(desc)
        .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
}