import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { getRobloxUser, isInRobloxGroup, embedColor } from "../utils/helpers.js";
import { findUser, saveSummitGuideData, getSummitGuideData } from "../db/firestore.js";
import config from "../config.json" with { type: "json" };
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("summit")
    .setDescription("Manage user Summit Guide count for the event (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName("add").setDescription("Add summit guide count")
            .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Summit guide amount").setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
        sub.setName("remove").setDescription("Remove summit guide count")
            .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Summit guide amount").setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
        sub.setName("set").setDescription("Set summit guide count")
            .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Summit guide amount").setRequired(true).setMinValue(0))
    );

export async function execute(interaction) {
    try {
        // [PERUBAIKAN] Pengecekan izin yang lebih spesifik
        const allowed =
            interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
            interaction.member.roles.cache.some(r => (config.eventManagerRoles || []).includes(r.id));
        if (!allowed) return interaction.reply({ content: "❌ You do not have the required role (Event Manager) to use this command.", ephemeral: true });

        const action = interaction.options.getSubcommand();
        const username = interaction.options.getString("username");
        const amount = interaction.options.getInteger("amount");

        await interaction.deferReply({ ephemeral: false });

        const robloxData = await getRobloxUser(username);
        if (!robloxData) return interaction.editReply({ content: "⚠️ Roblox user not found." });

        const inGroup = await isInRobloxGroup(robloxData.id, config.groupId);
        if (!inGroup) return interaction.editReply({ content: "❌ User is not in the community group." });

        const eventData = await getSummitGuideData(robloxData.id.toString());
        const oldSummitCount = eventData.guideCount || 0;
        let newSummitCount = oldSummitCount;

        if (action === "add") newSummitCount += amount;
        if (action === "remove") newSummitCount = Math.max(newSummitCount - amount, 0);
        if (action === "set") newSummitCount = amount;

        await saveSummitGuideData(robloxData.id.toString(), { guideCount: newSummitCount });

        await interaction.editReply({ content: `✅ ${action} ${amount} Summit Guide count for **${robloxData.name}**. Total: **${newSummitCount}**` });

        // Kirim log
        try {
            const logChannelId = config.eventLogChannelId || config.xpLogChannelId;
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle("🏔️ Summit Guide Log (Event)")
                    .setColor(embedColor)
                    .addFields(
                        { name: "Action", value: action, inline: true },
                        { name: "Amount", value: amount.toString(), inline: true },
                        { name: "Target", value: `${robloxData.name} (${robloxData.id})`, inline: true },
                        { name: "By", value: interaction.user.tag, inline: true },
                        { name: "Old Guides", value: oldSummitCount.toString(), inline: true },
                        { name: "New Guides", value: newSummitCount.toString(), inline: true }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (logErr) {
            console.error("Failed to send Summit log:", logErr);
        }

    } catch (error) {
        logError(error, interaction, "summit");
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred." });
        } else {
            await interaction.reply({ content: "❌ An unexpected error occurred.", ephemeral: true });
        }
    }
}