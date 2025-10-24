import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { getRobloxUser, isInRobloxGroup, getLevel, embedColor } from "../utils/helpers.js"; 
import { findUser, saveUser } from "../db/firestore.js";
import config from "../config.json" with { type: "json" };
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("xp")
    .setDescription("Manage user XP (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName("add").setDescription("Add XP and expedition count")
            .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("XP amount").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("remove").setDescription("Remove XP and expedition count")
            .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("XP amount").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("set").setDescription("Set XP")
            .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("XP amount").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("bonus").setDescription("Give bonus XP without adding expedition count")
            .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Bonus XP amount").setRequired(true))
            .addStringOption(opt => opt.setName("reason").setDescription("Optional reason for the bonus").setRequired(false))
    ); // <--- KESALAHANNYA ADA DI SINI, TITIK KOMA (;) SUDAH DIHAPUS

export async function execute(interaction) {
    try {
        const allowed =
            interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
            interaction.member.roles.cache.some(r => (config.xpManagerRoles || []).includes(r.id));
        if (!allowed) return interaction.reply({ content: "❌ You do not have permission to use this command.", ephemeral: true });

        const action = interaction.options.getSubcommand();
        const username = interaction.options.getString("username");
        const amount = interaction.options.getInteger("amount");
        const reason = interaction.options.getString("reason");

        await interaction.deferReply({ ephemeral: false });

        const robloxData = await getRobloxUser(username);
        if (!robloxData) return interaction.editReply({ content: "⚠️ Roblox user not found." });

        const inGroup = await isInRobloxGroup(robloxData.id, config.groupId);
        if (!inGroup) return interaction.editReply({ content: "❌ User is not in the community group." });

        let user = await findUser(robloxData.id.toString());
        if (!user) user = { robloxId: robloxData.id.toString(), robloxUsername: robloxData.name, xp: 0, expeditions: 0, achievements: [] };

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
        const levelMsg = newLevel !== oldLevel ? ` 🎉 **${robloxData.name} has leveled up to ${newLevel}!**` : "";
        let responseMessage = `✅ Successfully performed '${action}' action with ${amount} XP for **${robloxData.name}**.${levelMsg}`;

        if (action === "bonus") {
            responseMessage = `✅ Gave **${amount}** bonus XP to **${robloxData.name}**.${levelMsg}`;
            if (reason) responseMessage += `\n*Reason: ${reason}*`;
        }
        
        await interaction.editReply({ content: responseMessage });
        
        // Kirim log setelahnya
        try {
            const logFields = [
                { name: "Action", value: action.charAt(0).toUpperCase() + action.slice(1), inline: true },
                { name: "Amount", value: amount.toString(), inline: true },
                { name: "Target", value: `${robloxData.name} (${robloxData.id})`, inline: true },
                { name: "By", value: interaction.user.tag, inline: true },
                { name: "New XP", value: user.xp.toString(), inline: true }
            ];
            
            if (action === "add" || action === "remove") {
                logFields.push({ name: "Total Expeditions", value: (user.expeditions || 0).toString(), inline: true });
            }

            if (reason) {
                logFields.push({ name: "Reason", value: reason });
            }

            const xpLogChannel = interaction.guild.channels.cache.get(config.xpLogChannelId);
            if (xpLogChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle(`📊 XP Log (${action.charAt(0).toUpperCase() + action.slice(1)})`)
                    .setColor(embedColor)
                    .addFields(logFields)
                    .setTimestamp();
                await xpLogChannel.send({ embeds: [logEmbed] });
            }
        } catch(logErr) {
            console.error("Failed to send XP log:", logErr);
        }

    } catch (error) {
        logError(error, interaction, "xp");
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred." });
        } else {
            await interaction.reply({ content: "❌ An unexpected error occurred.", ephemeral: true });
        }
    }
}
