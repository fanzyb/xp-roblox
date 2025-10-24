import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { findUser, saveUser, countTotalUsers, findLeaderboardUsers } from "../db/firestore.js";
import { achievementsConfig, embedColor, getRobloxUser } from "./helpers.js";
import config from "../config.json" with { type: "json" };


// --- Reward Select Menu Handler ---
// (Fungsi ini tidak berubah)
export async function handleRewardSelectMenu(interaction) {
    // customId format: reward_add:<username> or reward_remove:<username>
    const [action, encodedName] = interaction.customId.split(":");
    const username = decodeURIComponent(encodedName || "");
    const selectedId = parseInt(interaction.values[0]);
    const achv = achievementsConfig.find(a => a.id === selectedId);
    if (!achv) return interaction.update({ content: "⚠️ Achievement not found.", components: [] });

    const robloxData = await getRobloxUser(username);
    if (!robloxData) return interaction.update({ content: "⚠️ Roblox user not found.", components: [] });

    let user = await findUser(robloxData.id.toString());
    if (!user) user = { robloxId: robloxData.id.toString(), robloxUsername: robloxData.name, xp: 0, expeditions: 0, achievements: [] };

    const guild = interaction.guild;
    const rewardLogChannel = guild ? guild.channels.cache.get(config.rewardLogChannelId) : null;

    if (action === "reward_add") {
        if (!user.achievements.includes(selectedId)) user.achievements.push(selectedId);
        await saveUser(user);

        if (rewardLogChannel) {
            // ... logika logging ...
        }

        return interaction.update({ content: `✅ Added **${achv.name}** to **${robloxData.name}**`, components: [] });
    }

    if (action === "reward_remove") {
        user.achievements = user.achievements.filter(a => a !== selectedId);
        await saveUser(user);

        if (rewardLogChannel) {
           // ... logika logging ...
        }

        return interaction.update({ content: `🗑 Removed **${achv.name}** from **${robloxData.name}**`, components: [] });
    }

    return interaction.update({ content: "⚠️ Unknown action.", components: [] });
}


// --- Logika Tombol/Paginasi Leaderboard ---
export async function generateLeaderboardEmbed(pageNum, lbType, limit = 10) {
    const sortField = lbType === 'expo' ? 'expeditions' : 'xp';
    const sortTitle = lbType === 'expo' ? 'Expedition' : 'XP';

    const totalUsers = await countTotalUsers();
    const totalPages = Math.max(1, Math.ceil(totalUsers / limit));

    if (pageNum < 1) pageNum = 1;
    if (pageNum > totalPages) pageNum = totalPages;

    const users = await findLeaderboardUsers(sortField, limit, (pageNum - 1) * limit);

    let desc = "";
    let rank = (pageNum - 1) * limit + 1;
    for (const u of users) {
        const value = u[sortField] || 0;
        desc += `**#${rank}** - **${u.robloxUsername}** → ${value} ${sortTitle}\n`;
        rank++;
    }

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`lb_prev_${lbType}_${pageNum}`).setLabel("⬅️ Prev").setStyle(ButtonStyle.Primary).setDisabled(pageNum === 1),
        new ButtonBuilder().setCustomId(`lb_next_${lbType}_${pageNum}`).setLabel("Next ➡️").setStyle(ButtonStyle.Primary).setDisabled(pageNum === totalPages)
    );

    // Perbaikan: Custom ID untuk switch selalu merujuk ke halaman 1
    const switchRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`lb_switch_${lbType === 'xp' ? 'expo' : 'xp'}_1`).setLabel(`Switch to ${lbType === 'xp' ? 'Expedition' : 'XP'} LB`).setStyle(ButtonStyle.Secondary)
    );

    return {
        embeds: [
            new EmbedBuilder()
                .setTitle(`🏆 Leaderboard ${sortTitle} (Page ${pageNum}/${totalPages})`)
                .setColor(embedColor)
                .setDescription(desc || "⚠️ Tidak ada pengguna ditemukan.")
        ],
        components: [buttonRow, switchRow],
    };
}

export async function handleLeaderboardButton(interaction) {
    // Cek apakah interaksi masih valid sebelum melanjutkan
    if (interaction.replied || interaction.deferred) {
        console.warn(`[WARN] Interaksi untuk ${interaction.customId} sudah ditangani.`);
        return;
    }

    try {
        const parts = interaction.customId.split("_");
        const btnAction = parts[1]; // prev, next, switch
        const btnType = parts[2];   // xp, expo
        let currentPage = parseInt(parts[3]) || 1;

        let newType = btnType;
        let newPage = currentPage;

        if (btnAction === 'switch') {
            newType = btnType;
            newPage = 1; // Kembali ke halaman 1 saat switch
        } else {
            newType = btnType;
            newPage = btnAction === 'prev' ? currentPage - 1 : currentPage + 1;
        }

        // Beri tahu Discord bahwa kita sudah menerima kliknya
        await interaction.deferUpdate();

        // Buat konten baru dan edit pesan aslinya
        const result = await generateLeaderboardEmbed(newPage, newType);
        await interaction.editReply(result);

    } catch (error) {
        console.error("Error menangani tombol leaderboard:", error);
        // Jika terjadi error seperti 'Unknown Interaction', kita hanya log
        // dan tidak mencoba membalas lagi karena sudah terlambat.
    }
}

/**
 * Fungsi utama untuk routing interaksi komponen
 */
export async function handleComponentInteraction(interaction) {
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("reward_")) {
        return handleRewardSelectMenu(interaction);
    }

    if (interaction.isButton() && interaction.customId.startsWith("lb_")) {
        return handleLeaderboardButton(interaction);
    }
}