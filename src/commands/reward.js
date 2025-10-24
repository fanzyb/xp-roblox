import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { getRobloxUser, achievementsConfig } from "../utils/helpers.js";
import { findUser } from "../db/firestore.js";
import config from "../config.json" with { type: "json" };

export const data = new SlashCommandBuilder()
    .setName("reward")
    .setDescription("Give or remove achievements (interactive)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName("add")
            .setDescription("Give an achievement to a user")
            .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("remove")
            .setDescription("Remove an achievement from a user")
            .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
    );

export async function execute(interaction) {
    const allowed =
        interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
        interaction.member.roles.cache.some(r => (config.rewardManagerRoles || []).includes(r.id));
    if (!allowed) return interaction.reply({ content: "❌ You do not have permission to use this command.", ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const username = interaction.options.getString("username");

    await interaction.deferReply({ ephemeral: true });

    const robloxData = await getRobloxUser(username);
    if (!robloxData) return interaction.editReply({ content: "⚠️ Roblox user not found." });

    let user = await findUser(robloxData.id.toString());
    if (!user) user = { robloxId: robloxData.id.toString(), robloxUsername: robloxData.name, xp: 0, expeditions: 0, achievements: [] };


    if (sub === "add") {
        const currentAchvIds = user.achievements || [];
        // Tampilkan achievement yang BELUM dimiliki user
        const filteredAchvs = achievementsConfig.filter(a => !currentAchvIds.includes(a.id));

        if (!filteredAchvs.length) {
            return interaction.editReply({ content: `✅ **${robloxData.name}** already has all available achievements.` });
        }

        const options = filteredAchvs.map(a => ({
            label: a.name,
            description: a.description || "—",
            value: String(a.id)
        }));
        const menu = new StringSelectMenuBuilder()
            .setCustomId(`reward_add:${encodeURIComponent(robloxData.name)}`)
            .setPlaceholder("Select achievement to add")
            .addOptions(options);
        const row = new ActionRowBuilder().addComponents(menu);
        return interaction.editReply({ content: `🎖 Select achievement to give to **${robloxData.name}**`, components: [row] });
    }

    if (sub === "remove") {
        if (!user.achievements.length) return interaction.editReply({ content: "⚠️ User has no achievements." });

        const options = (user.achievements || [])
            .map(id => achievementsConfig.find(a => a.id === id))
            .filter(Boolean)
            .map(a => ({ label: a.name, description: a.description || "—", value: String(a.id) }));

        if (!options.length) return interaction.editReply({ content: "⚠️ No known achievements to remove for this user." });

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`reward_remove:${encodeURIComponent(robloxData.name)}`)
            .setPlaceholder("Select achievement to remove")
            .addOptions(options);
        const row = new ActionRowBuilder().addComponents(menu);
        return interaction.editReply({ content: `🗑 Select achievement to remove from **${robloxData.name}**`, components: [row] });
    }
}