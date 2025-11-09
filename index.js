import { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    Collection, 
    ChannelType, 
    PermissionFlagsBits,
    AuditLogEvent,
    Partials 
} from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Import modules
import config from "./src/config.json" with { type: "json" }; //
import { getRobloxGroupData } from "./src/utils/helpers.js"; //
import { handleComponentInteraction } from "./src/utils/components.js"; //
import { 
    getLastAnnouncedMilestone, 
    setLastAnnouncedMilestone 
} from "./src/db/firestore.js"; //

// --- Handler Temp Voice ---
import { handleTempVoiceInteraction, generateControlPanelEmbed } from "./src/utils/tempVoiceHandler.js";

// --- [BARU] Handler Self Role ---
import { handleSelfRoleMenu } from "./src/utils/selfRoleHandler.js";

// Handler komponen lain
import { handleComponent as verifyHandleComponent, handleModalSubmit as verifyHandleModal } from "./src/commands/verify.js"; //
import { handleTicketButton, handleTicketModal } from "./src/commands/ticket.js";
import { handleModalSubmit as messageHandleModal } from "./src/commands/message.js"; //

dotenv.config();
import "./src/db/firestore.js"; //

// --- [INTENT LENGKAP] ---
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers, // <-- Untuk Welcome & Audit
        GatewayIntentBits.GuildMessages, // <-- Untuk Audit
        GatewayIntentBits.MessageContent // <-- Untuk Audit
    ],
    partials: [
        Partials.Message // <-- Untuk Audit
    ]
});
// --- [AKHIR INTENT] ---

// --- Command Handler Dinamis ---
client.commands = new Collection();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commandsPath = path.join(__dirname, "src", "commands");

async function loadCommands(directory) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            await loadCommands(fullPath); 
        } else if (file.endsWith(".js")) {
            const relativePath = path.relative(__dirname, fullPath).replace(/\\/g, '/');
            const command = await import(`./${relativePath}`); 
            
            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
                console.log(`[CMD Load] Loaded: ${command.data.name}`);
            } else {
                console.warn(`[CMD Load] File ${fullPath} missing 'data' or 'execute'.`);
            }
        }
    }
}
// --- [AKHIR COMMAND HANDLER] ---


// --- [MILESTONE DIKEMBALIKAN] ---
async function checkMilestones() {
    console.log("[MILESTONE] Checking Roblox group member count...");
    const groupData = await getRobloxGroupData(); 
    if (!groupData || groupData.memberCount === 0) {
        console.log("[MILESTONE] Failed to fetch group data.");
        return;
    }
    const currentMembers = groupData.memberCount;
    const lastAnnounced = await getLastAnnouncedMilestone(); 
    const milestones = config.memberCountMilestones || [];
    let nextMilestone = 0;
    for (const m of milestones) {
        if (m > lastAnnounced) {
            nextMilestone = m;
            break;
        }
    }
    if (nextMilestone === 0) {
        console.log("[MILESTONE] No new milestones to check.");
        return;
    }
    console.log(`[MILESTONE] Current members: ${currentMembers}, Next milestone: ${nextMilestone}`);
    if (currentMembers >= nextMilestone) {
        console.log(`[MILESTONE] 🎉 Milestone reached: ${nextMilestone}! Sending announcement...`);
        const channel = client.channels.cache.get(config.milestoneChannelId);
        if (!channel) {
            console.error(`[ERROR] Milestone channel with ID '${config.milestoneChannelId}' not found.`);
            return;
        }
        const embed = new EmbedBuilder()
            .setTitle("🎉 Community Milestone Reached! 🎉")
            .setDescription(`## We've just hit **${nextMilestone.toLocaleString()}** members in our Roblox Group!`)
            .setColor(config.embedColor || "#1B1464")
            .setThumbnail(client.guilds.cache.first()?.iconURL() ?? null)
            .addFields({ name: "Thank You!", value: "A huge thank you to every single member for being a part of our community. Let's aim for the next milestone!" })
            .setTimestamp();
        try {
            await channel.send({ content: "WOW", embeds: [embed] });
            await setLastAnnouncedMilestone(nextMilestone); 
            console.log(`[MILESTONE] Announcement for ${nextMilestone} sent successfully.`);
        } catch (e) {
            console.error("Failed to send milestone announcement:", e);
        }
    }
}
// --- [AKHIR MILESTONE] ---

// ----------------- Event: ready -----------------
client.on("clientReady", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    const guild = client.guilds.cache.first();
    if (!guild) {
        console.error("Bot is not in any guild! Cannot initialize.");
        return;
    }
    console.log("Loading commands...");
    await loadCommands(commandsPath);
    
    async function updatePresence() {
        const groupData = await getRobloxGroupData(); 
        const newStatus = `${groupData.name} with ${groupData.memberCount.toLocaleString()} Members`;
        client.user.setPresence({
            activities: [{ name: newStatus, type: 3 }],
            status: "online"
        });
        console.log(`Presence updated: ${newStatus}`);
    }
    updatePresence();
    setInterval(updatePresence, 1000 * 60 * 10);
    
    const commandsToDeploy = client.commands.map(cmd => cmd.data);
    if (guild) {
        await guild.commands.set(commandsToDeploy);
        console.log(`✅ ${commandsToDeploy.length} commands registered locally on ${guild.name}`);
    } else {
        await client.application.commands.set(commandsToDeploy);
        console.log(`✅ ${commandsToDeploy.length} commands registered globally`);
    }

    // --- [MILESTONE DIKEMBALIKAN] ---
    checkMilestones();
    setInterval(checkMilestones, 1000 * 60 * 60);
    // --- [AKHIR MILESTONE] ---
});

// ----------------- Event: interactionCreate -----------------
client.on("interactionCreate", async (interaction) => {
    try {
        // --- Handler komponen (Button/Modal/Select) ---
        if (interaction.isStringSelectMenu()) { 
            if (interaction.customId.startsWith('selfrole_menu_')) {
                return await handleSelfRoleMenu(interaction);
            }
            if (interaction.customId.startsWith('reward_')) { //
                return await handleComponentInteraction(interaction);
            }
        }
        
        if (interaction.isButton()) {
            if (interaction.customId.startsWith('verify_')) {
                return await verifyHandleComponent(interaction);
            }
            if (interaction.customId.startsWith('lb_')) { //
                return await handleComponentInteraction(interaction);
            }
            if (interaction.customId.startsWith('ticket_')) {
                return await handleTicketButton(interaction);
            }
            if (interaction.customId.startsWith('tv_')) {
                return await handleTempVoiceInteraction(interaction);
            }
            return;
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'verify_modal_submit') {
                return await verifyHandleModal(interaction);
            }
            if (interaction.customId === 'send_message_modal') {
                return await messageHandleModal(interaction);
            }
            if (interaction.customId.startsWith('ticket_')) {
                return await handleTicketModal(interaction);
            }
            if (interaction.customId.startsWith('tv_')) {
                return await handleTempVoiceInteraction(interaction);
            }
            return;
        }
        // --- (Akhir handler komponen) ---


        if (!interaction.isChatInputCommand()) return;

        // --- Eksekusi command ---
        const command = client.commands.get(interaction.commandName);
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            await interaction.reply({ content: "❌ Unknown command.", flags: 64 });
            return;
        }

        await command.execute(interaction);
        // --- (Akhir eksekusi command) ---

    } catch (err) {
        console.error("Interaction handler error:", err);
        const replyOptions = { content: "❌ An error occurred while executing this command.", flags: 64 };
        if (interaction.replied || interaction.deferred) {
            try { await interaction.editReply(replyOptions); } catch {}
        } else {
            try { await interaction.reply(replyOptions); } catch {}
        }
    }
});


// --- Handler Temp Voice ---
const tempChannelCreations = new Set();
client.on("voiceStateUpdate", async (oldState, newState) => {
    const { member, guild } = newState;
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;
    const createChannelId = config.tempVoiceCreateChannelId;
    const categoryId = config.tempVoiceCategoryId;
    if (!categoryId || !createChannelId) return;
    if (newChannel && newChannel.id === createChannelId) {
        if (tempChannelCreations.has(member.id)) return;
        tempChannelCreations.add(member.id);
        try {
            const channelName = `${member.user.username}'s Channel`;
            const tempChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildVoice,
                parent: categoryId,
                permissionOverwrites: [
                    { id: guild.roles.everyone, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel] },
                    { id: member.id, allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.ManageRoles] }
                ]
            });
            if (newState.channel) {
                await member.voice.setChannel(tempChannel);
                const panel = generateControlPanelEmbed();
                await tempChannel.send(panel);
                const dmEmbed = new EmbedBuilder()
                    .setColor(config.embedColor)
                    .setTitle("Your Temporary Channel is Ready!")
                    .setDescription(`We have successfully created your temporary voice channel: **${tempChannel.name}**.\n\nYou can manage it using the buttons in the channel chat or in the <#${config.tempVoiceControlChannelId}> channel.`)
                    .setFooter({ text: "This channel will be automatically deleted when empty." });
                await member.send({ embeds: [dmEmbed] }).catch(err => {
                    console.warn(`[TempVoice] Failed to send DM to ${member.user.tag}: ${err.message}`);
                });
            }
        } catch (err) {
            console.error("[TempVoice] Error creating channel:", err);
        } finally {
            tempChannelCreations.delete(member.id);
        }
    }
    if (oldChannel && oldChannel.parentId === categoryId && oldChannel.id !== createChannelId && oldChannel.members.size === 0) {
        try {
            await oldChannel.delete("Temporary channel is now empty.");
        } catch (err) {
            console.error("[TempVoice] Error deleting channel:", err);
        }
    }
});


// --- [WELCOME MESSAGE DIKEMBALIKAN + IGNORE BOT] ---
client.on("guildMemberAdd", async (member) => {
    
    // --- [PERMINTAAN BARU: IGNORE BOT] ---
    if (member.user.bot) {
        console.log(`[WELCOME DEBUG] Event diabaikan: User adalah bot (${member.user.tag})`);
        return;
    }
    // --- [AKHIR PERMINTAAN BARU] ---
    
    console.log(`[WELCOME DEBUG] Event 'guildMemberAdd' TERPICU. User: ${member.user.tag} (${member.id})`);

    if (member.guild.id !== config.guildId) {
        console.log(`[WELCOME DEBUG] Event diabaikan: Guild ID tidak cocok (${member.guild.id} !== ${config.guildId})`);
        return;
    }
    const channelIds = config.welcomeChannelIds;
    if (!channelIds || channelIds.length === 0) {
        console.log("[WELCOME DEBUG] Event diabaikan: 'welcomeChannelIds' tidak ada atau kosong di config.json.");
        return;
    }
    const welcomeDescription = 
        `- Please read <#1412676765553524746>\n` +
        `- Check <#1418312135569576028> to get your preferred role.\n` +
        `- And don't forget to verify at <#1412685158829785118> so we can recognize you.\n\n` +
        `I hope you enjoy your time in our community.`;
    const welcomeEmbed = new EmbedBuilder()
        .setTitle(`Welcome to ${member.guild.name}!`)
        .setDescription(welcomeDescription)
        .setColor(config.embedColor || "#1B1464")
        .setThumbnail(member.user.displayAvatarURL())
        .setImage("https://cdn.discordapp.com/attachments/1435964396408148088/1435964470223441970/welcome.png?ex=69112d60&is=690fdbe0&hm=c26fc9f6548e13fb49b324b3bc52e33c37ae92e3a183cc3af8916692e676f092") // <-- GANTI DENGAN URL GAMBARMU
        .setTimestamp();
    const welcomeMessage = {
        content: `Hi <@${member.id}>, Welcome to Mooncrest Expedition.`,
        embeds: [welcomeEmbed]
    };
    console.log(`[WELCOME DEBUG] Mencoba mengirim pesan ke ${channelIds.length} channel...`);
    for (const id of channelIds) {
        const channel = member.guild.channels.cache.get(id);
        if (channel) {
            try {
                await channel.send(welcomeMessage);
                console.log(`[WELCOME DEBUG] SUKSES mengirim pesan ke channel ${id}`);
            } catch (err) {
                console.error(`[WELCOME DEBUG] GAGAL mengirim ke channel ${id}: ${err.message}`);
            }
        } else {
            console.warn(`[WELCOME DEBUG] Channel ID ${id} tidak ditemukan.`);
        }
    }
});
// --- [AKHIR WELCOME] ---


// --- [HANDLER AUDIT LOGS] ---
async function sendAuditLog(guild, embed) {
    const channelId = config.auditLogChannelId;
    if (!channelId) return;
    try {
        const channel = await guild.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
            await channel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error(`[AuditLog] Failed to send log: ${err.message}`);
    }
}
client.on("guildMemberRemove", async (member) => {
    if (member.guild.id !== config.guildId) return;
    if (member.user.bot) return; 
    const embed = new EmbedBuilder()
        .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();
    await new Promise(resolve => setTimeout(resolve, 1000)); 
    const banLog = await member.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberBanAdd,
        limit: 1
    }).catch(() => null);
    if (banLog && banLog.entries.first()?.target.id === member.id) {
        const entry = banLog.entries.first();
        embed.setColor("#FF0000")
             .setTitle("Member Banned")
             .setDescription(`${member.user} was banned.`)
             .addFields(
                 { name: "Moderator", value: `${entry.executor}` },
                 { name: "Reason", value: entry.reason || "No reason provided." }
             );
        return sendAuditLog(member.guild, embed);
    }
    const kickLog = await member.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberKick,
        limit: 1
    }).catch(() => null);
    if (kickLog && kickLog.entries.first()?.target.id === member.id) {
        const entry = kickLog.entries.first();
        embed.setColor("#FFA500")
             .setTitle("Member Kicked")
             .setDescription(`${member.user} was kicked.`)
             .addFields(
                 { name: "Moderator", value: `${entry.executor}` },
                 { name: "Reason", value: entry.reason || "No reason provided." }
             );
        return sendAuditLog(member.guild, embed);
    }
    embed.setColor("#F0E68C")
         .setTitle("Member Left")
         .setDescription(`${member.user} left the server.`);
    return sendAuditLog(member.guild, embed);
});
client.on("guildMemberUpdate", async (oldMember, newMember) => {
    if (newMember.guild.id !== config.guildId) return;
    if (newMember.user.bot) return; 
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    if (oldRoles.size === newRoles.size) return; 
    const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
    const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));
    if (addedRoles.size === 0 && removedRoles.size === 0) return; 
    const embed = new EmbedBuilder()
        .setColor("#00BFFF")
        .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
        .setTitle("Member Roles Updated")
        .setTimestamp()
        .setFooter({ text: `User ID: ${newMember.id}` });
    if (addedRoles.size > 0) {
        embed.addFields({ name: "Roles Added", value: addedRoles.map(r => r.name).join(", ") });
    }
    if (removedRoles.size > 0) {
        embed.addFields({ name: "Roles Removed", value: removedRoles.map(r => r.name).join(", ") });
    }
    return sendAuditLog(newMember.guild, embed);
});
client.on("messageDelete", async (message) => {
    if (message.partial) {
        const embed = new EmbedBuilder()
            .setColor("#9932CC")
            .setTitle("Old Message Deleted")
            .setDescription(`An uncached message was deleted in ${message.channel}.`)
            .setTimestamp();
        return sendAuditLog(message.guild, embed);
    }
    if (message.guild.id !== config.guildId) return;
    if (message.author.bot) return; 
    const embed = new EmbedBuilder()
        .setColor("#9932CC")
        .setTitle("Message Deleted")
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
        .setDescription(`Message sent by ${message.author} deleted in ${message.channel}.`)
        .addFields({ name: "Content", value: message.content || "No content (e.g., embed or image)." })
        .setTimestamp()
        .setFooter({ text: `Author ID: ${message.author.id} | Msg ID: ${message.id}` });
    return sendAuditLog(message.guild, embed);
});
// --- [AKHIR AUDIT LOGS] ---


// ----------------- Login -----------------
client.login(process.env.TOKEN).catch(err => console.error("Login error:", err));
