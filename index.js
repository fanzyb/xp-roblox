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
import fetch from "node-fetch"; 
import { randomUUID } from "crypto"; 

// ==================================================================
//  🤖 KONFIGURASI GEMINI AI (WAJIB DIISI)
//  Paste API Key di sini.
// ==================================================================
const GEMINI_API_KEY = "PASTE_API_KEY_HERE"; 
// ==================================================================

// Import modules
import config from "./src/config.json" with { type: "json" };
import { getRobloxGroupData, getLevel, syncRankRole, achievementsConfig, getRobloxUser } from "./src/utils/helpers.js"; 
import { handleComponentInteraction } from "./src/utils/components.js"; 
import { 
    getLastAnnouncedMilestone, 
    setLastAnnouncedMilestone,
    findUserByDiscordId,
    findUser,
    saveUser,
    saveWarning
} from "./src/db/firestore.js"; 
import { sendModLog } from "./src/utils/modLogger.js";

import { handleTempVoiceInteraction, generateControlPanelEmbed } from "./src/utils/tempVoiceHandler.js";
import { handleSelfRoleMenu } from "./src/utils/selfRoleHandler.js";
import { handleComponent as verifyHandleComponent, handleModalSubmit as verifyHandleModal } from "./src/commands/verify.js";
import { handleTicketButton, handleTicketModal } from "./src/commands/ticket.js";
import { handleModalSubmit as messageHandleModal } from "./src/commands/message.js";

dotenv.config();
import "./src/db/firestore.js"; 

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message]
});

// --- Command Handler ---
client.commands = new Collection();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandsPath = path.join(__dirname, "src", "commands");

async function loadCommands(directory) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) await loadCommands(fullPath); 
        else if (file.endsWith(".js")) {
            const relativePath = path.relative(__dirname, fullPath).replace(/\\/g, '/');
            const command = await import(`./${relativePath}`); 
            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
                console.log(`[CMD Load] Loaded: ${command.data.name}`);
            }
        }
    }
}

// --- Milestone Checker ---
async function checkMilestones() {
    const groupData = await getRobloxGroupData(); 
    if (!groupData || groupData.memberCount === 0) return;
    const currentMembers = groupData.memberCount;
    const lastAnnounced = await getLastAnnouncedMilestone(); 
    const milestones = config.memberCountMilestones || [];
    const nextMilestone = milestones.find(m => m > lastAnnounced);
    if (nextMilestone && currentMembers >= nextMilestone) {
        const channel = client.channels.cache.get(config.milestoneChannelId);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle("🎉 Milestone Reached!")
                .setDescription(`Hit **${nextMilestone.toLocaleString()}** members!`)
                .setColor(config.embedColor || "#1B1464");
            try { await channel.send({ content: "@everyone", embeds: [embed] }); await setLastAnnouncedMilestone(nextMilestone); } catch (e) {}
        }
    }
}

client.on("clientReady", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    if (client.guilds.cache.size) await loadCommands(commandsPath);
    checkMilestones(); setInterval(checkMilestones, 3600000);
    setInterval(async () => { const d = await getRobloxGroupData(); client.user.setPresence({ activities: [{ name: `${d.name}: ${d.memberCount}`, type: 3 }] }); }, 600000);
});

client.on("interactionCreate", async (i) => {
    try {
        if (i.isStringSelectMenu()) { if (i.customId.startsWith('selfrole_')) return await handleSelfRoleMenu(i); if (i.customId.startsWith('reward_')) return await handleComponentInteraction(i); }
        if (i.isButton()) { if (i.customId.startsWith('verify_')) return await verifyHandleComponent(i); if (i.customId.startsWith('lb_')) return await handleComponentInteraction(i); if (i.customId.startsWith('ticket_')) return await handleTicketButton(i); if (i.customId.startsWith('tv_')) return await handleTempVoiceInteraction(i); }
        if (i.isModalSubmit()) { if (i.customId === 'verify_modal_submit') return await verifyHandleModal(i); if (i.customId === 'send_message_modal') return await messageHandleModal(i); if (i.customId.startsWith('ticket_')) return await handleTicketModal(i); if (i.customId.startsWith('tv_')) return await handleTempVoiceInteraction(i); }
        if (i.isChatInputCommand()) await client.commands.get(i.commandName)?.execute(i);
    } catch (e) { console.error(e); }
});

// Temp Voice & Logs
const tempCreations = new Set();
client.on("voiceStateUpdate", async (o, n) => {
    if (n.channelId === config.tempVoiceCreateChannelId && !tempCreations.has(n.member.id)) {
        tempCreations.add(n.member.id); try { const c = await n.guild.channels.create({name: `${n.member.user.username}'s Channel`, type: 2, parent: config.tempVoiceCategoryId, permissionOverwrites: [{id: n.member.id, allow: [16n]}]}); await n.member.voice.setChannel(c); c.send(generateControlPanelEmbed()); } catch{} finally { tempCreations.delete(n.member.id); }
    }
    if (o.channel?.members.size===0 && o.channel.parentId===config.tempVoiceCategoryId && o.channelId!==config.tempVoiceCreateChannelId) try{await o.channel.delete()}catch{}
});
client.on("guildMemberAdd", m => { if(!m.user.bot && m.guild.id===config.guildId) m.guild.channels.cache.get(config.welcomeChannelIds?.[0])?.send(`Welcome <@${m.id}>!`); });
const audit = (g,e) => g.channels.cache.get(config.auditLogChannelId)?.send({embeds:[e]}).catch(()=>{});
client.on("guildMemberRemove", m => { if(m.guild.id===config.guildId) audit(m.guild, new EmbedBuilder().setTitle("Left").setDescription(m.user.tag).setColor("Red")); });
client.on("messageDelete", m => { if(!m.partial && m.guild.id===config.guildId) audit(m.guild, new EmbedBuilder().setTitle("Deleted").setDescription(m.content).setColor("Orange")); });

// Load Manual Book
let manualBookContent = "";
try { manualBookContent = fs.readFileSync("./manual_book.txt", "utf8"); } catch (err) { manualBookContent = "Gunakan pengetahuan umum."; }

// =====================================================
//  🛠️ SUPER TOOLS
// =====================================================
const GEMINI_TOOLS = [
    {
        function_declarations: [
            {
                name: "manage_xp_roblox",
                description: "Manage XP using Roblox Usernames. Call this when user provides a list of Roblox names (e.g. from screenshot).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", enum: ["add", "remove", "set", "bonus"] },
                        roblox_usernames: { 
                            type: "ARRAY", 
                            items: { type: "STRING" },
                            description: "List of PURE Roblox Usernames (without '@'). Example: ['Builderman', 'Roblox'] not ['@Builderman']." 
                        },
                        amount: { type: "INTEGER" },
                        reason: { type: "STRING" }
                    },
                    required: ["action", "roblox_usernames", "amount"]
                }
            }
        ]
    },
    {
        function_declarations: [
            {
                name: "manage_xp_discord",
                description: "Manage XP using Discord Mentions/IDs.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", enum: ["add", "remove", "set", "bonus"] },
                        user_ids: { type: "ARRAY", items: { type: "STRING" } },
                        amount: { type: "INTEGER" },
                        reason: { type: "STRING" }
                    },
                    required: ["action", "user_ids", "amount"]
                }
            }
        ]
    },
    { function_declarations: [{ name: "manage_moderation", description: "Warn/Mute.", parameters: { type: "OBJECT", properties: { action: { type: "STRING", enum: ["warn", "mute"] }, user_id: { type: "STRING" }, reason: { type: "STRING" }, duration_minutes: { type: "INTEGER" } }, required: ["action", "user_id", "reason"] } }] },
    { function_declarations: [{ name: "manage_reward", description: "Give/Remove achievement.", parameters: { type: "OBJECT", properties: { action: { type: "STRING", enum: ["give", "remove"] }, user_id: { type: "STRING" }, achievement_name_keyword: { type: "STRING" } }, required: ["action", "user_id", "achievement_name_keyword"] } }] }
];

// ==========================================
//  🤖 GEMINI AI HANDLER
// ==========================================
async function askGemini(prompt, history = [], message, imagePart = null) {
    let apiKey = GEMINI_API_KEY;
    if (!apiKey || apiKey.includes("MASUKKAN_KEY")) return "❌ **Config Error:** API Key kosong!";
    apiKey = apiKey.trim();

    const modelName = "gemini-2.5-flash"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const isInterviewChannel = message.channel.name.toLowerCase().includes("interview");
    let systemPrompt = "";

    if (isInterviewChannel) {
        systemPrompt = `ROLE: Senior Guide Interviewer.\nMANUAL: """${manualBookContent}"""\nRULES: Max 5 questions. One by one. Stop if pass/fail. JAWAB DALAM BAHASA INDONESIA.`;
    } else {
        // --- [UPDATE PROMPT AGAR LEBIH PINTAR BACA GAMBAR] ---
        systemPrompt = `
        ROLE: Kamu adalah AI Admin & Asisten Komunitas 'Mooncrest Expedition'.
        
        ATURAN UTAMA (BAHASA):
        - JIKA user chat Bahasa Indonesia -> JAWAB INDONESIA.
        - JIKA user chat English -> Answer English.
        - JIKA user chat campur -> Jawab santai (gaul).

        ATURAN BACA GAMBAR ROBLOX (PENTING):
        1. Di Roblox, Username asli SELALU diawali tanda '@' (Contoh: @Ryunesse).
        2. Teks yang TIDAK ada '@' biasanya cuma Display Name (Contoh: Ryun). Display Name BISA SAMA, Username UNIK.
        3. TUGAS KAMU: Cari teks yang ada '@' nya. Ambil teks setelah '@' sebagai Username.
        4. CONTOH: Gambar ada tulisan "Ryun (@Ryunesse)". Maka Username = "Ryunesse". Display Name = "Ryun".
        5. SAAT KONFIRMASI KE USER: Tulis formatnya: "@Username (Display Name)".
        6. SAAT PANGGIL TOOL 'manage_xp_roblox': Kirim Username TANPA tanda '@'.

        ATURAN LAIN:
        - Jika user minta add XP, panggil tool yang sesuai.
        - Hanya user VERIFIED yang bisa dapat XP (Tool akan mengeceknya).
        `;
    }

    const contents = history.map(h => ({ role: h.role === "bot" ? "model" : "user", parts: [{ text: h.message }] }));
    const userParts = [{ text: prompt }];
    if (imagePart) { userParts.push(imagePart); userParts[0].text += "\n[System: Image attached. Please analyze Roblox Leaderboard/Player List.]"; }
    contents.push({ role: "user", parts: userParts });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: contents, tools: isInterviewChannel ? [] : GEMINI_TOOLS, systemInstruction: { parts: [{ text: systemPrompt }] } })
        });

        if (!response.ok) {
            const errText = await response.text();
            return `⚠️ API Error ${response.status}: ${errText}`;
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        if (!candidate) return "🤔 (No Response)";

        const functionCalls = candidate.content?.parts?.filter(part => part.functionCall);
        if (functionCalls && functionCalls.length > 0) {
            let resultLog = [];
            for (const callPart of functionCalls) {
                const fn = callPart.functionCall;
                const args = fn.args;
                
                if (fn.name === "manage_xp_roblox") resultLog.push(await performBatchXpRoblox(args, message));
                else if (fn.name === "manage_xp_discord") resultLog.push(await performBatchXpDiscord(args, message));
                else if (fn.name === "manage_moderation") resultLog.push(await performModeration(args, message));
                else if (fn.name === "manage_reward") resultLog.push(await performReward(args, message));
            }
            return resultLog.join("\n\n");
        }

        return candidate.content?.parts?.[0]?.text || "";

    } catch (error) {
        console.error("[Gemini Error]", error);
        return "❌ System Error.";
    }
}

// --- EKSEKUTOR ROBLOX USERNAME (LOGGED) ---
async function performBatchXpRoblox(args, message) {
    const { action, roblox_usernames, amount, reason } = args;
    if (!roblox_usernames?.length) return "⚠️ No usernames detected.";
    
    const member = message.member;
    const allowed = config.xpManagerRoles || [];
    if (!member.permissions.has(PermissionFlagsBits.Administrator) && !member.roles.cache.some(r => allowed.includes(r.id))) return `⛔ No Permission.`;

    let success = [], notFound = [];
    for (let name of roblox_usernames) {
        // Bersihkan @ kalau AI lupa hapus
        name = name.replace("@", "").trim();
        
        try {
            const rData = await getRobloxUser(name);
            if (!rData) { notFound.push(name); continue; }
            let user = await findUser(rData.id.toString());
            if (!user) { notFound.push(`${name} (Unverified)`); continue; }
            
            const oldLvl = getLevel(user.xp).levelName;
            if (action === "add") { user.xp += amount; user.expeditions++; }
            else if (action === "remove") { user.xp = Math.max(user.xp-amount,0); user.expeditions = Math.max(user.expeditions-1,0); }
            else if (action === "set") user.xp = amount;
            else if (action === "bonus") user.xp += amount;
            
            await saveUser(user); success.push(user.robloxUsername);
            if (user.discordId && getLevel(user.xp).levelName !== oldLvl) { const gm = await message.guild.members.fetch(user.discordId).catch(()=>{}); if(gm) await syncRankRole(gm, user.xp); }
        } catch { notFound.push(name); }
    }

    // Log ke Channel
    const logChannel = message.guild.channels.cache.get(config.xpLogChannelId);
    if (logChannel && success.length > 0) {
        logChannel.send({ embeds: [new EmbedBuilder().setTitle(`🤖 AI XP Log (${action.toUpperCase()})`).setDescription(`**Target:** ${success.join(", ")}\n**Amount:** ${amount}\n**Reason:** ${reason||"-"}`).setColor(config.embedColor||"Green").setFooter({text:`By ${message.author.tag}`}).setTimestamp()] }).catch(()=>{});
    }

    let reply = `✅ **AI Action:** ${action} ${amount} XP ke **${success.length}** user.`;
    if (success.length) reply += `\n✅ **Sukses:** ${success.join(", ")}`;
    if (notFound.length) reply += `\n⚠️ **Gagal/Unverified:** ${notFound.join(", ")}`;
    return reply;
}

// --- EKSEKUTOR DISCORD MENTION (LOGGED) ---
async function performBatchXpDiscord(args, message) {
    const { action, user_ids, amount, reason } = args;
    if (!user_ids?.length) return "⚠️ No users.";
    const member = message.member;
    const allowed = config.xpManagerRoles || [];
    if (!member.permissions.has(PermissionFlagsBits.Administrator) && !member.roles.cache.some(r => allowed.includes(r.id))) return `⛔ No Permission.`;

    let names = [];
    for (const uid of user_ids) {
        try {
            const userDb = await findUserByDiscordId(uid);
            if (!userDb || !userDb.isVerified) continue;
            let user = userDb;
            const oldLvl = getLevel(user.xp).levelName;
            if (action === "add") { user.xp += amount; user.expeditions++; }
            else if (action === "remove") { user.xp = Math.max(user.xp-amount,0); user.expeditions = Math.max(user.expeditions-1,0); }
            else if (action === "set") user.xp = amount;
            else if (action === "bonus") user.xp += amount;
            await saveUser(user); names.push(user.robloxUsername);
            if (getLevel(user.xp).levelName !== oldLvl) { const gm = await message.guild.members.fetch(uid).catch(()=>{}); if(gm) await syncRankRole(gm, user.xp); }
        } catch {}
    }

    // Log ke Channel
    const logChannel = message.guild.channels.cache.get(config.xpLogChannelId);
    if (logChannel && names.length > 0) {
        logChannel.send({ embeds: [new EmbedBuilder().setTitle(`🤖 AI XP Log (${action.toUpperCase()})`).setDescription(`**Target:** ${names.join(", ")}\n**Amount:** ${amount}\n**Reason:** ${reason||"-"}`).setColor(config.embedColor||"Green").setFooter({text:`By ${message.author.tag}`}).setTimestamp()] }).catch(()=>{});
    }

    return `✅ **AI Action:** ${action} ${amount} XP ke ${names.join(", ")}.`;
}

async function performModeration(args, message) {
    const { action, user_id, reason, duration_minutes } = args;
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return `⛔ No Permission.`;
    const target = await message.guild.members.fetch(user_id).catch(() => null);
    if (!target) return "⚠️ User not found.";
    if (action === "warn") {
        const cid = randomUUID().substring(0, 8); await saveWarning(target.id, message.guild.id, message.author.id, reason, cid);
        target.send(`⚠️ Warned: ${reason}`).catch(()=>{}); sendModLog(message.guild, "Warned (AI)", "Yellow", target.user, message.author, reason, [{name:"Case",value:cid}]);
        return `🛡️ Warned ${target.user.tag}.`;
    }
    if (action === "mute") {
        const mins = duration_minutes || 10; try { await target.timeout(mins*60000, reason); sendModLog(message.guild, "Muted (AI)", "Orange", target.user, message.author, reason, [{name:"Time",value:`${mins}m`}]); return `🔇 Muted ${target.user.tag}.`; } catch { return "❌ Failed mute."; }
    }
}
async function performReward(args, message) {
    const { action, user_id, achievement_name_keyword } = args;
    const allowed = config.rewardManagerRoles || [];
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && !message.member.roles.cache.some(r => allowed.includes(r.id))) return `⛔ No Permission.`;
    const userDb = await findUserByDiscordId(user_id); if (!userDb) return "⚠️ User not verified.";
    const achv = achievementsConfig.find(a => a.name.toLowerCase().includes(achievement_name_keyword.toLowerCase())); if (!achv) return "⚠️ Achv not found.";
    let user = userDb;
    if (action === "give") { if (!user.achievements.includes(achv.id)) { user.achievements.push(achv.id); await saveUser(user); if (achv.roleId) message.guild.members.fetch(user_id).then(m=>m.roles.add(achv.roleId)).catch(()=>{}); return `🏆 Given ${achv.name}`; } return "ℹ️ Had it."; }
    else { user.achievements = user.achievements.filter(id => id !== achv.id); await saveUser(user); if (achv.roleId) message.guild.members.fetch(user_id).then(m=>m.roles.remove(achv.roleId)).catch(()=>{}); return `🗑️ Removed ${achv.name}`; }
}

// --- Event Listener Chat AI ---
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const isInterview = message.channel.name.toLowerCase().includes("interview");
    let isReply = false;
    if (message.reference) { try { const ref = await message.fetchReference(); if (ref.author.id === client.user.id) isReply = true; } catch {} }
    const hasPrefix = message.content.toLowerCase().startsWith("!ai");
    const hasImage = message.attachments.size > 0;

    if (hasPrefix || isReply || (isInterview && !message.content.startsWith("//")) || (hasImage && (hasPrefix || isReply))) {
        await message.channel.sendTyping();
        
        let prompt = message.content;
        if (hasPrefix) prompt = prompt.slice(3).trim();
        if (!prompt && !hasImage && !isInterview) return message.reply("?");

        let history = [];
        const limit = isInterview ? 20 : 15; 
        try {
            const msgs = await message.channel.messages.fetch({ limit: limit + 1 });
            msgs.reverse().forEach(m => {
                if (m.id !== message.id && !m.content.startsWith("//") && !m.content.startsWith("!ai")) {
                    history.push({ role: m.author.id === client.user.id ? "bot" : "user", message: m.content });
                }
            });
        } catch {}

        let imagePart = null;
        if (hasImage) {
            try {
                const imgUrl = message.attachments.first().url;
                const imgRes = await fetch(imgUrl);
                const imgBuf = await imgRes.arrayBuffer();
                imagePart = { inline_data: { mime_type: message.attachments.first().contentType || "image/png", data: Buffer.from(imgBuf).toString("base64") } };
            } catch (e) { console.error("Image fail:", e); }
        }

        const ans = await askGemini(prompt, history, message, imagePart);
        if (ans) {
            const chunks = ans.match(/[\s\S]{1,1900}/g) || [];
            for (const c of chunks) await message.reply(c);
        }
    }
});

client.login(process.env.TOKEN).catch(console.error);
