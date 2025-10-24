import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { getRobloxUser, isInRobloxGroup, getLevel, embedColor } from "../utils/helpers.js";
import { findUserByDiscordId, saveUser } from "../db/firestore.js";
import config from "../config.json" with { type: "json" };
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("xpd")
    .setDescription("Manage a linked Discord user's XP (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName("add").setDescription("Add XP and expedition count to a linked user")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("XP amount").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("remove").setDescription("Remove XP and expedition count from a linked user")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("XP amount").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("set").setDescription("Set XP for a linked user")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("XP amount").setRequired(true))
    )
    // [BARU] Subcommand 'bonus'
    .addSubcommand(sub =>
        sub.setName("bonus").setDescription("Give bonus XP to a linked user (no expedition count)")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Bonus XP amount").setRequired(true))
            .addStringOption(opt => opt.setName("reason").setDescription("Optional reason for the bonus").setRequired(false))
    );

export async function execute(interaction) {
    try {
        const allowed =
            interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
            interaction.member.roles.cache.some(r => (config.xpManagerRoles || []).includes(r.id));
        if (!allowed) return interaction.reply({ content: "❌ You do not have permission to use this command.", ephemeral: true });

        await interaction.deferReply({ ephemeral: false });

        const action = interaction.options.getSubcommand();
        const member = interaction.options.getMember("member");
        const amount = interaction.options.getInteger("amount");
        // [BARU] Ambil 'reason' dari opsi
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

        // [MODIFIKASI] Logika untuk subcommand baru dan lama
        if (action === "add") {
            user.xp += amount;
            user.expeditions = (user.expeditions || 0) + 1;
        } else if (action === "remove") {
            user.xp = Math.max(user.xp - amount, 0);
            user.expeditions = Math.max((user.expeditions || 0) - 1, 0);
        } else if (action === "set") {
            user.xp = amount;
        } else if (action === "bonus") {
            // Hanya tambah XP
            user.xp += amount;
        }

        await saveUser(user);

        const newLevel = getLevel(user.xp).levelName;
        const levelMsg = newLevel !== oldLevel ? ` 🎉 **${robloxData.name} has leveled up to ${newLevel}!**` : "";
        let responseMessage = `✅ Successfully performed '${action}' action with ${amount} XP for **${robloxData.name}** (linked to <@${member.id}>).${levelMsg}`;

        // [BARU] Pesan balasan khusus untuk 'bonus'
        if (action === "bonus") {
            responseMessage = `✅ Gave **${amount}** bonus XP to **${robloxData.name}** (linked to <@${member.id}>).${levelMsg}`;
            if (reason) responseMessage += `\n*Reason: ${reason}*`;
        }

        await interaction.editReply({ content: responseMessage });

        // Kirim log SETELAH pesan sukses
        try {
            const xpLogChannel = interaction.guild.channels.cache.get(config.xpLogChannelId);
            if (xpLogChannel) {
                const logFields = [
                    { name: "Action", value: action.charAt(0).toUpperCase() + action.slice(1), inline: true },
                    { name: "Amount", value: amount.toString(), inline: true },
                    { name: "Target Discord", value: `<@${member.id}>`, inline: true },
                    { name: "Target Roblox", value: `${robloxData.name}`, inline: true },
                    { name: "By", value: interaction.user.tag, inline: true },
                    { name: "New XP", value: user.xp.toString(), inline: true }
                ];
                // [BARU] Tambahkan 'reason' ke log jika ada
                if (reason) {
                    logFields.push({ name: "Reason", value: reason });
                }
                const logEmbed = new EmbedBuilder().setTitle(`📊 XP Log (${action.charAt(0).toUpperCase() + action.slice(1)} - Discord)`).setColor(embedColor).addFields(logFields).setTimestamp();
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
            await interaction.reply({ content: "❌ An unexpected error occurred while processing the xpd command.", ephemeral: true });
        }
    }
}