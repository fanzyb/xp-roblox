import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { findUserByDiscordId, saveUser } from "../db/firestore.js";
import { getLevel, embedColor, syncRankRole } from "../utils/helpers.js";
import config from "../config.json" with { type: "json" };
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("batch")
    .setDescription("Batch manage Lunar Points/expeditions for multiple users/roles.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName("add")
            .setDescription("Add Lunar Points & +1 expedition count to multiple users.")
            .addStringOption(opt => opt.setName("targets").setDescription("Users or roles to target (e.g., @user1 @Role)").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Lunar Points amount to add to each user.").setRequired(true))
            .addStringOption(opt => opt.setName("reason").setDescription("Optional reason for this batch.").setRequired(false))
    )
    .addSubcommand(sub =>
        sub.setName("remove")
            .setDescription("Remove Lunar Points & -1 expedition count from multiple users.")
            .addStringOption(opt => opt.setName("targets").setDescription("Users or roles to target (e.g., @user1 @Role)").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Lunar Points amount to remove from each user.").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("set")
            .setDescription("Set a specific Lunar Points amount for multiple users (expeditions unchanged).")
            .addStringOption(opt => opt.setName("targets").setDescription("Users or roles to target (e.g., @user1 @Role)").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("The exact Lunar Points amount to set for each user.").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("bonus")
            .setDescription("Give bonus Lunar Points to multiple users (expeditions unchanged).")
            .addStringOption(opt => opt.setName("targets").setDescription("Users or roles to target (e.g., @user1 @Role)").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Bonus Lunar Points amount to add to each user.").setRequired(true))
            .addStringOption(opt => opt.setName("reason").setDescription("Optional reason for this batch bonus.").setRequired(false))
    );

export async function execute(interaction) {
    const commandName = "batch";
    try {
        // Cek izin
        const allowed =
            interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
            interaction.member.roles.cache.some(r => (config.xpManagerRoles || []).includes(r.id));
        if (!allowed) return interaction.reply({ content: "❌ You do not have permission to use this command.", ephemeral: true });

        await interaction.deferReply({ ephemeral: false }); // Respon publik

        const action = interaction.options.getSubcommand();
        const targetsString = interaction.options.getString("targets");
        const amount = interaction.options.getInteger("amount");
        const reason = interaction.options.getString("reason") || `Batch ${action}`;

        if (amount < 0) {
            return interaction.editReply({ content: "❌ Amount cannot be a negative number." });
        }

        // --- 1. Kumpulkan Semua Target User ID ---
        const targetUserIds = new Set();
        const userMentionRegex = /<@!?(\d+)>/g;
        const roleMentionRegex = /<@&(\d+)>/g;

        for (const match of targetsString.matchAll(userMentionRegex)) {
            targetUserIds.add(match[1]);
        }

        for (const match of targetsString.matchAll(roleMentionRegex)) {
            const roleId = match[1];
            try {
                const role = await interaction.guild.roles.fetch(roleId);
                if (role) {
                    role.members.forEach(member => {
                        if (!member.user.bot) {
                            targetUserIds.add(member.id);
                        }
                    });
                }
            } catch (err) {
                console.warn(`[BATCH] Could not fetch role ${roleId}: ${err.message}`);
            }
        }

        if (targetUserIds.size === 0) {
            return interaction.editReply({ content: "⚠️ No valid users or roles were found in the 'targets' input." });
        }

        // --- 2. Proses Setiap User ---
        let processedCount = 0;
        let skippedCount = 0;
        const levelUpMessages = [];
        // [REVISI] Siapkan array untuk daftar detail
        const successUsers = [];
        const skippedUsers = [];

        for (const userId of targetUserIds) {
            try {
                const member = await interaction.guild.members.fetch(userId).catch(() => null);
                if (!member) {
                    skippedCount++;
                    skippedUsers.push(`<@${userId}> (Not in server)`); // [REVISI] Catat alasan
                    continue; 
                }

                const userFromDb = await findUserByDiscordId(userId);
                if (!userFromDb || !userFromDb.isVerified) {
                    skippedCount++;
                    skippedUsers.push(`<@${userId}> (Not verified)`); // [REVISI] Catat alasan
                    continue; 
                }

                let user = userFromDb;
                const oldLevel = getLevel(user.xp).levelName;

                if (action === "add") {
                    user.xp += amount;
                    user.expeditions = (user.expeditions || 0) + 1;
                } else if (action === "remove") {
                    user.xp = Math.max(user.xp - amount, 0);
                    user.expeditions = Math.max((user.expeditions || 0) - 1, 0);
                } else if (action === "set") {
                    user.xp = amount;
                } else if (action === "bonus") {
                    user.xp += amount;
                }

                await saveUser(user);
                const newLevel = getLevel(user.xp).levelName;

                if (newLevel !== oldLevel) {
                    const rankRole = await syncRankRole(member, user.xp);
                    if (rankRole) {
                        levelUpMessages.push(`🎉 <@${userId}> (${user.robloxUsername}) leveled up to **${newLevel}**! (Role: ${rankRole.name})`);
                    } else {
                        levelUpMessages.push(`🎉 <@${userId}> (${user.robloxUsername}) leveled up to **${newLevel}**! (No role mapped)`);
                    }
                }
                processedCount++;
                successUsers.push(`<@${userId}>`); // [REVISI] Catat sukses

            } catch (error) {
                console.error(`[BATCH] Failed to process user ${userId}:`, error);
                skippedCount++;
                skippedUsers.push(`<@${userId}> (Error)`); // [REVISI] Catat error
            }
        }

        // --- 3. Buat Respon Embed ---
        const embed = new EmbedBuilder()
            .setTitle(`✅ Batch ${action.charAt(0).toUpperCase() + action.slice(1)} Complete`)
            .setColor(embedColor)
            .addFields(
                // [REVISI] Field count tetap ada sebagai ringkasan
                { name: "Successfully Processed", value: `**${processedCount}** users`, inline: true },
                { name: "Skipped", value: `**${skippedCount}** users`, inline: true },
                { name: "Amount", value: `**${amount}**`, inline: true }
            )
            .setTimestamp();

        if (action === "add") {
            embed.addFields({ name: "Changes (Each)", value: `+${amount} Lunar Points, +1 Expedition`, inline: false });
        } else if (action === "remove") {
            embed.addFields({ name: "Changes (Each)", value: `-${amount} Lunar Points, -1 Expedition`, inline: false });
        } else if (action === "set") {
            embed.addFields({ name: "Changes (Each)", value: `Lunar Points set to ${amount}`, inline: false });
        } else if (action === "bonus") {
            embed.addFields({ name: "Changes (Each)", value: `+${amount} Bonus Lunar Points`, inline: false });
        }

        if (reason && (action === "add" || action === "bonus")) {
             embed.addFields({ name: "Reason", value: reason, inline: false });
        }

        // [REVISI] Tambahkan field detail untuk user yang sukses
        let successText = successUsers.join("\n") || "None";
        if (successText.length > 1024) {
            successText = successText.substring(0, 1021) + "...";
        }
        embed.addFields({ name: `✅ Successfully Processed Users (${processedCount})`, value: successText, inline: false });

        // [REVISI] Tambahkan field detail untuk user yang di-skip
        let skippedText = skippedUsers.join("\n") || "None";
        if (skippedText.length > 1024) {
            skippedText = skippedText.substring(0, 1021) + "...";
        }
        embed.addFields({ name: `❌ Skipped Users (${skippedCount})`, value: skippedText, inline: false });


        // Tambahkan info level up jika ada
        if (levelUpMessages.length > 0) {
            let levelUpText = levelUpMessages.join("\n");
            if (levelUpText.length > 1024) {
                levelUpText = levelUpText.substring(0, 1021) + "...";
            }
            embed.addFields({ name: `🎉 Level Ups (${levelUpMessages.length})`, value: levelUpText });
        } else {
             embed.addFields({ name: "🎉 Level Ups", value: "No users leveled up this time." });
        }

        await interaction.editReply({ embeds: [embed] });

        // --- 4. Kirim Log ---
        // (Logika logging tidak perlu diubah, karena sudah cukup detail)
        try {
            const logChannel = interaction.guild.channels.cache.get(config.xpLogChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle(`📊 Batch ${action.charAt(0).toUpperCase() + action.slice(1)} Log`)
                    .setColor(embedColor)
                    .addFields(
                        { name: "Admin", value: interaction.user.tag, inline: true },
                        { name: "Action", value: action, inline: true },
                        { name: "Amount", value: amount.toString(), inline: true },
                        { name: "Reason", value: reason, inline: false },
                        { name: "Targets (Raw)", value: `\`\`\`${targetsString.substring(0, 1000)}\`\`\``, inline: false },
                        { name: "Processed Count", value: processedCount.toString(), inline: true },
                        { name: "Skipped Count", value: skippedCount.toString(), inline: true }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (logErr) {
            console.error("Failed to send Batch XP log:", logErr);
        }

    } catch (error) {
        logError(error, interaction, commandName);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred during the batch process." });
        } else {
            await interaction.reply({ content: "❌ An unexpected error occurred.", ephemeral: true });
        }
    }
}
