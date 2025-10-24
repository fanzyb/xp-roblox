import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { getRobloxUser, isInRobloxGroup, embedColor } from "../utils/helpers.js";
import { findUserByDiscordId, getSummitGuideData, saveSummitGuideData } from "../db/firestore.js";
import config from "../config.json" with { type: "json" };
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("summitd")
    .setDescription("Manage a linked user's Summit Guide count (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName("add").setDescription("Add summit guide count to a linked user")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Summit guide amount").setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
        sub.setName("remove").setDescription("Remove summit guide count from a linked user")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Summit guide amount").setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub =>
        sub.setName("set").setDescription("Set summit guide count for a linked user")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Summit guide amount").setRequired(true).setMinValue(0))
    );

export async function execute(interaction) {
    try {
        // [PERUBAIKAN] Pengecekan izin yang lebih spesifik
        const allowed =
            interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
             interaction.member.roles.cache.some(r => (config.eventManagerRoles || []).includes(r.id));
        if (!allowed) return interaction.reply({ content: "❌ You do not have the required role (Event Manager) to use this command.", ephemeral: true });

        await interaction.deferReply({ ephemeral: false });

        const action = interaction.options.getSubcommand();
        const member = interaction.options.getMember("member");
        const amount = interaction.options.getInteger("amount");

        const userFromDb = await findUserByDiscordId(member.id);
        if (!userFromDb) {
            return interaction.editReply({ content: `❌ User <@${member.id}> is not linked.` });
        }
        
        const robloxId = userFromDb.robloxId;
        const robloxUsername = userFromDb.robloxUsername;

        const eventData = await getSummitGuideData(robloxId);
        const oldSummitCount = eventData.guideCount || 0;
        let newSummitCount = oldSummitCount;

        if (action === "add") newSummitCount += amount;
        if (action === "remove") newSummitCount = Math.max(newSummitCount - amount, 0);
        if (action === "set") newSummitCount = amount;

        await saveSummitGuideData(robloxId, { guideCount: newSummitCount });

        await interaction.editReply({ content: `✅ ${action} ${amount} Summit Guide count for **${robloxUsername}** (linked to <@${member.id}>). Total: **${newSummitCount}**` });

        // Kirim log
        try {
            const logChannelId = config.eventLogChannelId || config.xpLogChannelId;
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle("🏔️ Summit Guide Log (Event - Discord)")
                    .setColor(embedColor)
                    .addFields(
                        { name: "Action", value: action, inline: true }, { name: "Amount", value: amount.toString(), inline: true },
                        { name: "Target Discord", value: `<@${member.id}>`, inline: true }, { name: "Target Roblox", value: `${robloxUsername}`, inline: true },
                        { name: "By", value: interaction.user.tag, inline: true }, { name: "Old Guides", value: oldSummitCount.toString(), inline: true },
                        { name: "New Guides", value: newSummitCount.toString(), inline: true }
                    ).setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (logErr) {
            console.error("Failed to send Summit log:", logErr);
        }

    } catch (error) {
        logError(error, interaction, "summitd");
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred." });
        } else {
            await interaction.reply({ content: "❌ An unexpected error occurred.", ephemeral: true });
        }
    }
}