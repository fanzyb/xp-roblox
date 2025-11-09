import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { getRobloxUser, isInRobloxGroup, getLevel, embedColor, getRobloxRankName } from "../utils/helpers.js";
import { findUserByDiscordId, saveUser } from "../db/firestore.js";
import config from "../config.json" with { type: "json" };
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("xpd")
    .setDescription("Manage a linked Discord user's Lunar Points (Admin only)") // <-- [GANTI]
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName("add").setDescription("Add Lunar Points and expedition count to a linked user") // <-- [GANTI]
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Lunar Points amount").setRequired(true)) // <-- [GANTI]
    )
    .addSubcommand(sub =>
        sub.setName("remove").setDescription("Remove Lunar Points and expedition count from a linked user") // <-- [GANTI]
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Lunar Points amount").setRequired(true)) // <-- [GANTI]
    )
    .addSubcommand(sub =>
        sub.setName("set").setDescription("Set Lunar Points for a linked user") // <-- [GANTI]
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Lunar Points amount").setRequired(true)) // <-- [GANTI]
    )
    .addSubcommand(sub =>
        sub.setName("bonus").setDescription("Give bonus Lunar Points to a linked user (no expedition count)") // <-- [GANTI]
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Bonus Lunar Points amount").setRequired(true)) // <-- [GANTI]
            .addStringOption(opt => opt.setName("reason").setDescription("Optional reason for the bonus").setRequired(false))
    );

export async function execute(interaction) {
    try {
        const allowed =
            interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
            interaction.member.roles.cache.some(r => (config.xpManagerRoles || []).includes(r.id));
        if (!allowed) return interaction.reply({ content: "❌ You do not have permission to use this command.", flags: 64 });

        await interaction.deferReply({ ephemeral: false });

        const action = interaction.options.getSubcommand();
        const member = interaction.options.getMember("member");
        const amount = interaction.options.getInteger("amount");
        const reason = interaction.options.getString("reason");

        const userFromDb = await findUserByDiscordId(member.id);
        if (!userFromDb) {
            return interaction.editReply({ content: `❌ User <@${member.id}> is not linked to a Roblox account. They need to use \`/verify\` first.` });
        }

        const robloxData = await getRobloxUser(userFromDb.robloxUsername);
        if (!robloxData) return interaction.editReply({ content: "⚠️ Could not find the linked Roblox user. Their username might have changed." });

        const inGroup = await isInRobloxGroup(robloxData.id, config.groupId);
        if (!inGroup) return interaction.editReply({ content: "❌ The linked user is not in the community group." });

        let user = userFromDb;
        const oldLevel = getLevel(user.xp).levelName;
        const oldLevelXp = getLevel(user.xp);

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
        let levelMsg = newLevel !== oldLevel ? ` 🎉 **${robloxData.name} has leveled up to ${newLevel}!**` : "";
        let responseMessage = `✅ Successfully performed '${action}' action with ${amount} Lunar Points for **${robloxData.name}** (linked to <@${member.id}>).${levelMsg}`; // <-- [GANTI]

        if (action === "bonus") {
            responseMessage = `✅ Gave **${amount}** bonus Lunar Points to **${robloxData.name}** (linked to <@${member.id}>).${levelMsg}`; // <-- [GANTI]
            if (reason) responseMessage += `\n*Reason: ${reason}*`;
        }

        // --- Auto Role ---
        if (newLevel !== oldLevel) {
            const robloxRankName = await getRobloxRankName(robloxData.id);
            const rankMapping = config.rankToRoleMapping || {};
            const targetRoleId = rankMapping[newLevel];

            if (robloxRankName && targetRoleId) {
                const targetRole = interaction.guild.roles.cache.get(targetRoleId);
                if (targetRole) {
                    const allRankRoleIds = Object.values(rankMapping);
                    const rolesToRemove = member.roles.cache.filter(role => allRankRoleIds.includes(role.id));

                    if (rolesToRemove.size > 0) {
                        await member.roles.remove(rolesToRemove);
                    }

                    await member.roles.add(targetRole);
                    responseMessage += `\n👑 Their role has been updated to **${targetRole.name}**!`;
                }
            }
        }
        // --- Akhir Auto Role ---

        await interaction.editReply({ content: responseMessage });

        try {
            const xpLogChannel = interaction.guild.channels.cache.get(config.xpLogChannelId);
            if (xpLogChannel) {
                const logFields = [
                    { name: "Action", value: action.charAt(0).toUpperCase() + action.slice(1), inline: true },
                    { name: "Amount", value: amount.toString(), inline: true },
                    { name: "Target Discord", value: `<@${member.id}>`, inline: true },
                    { name: "Target Roblox", value: `${robloxData.name}`, inline: true },
                    { name: "By", value: interaction.user.tag, inline: true },
                    { name: "New Lunar Points", value: user.xp.toString(), inline: true } // <-- [GANTI]
                ];
                if (reason) {
                    logFields.push({ name: "Reason", value: reason });
                }
                const logEmbed = new EmbedBuilder().setTitle(`📊 Lunar Points Log (${action.charAt(0).toUpperCase() + action.slice(1)} - Discord)`).setColor(embedColor).addFields(logFields).setTimestamp(); // <-- [GANTI]
                await xpLogChannel.send({ embeds: [logEmbed] });
            }
        } catch (logErr) {
            console.error("Failed to send XP log:", logErr);
        }

    } catch (error) {
        logError(error, interaction, "xpd");
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred while processing the xpd command." });
        } else {
            await interaction.reply({ content: "❌ An unexpected error occurred while processing the xpd command.", flags: 64 });
        }
    }
}