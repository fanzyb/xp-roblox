import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import dotenv from "dotenv";

// Import modules
import config from "./src/config.json" with { type: "json" };
import { getRobloxGroupData } from "./src/utils/helpers.js";
import { handleComponentInteraction } from "./src/utils/components.js";
import { getLastAnnouncedMilestone, setLastAnnouncedMilestone } from "./src/db/firestore.js";

// Import Command Handlers
import { data as xpCommand, execute as xpExecute } from "./src/commands/xp.js";
import { data as expoCommand, execute as expoExecute } from "./src/commands/expo.js";
import { data as rankCommand, execute as rankExecute } from "./src/commands/rank.js";
import { data as lbCommand, execute as lbExecute } from "./src/commands/leaderboard.js";
import { data as transcriptCommand, execute as transcriptExecute } from "./src/commands/transcript.js";
import { data as rewardCommand, execute as rewardExecute } from "./src/commands/reward.js";
import { data as hofCommand, execute as hofExecute } from "./src/commands/hallOfFame.js";
import { data as listRewardCommand, execute as listRewardExecute } from "./src/commands/listReward.js";
import { data as debugCommand, execute as debugExecute } from "./src/commands/debug.js";
import { data as xpdCommand, execute as xpdExecute } from "./src/commands/xpd.js";
import { data as expodCommand, execute as expodExecute } from "./src/commands/expod.js";
import { data as linkCommand, execute as linkExecute } from "./src/commands/link.js";
import { data as verifyCommand, execute as verifyExecute, handleComponent as verifyHandleComponent, handleModalSubmit as verifyHandleModal } from "./src/commands/verify.js";
import { data as getroleCommand, execute as getroleExecute } from "./src/commands/getrole.js";


dotenv.config();
import "./src/db/firestore.js"; 

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// --- Logika Pengecekan Milestone ---
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
            .setColor("#1B1464")
            // [PERBAIKAN] Gunakan '?? null' untuk memastikan nilai null dikirim jika tidak ada ikon
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

// ----------------- Event: ready -----------------
client.on("ready", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    const guild = client.guilds.cache.first();

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

    const commands = [
        xpCommand, expoCommand, rankCommand, lbCommand, rewardCommand, 
        hofCommand, listRewardCommand, debugCommand,
        linkCommand, verifyCommand, xpdCommand, expodCommand, getroleCommand, transcriptCommand
    ];

    if (guild) {
        await guild.commands.set(commands);
        console.log(`✅ Slash commands registered locally on ${guild.name}`);
    } else {
        await client.application.commands.set(commands);
        console.log("✅ Slash commands registered globally");
    }

    checkMilestones();
    setInterval(checkMilestones, 1000 * 60 * 60);
});

// ----------------- Event: interactionCreate -----------------
client.on("interactionCreate", async (interaction) => {
    try {
        if (interaction.isStringSelectMenu() || interaction.isButton()) {
            if (interaction.customId.startsWith('verify_')) {
                return verifyHandleComponent(interaction);
            }
            if (interaction.customId.startsWith('lb_') || interaction.customId.startsWith('reward_')) {
                return handleComponentInteraction(interaction);
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'verify_modal_submit') {
                return verifyHandleModal(interaction);
            }
        }

        if (!interaction.isChatInputCommand()) return;

        const command = interaction.commandName;

        switch (command) {
            case "xp": await xpExecute(interaction); break;
            case "xpd": await xpdExecute(interaction); break;
            case "expo": await expoExecute(interaction); break;
            case "expod": await expodExecute(interaction); break;
            case "transcript": await transcriptExecute(interaction); break;
            case "rank": await rankExecute(interaction); break;
            case "getrole": await getroleExecute(interaction);break;
            case "leaderboard": await lbExecute(interaction); break;
            case "reward": await rewardExecute(interaction); break;
            case "hall-of-fame": await hofExecute(interaction); break;
            case "list-reward": await listRewardExecute(interaction); break;
            case "debug": await debugExecute(interaction); break;
            case "link": await linkExecute(interaction); break;
            case "verify": await verifyExecute(interaction); break;
            default:
                await interaction.reply({ content: "❌ Unknown command.", ephemeral: true });
                break;
        }
    } catch (err) {
        console.error("Interaction handler error:", err);
        if (interaction.replied || interaction.deferred) {
            try { await interaction.editReply({ content: "❌ An error occurred." }); } catch {}
        } else {
            try { await interaction.reply({ content: "❌ An error occurred." }); } catch {}
        }
    }
});

// ----------------- Login -----------------
client.login(process.env.TOKEN).catch(err => console.error("Login error:", err));
