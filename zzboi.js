// // index.js
// const {
//   Client,
//   GatewayIntentBits,
//   REST,
//   Routes,
//   EmbedBuilder,
//   ActionRowBuilder,
//   ButtonBuilder,
//   ButtonStyle,
//   SlashCommandBuilder,
//   PermissionsBitField,
//   ModalBuilder,
//   TextInputBuilder,
//   TextInputStyle,
//   MessageFlags, // Import MessageFlags for explicit flag usage (optional, but suppresses warning)
// } = require("discord.js");
// const dotenv = require("dotenv");
// const path = require("path");
// const { Octokit } = require("octokit");

// dotenv.config();

// // --- CONFIG ---
// const PING_CHANNEL_ID = "1312425724736704562"; // Replace with your actual ping channel ID
// const BUTTON_COOLDOWN_SECONDS = 5;
// // DATA_FILE is kept for potential future local fallback, but GitHub is primary
// const DATA_FILE = path.join(__dirname, "galas.json");

// // --- INIT CLIENT ---
// const client = new Client({
//   intents: [
//     GatewayIntentBits.Guilds,
//     GatewayIntentBits.GuildMessages,
//     GatewayIntentBits.MessageContent, // Make sure this intent is enabled in your bot's settings
//     GatewayIntentBits.GuildMembers,
//   ],
// });

// // --- STATE ---
// const galas = new Map();
// const completedGalas = new Map();
// const buttonCooldowns = new Map();

// // --- GITHUB ---
// const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
// const GITHUB_REPO = process.env.GITHUB_REPO; // Format: owner/repo_name
// const GITHUB_FILE_PATH = process.env.GITHUB_FILE_PATH || "galas.json";

// if (!GITHUB_REPO) {
//   console.error("❌ Missing GITHUB_REPO in .env");
//   process.exit(1);
// }
// if (!process.env.GITHUB_TOKEN) {
//   console.error("❌ Missing GITHUB_TOKEN in .env");
//   process.exit(1);
// }
// if (!process.env.DISCORD_TOKEN) {
//   console.error("❌ Missing DISCORD_TOKEN in .env");
//   process.exit(1);
// }
// if (!process.env.CLIENT_ID) {
//   console.error("❌ Missing CLIENT_ID in .env");
//   process.exit(1);
// }
// if (!process.env.GUILD_ID) {
//   console.error("❌ Missing GUILD_ID in .env");
//   process.exit(1);
// }

// // --- COMMANDS ---
// const commands = [
//   new SlashCommandBuilder()
//     .setName("plan")
//     .setDescription("Schedule a new gala event using a pop-up form")
//     .addStringOption((option) =>
//       option
//         .setName("date")
//         .setDescription("When? Format: DDMMYYYY (e.g., 24082025)")
//         .setRequired(true)
//     ),

//   new SlashCommandBuilder()
//     .setName("tweak")
//     .setDescription("Edit your gala's name or details")
//     .addStringOption((option) =>
//       option
//         .setName("gala-id")
//         .setDescription("Gala date (ID)")
//         .setRequired(true)
//     )
//     .addStringOption((option) =>
//       option.setName("new-title").setDescription("New name for the gala")
//     )
//     .addStringOption((option) =>
//       option.setName("new-details").setDescription("New description")
//     ),

//   new SlashCommandBuilder()
//     .setName("open-doors")
//     .setDescription("Open sign-ups for your gala")
//     .addStringOption((option) =>
//       option.setName("gala-id").setDescription("Which gala?").setRequired(true)
//     ),

//   new SlashCommandBuilder()
//     .setName("close-doors")
//     .setDescription("Close sign-ups for your gala")
//     .addStringOption((option) =>
//       option.setName("gala-id").setDescription("Which gala?").setRequired(true)
//     ),

//   new SlashCommandBuilder()
//     .setName("peek")
//     .setDescription("See details of a specific gala")
//     .addStringOption((option) =>
//       option
//         .setName("gala-id")
//         .setDescription("Gala date (ID)")
//         .setRequired(true)
//     ),

//   new SlashCommandBuilder()
//     .setName("whats-on")
//     .setDescription("See all upcoming galas"),

//   new SlashCommandBuilder()
//     .setName("help")
//     .setDescription("Show all commands and how to use them!"),

//   new SlashCommandBuilder()
//     .setName("past-galas")
//     .setDescription("See all completed galas and their stats!"),

//   new SlashCommandBuilder()
//     .setName("cancel-gala")
//     .setDescription("Cancel your gala (author only)")
//     .addStringOption((option) =>
//       option
//         .setName("gala-id")
//         .setDescription("Gala date (ID)")
//         .setRequired(true)
//     ),
// ].map((command) => command.toJSON());

// const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// // --- DEPLOY COMMANDS ---
// async function deployCommands() {
//   try {
//     console.log("🔄 Refreshing commands...");
//     await rest.put(
//       Routes.applicationGuildCommands(
//         process.env.CLIENT_ID,
//         process.env.GUILD_ID
//       ),
//       { body: commands }
//     );
//     console.log("✅ Commands updated.");
//   } catch (error) {
//     console.error("❌ Command deployment error:", error);
//   }
// }

// // --- GITHUB DATA ---
// async function loadGalas() {
//   try {
//     console.log("☁️ Loading galas from GitHub...");
//     const { data } = await octokit.request(
//       "GET /repos/{owner}/{repo}/contents/{path}",
//       {
//         owner: GITHUB_REPO.split("/")[0],
//         repo: GITHUB_REPO.split("/")[1],
//         path: GITHUB_FILE_PATH,
//       }
//     );

//     const content = Buffer.from(data.content, "base64").toString("utf8");
//     const stored = JSON.parse(content);

//     if (stored.active && typeof stored.active === "object") {
//       for (const [id, gala] of Object.entries(stored.active)) {
//         if (
//           gala &&
//           typeof gala === "object" &&
//           typeof gala.title === "string" &&
//           typeof gala.id === "string"
//         ) {
//           if (!Array.isArray(gala.participants)) gala.participants = [];
//           if (
//             !["open", "closed", "completed", "cancelled"].includes(gala.status)
//           ) {
//             gala.status = "open";
//           }
//           // Ensure pingSent is initialized
//           gala.pingSent = gala.pingSent ?? false;
//           galas.set(id, gala);
//         }
//       }
//     }

//     if (stored.completed && typeof stored.completed === "object") {
//       for (const [id, gala] of Object.entries(stored.completed)) {
//         if (
//           gala &&
//           typeof gala === "object" &&
//           typeof gala.title === "string" &&
//           typeof gala.id === "string"
//         ) {
//           if (!Array.isArray(gala.participants)) gala.participants = [];
//           // Ensure completed/cancelled galas have correct status
//           if (!["completed", "cancelled"].includes(gala.status)) {
//             gala.status = "completed";
//           }
//           completedGalas.set(id, gala);
//         }
//       }
//     }

//     console.log(
//       `💾 Loaded ${galas.size} active, ${completedGalas.size} completed galas from GitHub.`
//     );
//   } catch (err) {
//     if (err.status === 404) {
//       console.log("🆕 No galas.json found on GitHub — starting fresh.");
//       await saveGalas(); // Initialize with empty data
//     } else {
//       console.error("❌ Error loading galas from GitHub:", err);
//       // Consider exiting or using a fallback here if GitHub is critical
//     }
//   }
// }

// async function saveGalas() {
//   try {
//     console.log("💾 Saving galas to GitHub...");
//     let currentSha;
//     try {
//       const { data } = await octokit.request(
//         "GET /repos/{owner}/{repo}/contents/{path}",
//         {
//           owner: GITHUB_REPO.split("/")[0],
//           repo: GITHUB_REPO.split("/")[1],
//           path: GITHUB_FILE_PATH,
//         }
//       );
//       currentSha = data.sha;
//     } catch (err) {
//       if (err.status !== 404) throw err;
//       currentSha = null; // File doesn't exist yet
//     }

//     const data = {
//       active: Object.fromEntries(galas.entries()),
//       completed: Object.fromEntries(completedGalas.entries()),
//     };

//     const content = Buffer.from(JSON.stringify(data, null, 2)).toString(
//       "base64"
//     );

//     await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
//       owner: GITHUB_REPO.split("/")[0],
//       repo: GITHUB_REPO.split("/")[1],
//       path: GITHUB_FILE_PATH,
//       message: "💾 Auto-save gala data",
//       content: content,
//       sha: currentSha, // Required if updating an existing file
//     });
//     console.log("✅ Gala data saved to GitHub.");
//   } catch (err) {
//     console.error("❌ Error saving gala data to GitHub:", err);
//     // Decide how critical this is. For now, we log and continue.
//   }
// }

// // --- HELPERS ---
// function parseDate(dateString) {
//   if (typeof dateString !== "string" || dateString.length !== 8) {
//     console.error(`Invalid date string format: ${dateString}`);
//     return new Date(NaN); // Return invalid date
//   }
//   const day = parseInt(dateString.substring(0, 2), 10);
//   const month = parseInt(dateString.substring(2, 4), 10) - 1; // JS months are 0-indexed
//   const year = parseInt(dateString.substring(4, 8), 10);
//   return new Date(year, month, day);
// }

// function createGalaEmbedAndButtons(gala) {
//   const participantList =
//     gala.participants.length > 0
//       ? gala.participants
//           .map((p, index) => `${index + 1}. <@${p.id}> (${p.username})`)
//           .join("\n")
//       : "No one has joined yet.";

//   let color = "#5865F2"; // Default
//   let statusText = `Status: ${
//     gala.status.charAt(0).toUpperCase() + gala.status.slice(1)
//   }`;

//   if (gala.status === "open") color = "#57F287";
//   if (gala.status === "closed") color = "#ED4245";
//   if (gala.status === "completed") color = "#95A5A6";
//   if (gala.status === "cancelled") {
//     color = "#ED4245";
//     statusText = "Status: Cancelled";
//   }

//   const embed = new EmbedBuilder()
//     .setColor(color)
//     .setTitle(gala.title)
//     .setDescription(gala.details || "No description provided.")
//     .addFields({
//       name: `✅ Attendees (${gala.participants.length})`,
//       value: participantList,
//       inline: false,
//     })
//     .setFooter({
//       text: `Gala ID: ${gala.id} | ${statusText} | Created by: ${gala.authorUsername}`,
//     });

//   // Only show buttons if the gala is open or closed (active)
//   const showButtons = ["open", "closed"].includes(gala.status);
//   if (showButtons) {
//     const buttons = new ActionRowBuilder().addComponents(
//       new ButtonBuilder()
//         .setCustomId(`join-gala_${gala.id}`)
//         .setLabel("Join Gala")
//         .setStyle(ButtonStyle.Success)
//         .setDisabled(gala.status !== "open"),
//       new ButtonBuilder()
//         .setCustomId(`leave-gala_${gala.id}`)
//         .setLabel("Leave Gala")
//         .setStyle(ButtonStyle.Danger)
//         .setDisabled(gala.status !== "open")
//     );
//     return {
//       embeds: [embed],
//       components: [buttons],
//     };
//   } else {
//     return {
//       embeds: [embed],
//       components: [], // No buttons for completed/cancelled
//     };
//   }
// }

// function createHelpEmbed() {
//   return new EmbedBuilder()
//     .setTitle("🎀 GALA BOT HELP")
//     .setDescription("Here's how to plan, manage, and join galas with ease!")
//     .setColor("#FF69B4")
//     .addFields(
//       {
//         name: "📅 /plan",
//         value: "`/plan date: 24082025`\n→ Opens a form to schedule a new gala.",
//         inline: false,
//       },
//       {
//         name: "✨ /tweak",
//         value:
//           '`/tweak gala-id: 24082025 new-title: "Winter Ball"`\n→ Edit your gala\'s name or details.',
//         inline: false,
//       },
//       {
//         name: "🚪 /open-doors",
//         value: "`/open-doors gala-id: 24082025`\n→ Let people join your gala.",
//         inline: false,
//       },
//       {
//         name: "🔒 /close-doors",
//         value: "`/close-doors gala-id: 24082025`\n→ Stop new sign-ups.",
//         inline: false,
//       },
//       {
//         name: "❌ /cancel-gala",
//         value:
//           "`/cancel-gala gala-id: 24082025`\n→ Cancel your gala (author only).",
//         inline: false,
//       },
//       {
//         name: "🔍 /peek",
//         value:
//           "`/peek gala-id: 24082025`\n→ See who's joined and event details.",
//         inline: false,
//       },
//       {
//         name: "🎭 /whats-on",
//         value: "`/whats-on`\n→ See all upcoming galas at a glance.",
//         inline: false,
//       },
//       {
//         name: "📜 /past-galas",
//         value: "`/past-galas`\n→ See all completed/cancelled galas.",
//         inline: false,
//       }
//     )
//     .setFooter({
//       text: "Tip: Use the Join/Leave buttons under each gala post!",
//     });
// }

// function createPastGalasEmbed() {
//   if (completedGalas.size === 0) {
//     return new EmbedBuilder()
//       .setTitle("📜 Past Galas")
//       .setDescription("No galas have been completed or cancelled yet.")
//       .setColor("#A9A9A9");
//   }

//   const sortedGalas = Array.from(completedGalas.values()).sort(
//     (a, b) => parseDate(b.id) - parseDate(a.id)
//   );
//   // Limit fields to prevent exceeding Discord limits
//   const fields = sortedGalas.slice(0, 25).map((gala) => ({
//     name: `${gala.status === "cancelled" ? "❌" : "🎉"} ${gala.title}`,
//     value: `**Date:** \`${gala.id}\`\n**Status:** ${gala.status}\n**Created by:** ${gala.authorUsername}\n**Attendees:** ${gala.participants.length}`,
//     inline: false,
//   }));

//   return new EmbedBuilder()
//     .setTitle("📜 Past Galas")
//     .setDescription(
//       `Showing ${Math.min(
//         completedGalas.size,
//         25
//       )} recent completed/cancelled galas.`
//     )
//     .setColor("#95A5A6")
//     .addFields(fields)
//     .setFooter({
//       text:
//         completedGalas.size > 25
//           ? "Oldest galas may be trimmed. Data is still saved!"
//           : "",
//     });
// }

// // --- DAILY SCHEDULER ---
// async function dailySchedulerTick() {
//   console.log("⏰ Daily scheduler tick...");
//   const today = new Date();
//   today.setHours(0, 0, 0, 0);

//   const guild = await client.guilds.fetch(process.env.GUILD_ID).catch((err) => {
//     console.error("Could not fetch guild for scheduler.", err);
//     return null;
//   });
//   if (!guild) return;

//   let needsSave = false; // Flag to check if we need to save at the end

//   for (const [galaId, gala] of galas.entries()) {
//     const galaDate = parseDate(galaId);

//     // Check if gala is today and ping hasn't been sent
//     if (galaDate.getTime() === today.getTime() && !gala.pingSent) {
//       console.log(`🎉 ${gala.title} is today! Sending ping.`);
//       try {
//         const pingChannel = await guild.channels.fetch(PING_CHANNEL_ID);
//         if (pingChannel && pingChannel.isTextBased()) {
//           await pingChannel.send({
//             content: `<@&${gala.roleId}> The gala, **${gala.title}**, is happening today! Get ready! ✨`,
//           });
//           gala.pingSent = true;
//           needsSave = true;
//         }
//       } catch (error) {
//         console.error(`Failed to ping for ${gala.id}:`, error);
//       }
//     }

//     // Check if gala date has passed and it's not already completed
//     if (galaDate < today && gala.status !== "completed") {
//       console.log(`✅ ${gala.title} ended. Archiving.`);
//       gala.status = "completed";
//       completedGalas.set(galaId, gala);
//       galas.delete(galaId);
//       needsSave = true;

//       // Cleanup role
//       try {
//         const role = await guild.roles.fetch(gala.roleId);
//         if (role) await role.delete(`Gala "${gala.title}" has ended.`);
//       } catch (error) {
//         console.warn(
//           `Could not delete role for completed gala ${gala.id}:`,
//           error
//         );
//       }

//       // Update message
//       try {
//         const channel = await guild.channels.fetch(gala.channelId);
//         if (!channel || !channel.isTextBased()) {
//           console.warn(`Invalid or inaccessible channel for gala ${gala.id}`);
//           continue;
//         }
//         const message = await channel.messages.fetch(gala.messageId);
//         if (message) {
//           await message.edit(createGalaEmbedAndButtons(gala));
//         } else {
//           console.warn(`Message not found for gala ${gala.id}`);
//         }
//       } catch (error) {
//         console.warn(`Cleanup failed for ${gala.id}:`, error);
//       }
//     }
//   }

//   // Save only if changes were made
//   if (needsSave) {
//     await saveGalas();
//   }
// }

// // --- EVENTS ---
// // Fix 1: Use 'clientReady' instead of 'ready'
// client.once("clientReady", (c) => {
//   console.log(`🚀 Bot online as ${c.user.tag}`);
//   // Run scheduler once on startup
//   dailySchedulerTick().catch(console.error);
//   // Then run it every minute
//   setInterval(() => {
//     dailySchedulerTick().catch(console.error);
//   }, 60000); // 60 seconds
// });

// client.on("error", (err) => {
//   console.error("⚠️ Global Client Error:", err);
// });

// client.on("interactionCreate", async (interaction) => {
//   if (!interaction.inGuild()) return;

//   try {
//     if (interaction.isChatInputCommand()) {
//       const { commandName } = interaction;

//       if (commandName === "help") {
//         // Help is public, no defer needed for simple reply
//         await interaction.reply({ embeds: [createHelpEmbed()] });
//         return;
//       }

//       if (commandName === "past-galas") {
//         // Past galas can be a bit slower, defer
//         await interaction.deferReply(); // Public by default unless ephemeral is set
//         const pastEmbed = createPastGalasEmbed();
//         await interaction.editReply({ embeds: [pastEmbed] });
//         return;
//       }

//       if (commandName === "cancel-gala") {
//         // Author-only action, ephemeral feedback
//         await interaction.deferReply({ ephemeral: true });
//         const galaId = interaction.options.getString("gala-id");
//         if (!galas.has(galaId)) {
//           return interaction.editReply({
//             content: `❌ No active gala found with ID \`${galaId}\`.`,
//           });
//         }

//         const gala = galas.get(galaId);
//         if (interaction.user.id !== gala.authorId) {
//           return interaction.editReply({
//             content: "❌ Only the creator can cancel this gala.",
//           });
//         }

//         gala.status = "cancelled";
//         completedGalas.set(galaId, gala);
//         galas.delete(galaId);

//         // Cleanup role
//         try {
//           const role = await interaction.guild.roles.fetch(gala.roleId);
//           if (role) await role.delete("Gala cancelled by author.");
//         } catch (err) {
//           console.warn(
//             `Could not delete role for cancelled gala ${gala.id}:`,
//             err
//           );
//         }

//         // Update message
//         try {
//           const channel = await client.channels.fetch(gala.channelId);
//           if (!channel || !channel.isTextBased()) {
//             throw new Error("Channel not found or not text-based");
//           }
//           const message = await channel.messages.fetch(gala.messageId);
//           await message.edit(createGalaEmbedAndButtons(gala));
//         } catch (err) {
//           console.warn(
//             `Could not update message for cancelled gala ${gala.id}:`,
//             err
//           );
//         }

//         await saveGalas();

//         return interaction.editReply({
//           content: `✅ Gala "**${gala.title}**" has been cancelled.`,
//         });
//       }

//       if (commandName === "plan") {
//         const date = interaction.options.getString("date");

//         if (!/^\d{8}$/.test(date)) {
//           return interaction.reply({
//             content: "❌ Invalid date. Use DDMMYYYY (e.g., 24082025).",
//             ephemeral: true, // Fix 2: Use ephemeral correctly
//           });
//         }

//         const galaDate = parseDate(date);
//         const today = new Date();
//         today.setHours(0, 0, 0, 0);
//         if (isNaN(galaDate.getTime()) || galaDate < today) {
//           return interaction.reply({
//             content: "❌ Can't schedule in the past or invalid date.",
//             ephemeral: true,
//           });
//         }

//         if (galas.has(date) || completedGalas.has(date)) {
//           return interaction.reply({
//             content: `❌ A gala with ID \`${date}\` already exists.`,
//             ephemeral: true,
//           });
//         }

//         const modal = new ModalBuilder()
//           .setCustomId(`plan-gala-modal_${date}`)
//           .setTitle("Plan a New Gala");

//         const titleInput = new TextInputBuilder()
//           .setCustomId("gala-title")
//           .setLabel("Gala Title")
//           .setStyle(TextInputStyle.Short)
//           .setPlaceholder("e.g., Summer Ball 2025")
//           .setRequired(true)
//           .setMaxLength(100); // Prevent excessively long titles

//         const detailsInput = new TextInputBuilder()
//           .setCustomId("gala-details")
//           .setLabel("Details (Supports Markdown)")
//           .setStyle(TextInputStyle.Paragraph)
//           .setPlaceholder(
//             "e.g., Join us for a night of fun! Dress code: formal.\n- Live music\n- Free food"
//           )
//           .setRequired(true)
//           .setMaxLength(2000); // Prevent exceeding Discord description limit

//         modal.addComponents(
//           new ActionRowBuilder().addComponents(titleInput),
//           new ActionRowBuilder().addComponents(detailsInput)
//         );

//         await interaction.showModal(modal);
//         return; // Crucial: stop execution after showing modal
//       }

//       // --- Commands requiring defer and gala lookup ---
//       await interaction.deferReply({ ephemeral: true });

//       const galaId = interaction.options.getString("gala-id");
//       if (!galas.has(galaId)) {
//         return interaction.editReply({
//           content: `❌ No active gala found with ID \`${galaId}\`.`,
//         });
//       }
//       const gala = galas.get(galaId);

//       const isAuthor = interaction.user.id === gala.authorId;
//       const authorOnly = ["close-doors", "open-doors", "tweak"];
//       if (authorOnly.includes(commandName) && !isAuthor) {
//         return interaction.editReply({
//           content: "❌ Only the creator can do that.",
//         });
//       }

//       let updateMessage = "";
//       let shouldSave = false;

//       if (commandName === "tweak") {
//         const newTitle = interaction.options.getString("new-title");
//         const newDetails = interaction.options.getString("new-details");
//         if (!newTitle && !newDetails) {
//           return interaction.editReply({
//             content: "❌ Provide a new title or details to edit.",
//           });
//         }
//         if (newTitle) gala.title = newTitle.trim();
//         if (newDetails !== null) gala.details = newDetails; // Allow empty string
//         updateMessage = `✅ Tweaked "**${gala.title}**"!`;
//         shouldSave = true;
//       } else if (commandName === "open-doors") {
//         if (gala.status === "open") {
//           return interaction.editReply("✅ Sign-ups are already open.");
//         }
//         gala.status = "open";
//         updateMessage = `✅ Opened doors for "**${gala.title}**"!`;
//         shouldSave = true;
//       } else if (commandName === "close-doors") {
//         if (gala.status === "closed") {
//           return interaction.editReply("✅ Sign-ups are already closed.");
//         }
//         gala.status = "closed";
//         updateMessage = `✅ Closed doors for "**${gala.title}**"!`;
//         shouldSave = true;
//       } else if (commandName === "peek") {
//         // Peek is public, so don't make the deferReply ephemeral
//         // We deferred ephemeral, but we want the final reply to be public
//         // So we use editReply without ephemeral flag
//         return interaction.editReply(createGalaEmbedAndButtons(gala)); // This is correct usage
//       } else if (commandName === "whats-on") {
//         if (galas.size === 0) {
//           return interaction.editReply("🎭 No galas scheduled right now.");
//         }
//         const list = Array.from(galas.values())
//           .map((g) => `**${g.title}** (ID: \`${g.id}\`) — ${g.status}`)
//           .join("\n");
//         return interaction.editReply({
//           embeds: [
//             new EmbedBuilder()
//               .setTitle("🎭 Upcoming Galas")
//               .setDescription(list)
//               .setColor("#5865F2"),
//           ],
//         });
//       }

//       // If an action required saving or updating the message
//       if (
//         shouldSave ||
//         ["open-doors", "close-doors", "tweak"].includes(commandName)
//       ) {
//         try {
//           const channel = await client.channels.fetch(gala.channelId);
//           if (!channel || !channel.isTextBased()) {
//             throw new Error("Channel not found or not text-based for update");
//           }
//           const message = await channel.messages.fetch(gala.messageId);
//           await message.edit(createGalaEmbedAndButtons(gala));
//           galas.set(galaId, gala);
//           if (shouldSave) await saveGalas();
//           return interaction.editReply({ content: updateMessage });
//         } catch (err) {
//           console.error(`Error updating message for gala ${galaId}:`, err);
//           return interaction.editReply({
//             content:
//               "⚠️ An error occurred while updating the gala post. Please try again.",
//           });
//         }
//       }
//     }

//     if (interaction.isModalSubmit()) {
//       const [customId, date] = interaction.customId.split("_");

//       if (customId === "plan-gala-modal") {
//         // Modal submission is always an initial response
//         await interaction.deferReply({ ephemeral: true });

//         const title = interaction.fields.getTextInputValue("gala-title");
//         const details = interaction.fields.getTextInputValue("gala-details");

//         if (
//           !interaction.guild.members.me.permissions.has(
//             PermissionsBitField.Flags.ManageRoles
//           )
//         ) {
//           return interaction.editReply({
//             content:
//               "❌ I need the 'Manage Roles' permission to create a role for the gala!",
//           });
//         }

//         const roleName = `Gala: ${title.substring(0, 50)}`; // Limit role name length
//         let galaRole;
//         try {
//           galaRole = await interaction.guild.roles.create({
//             name: roleName,
//             mentionable: true,
//             reason: `Role for gala: ${title}`,
//           });
//         } catch (roleErr) {
//           console.error("Failed to create role:", roleErr);
//           return interaction.editReply({
//             content:
//               "❌ Failed to create a role for the gala. Please check my permissions.",
//           });
//         }

//         const newGala = {
//           id: date,
//           title,
//           details,
//           status: "open",
//           participants: [],
//           messageId: null,
//           channelId: interaction.channelId,
//           authorId: interaction.user.id,
//           authorUsername: interaction.user.username,
//           roleId: galaRole.id,
//           pingSent: false, // Initialize pingSent
//         };

//         let message;
//         try {
//           const messageComponents = createGalaEmbedAndButtons(newGala);
//           message = await interaction.channel.send(messageComponents);
//           newGala.messageId = message.id;
//         } catch (msgErr) {
//           console.error("Failed to send gala announcement:", msgErr);
//           // Cleanup role if message fails
//           try {
//             await galaRole.delete("Failed to announce gala");
//           } catch (delErr) {
//             console.warn("Failed to delete role after message error:", delErr);
//           }
//           return interaction.editReply({
//             content:
//               "❌ Failed to post the gala announcement. Please try again.",
//           });
//         }

//         galas.set(date, newGala);
//         await saveGalas(); // Save immediately after creation

//         return interaction.editReply({
//           content: `🎉 Gala "**${title}**" scheduled for \`${date}\`! The announcement has been posted.`,
//         });
//       }
//     }

//     if (interaction.isButton()) {
//       // Button clicks require deferUpdate as the initial response
//       await interaction.deferUpdate();

//       const [action, galaId] = interaction.customId.split("_");
//       const gala = galas.get(galaId);

//       if (!gala) {
//         // Use followUp for button errors after deferUpdate
//         return interaction.followUp({
//           content: "❌ This gala seems to have been removed.",
//           ephemeral: true,
//         });
//       }

//       if (gala.status !== "open") {
//         return interaction.followUp({
//           content: "🔒 Sign-ups are currently closed for this gala.",
//           ephemeral: true,
//         });
//       }

//       const cooldownKey = `${interaction.user.id}-${galaId}`;
//       const now = Date.now();
//       const cooldown = buttonCooldowns.get(cooldownKey);

//       if (cooldown && now - cooldown < BUTTON_COOLDOWN_SECONDS * 1000) {
//         const left = (
//           (cooldown + BUTTON_COOLDOWN_SECONDS * 1000 - now) /
//           1000
//         ).toFixed(1);
//         return interaction.followUp({
//           content: `⏳ Please wait ${left}s before trying again.`,
//           ephemeral: true,
//         });
//       }
//       buttonCooldowns.set(cooldownKey, now);

//       const user = interaction.user;
//       const member = interaction.member;
//       const isJoined = gala.participants.some((p) => p.id === user.id);

//       const role = await interaction.guild.roles
//         .fetch(gala.roleId)
//         .catch(() => null);
//       if (!role) {
//         return interaction.followUp({
//           content:
//             "⚠️ The role for this gala is missing. Please contact an admin.",
//           ephemeral: true,
//         });
//       }

//       let needsSave = false;
//       if (action === "join-gala") {
//         if (isJoined) {
//           return interaction.followUp({
//             content: "✅ You're already signed up for this gala!",
//             ephemeral: true,
//           });
//         }
//         gala.participants.push({ id: user.id, username: user.username });
//         try {
//           await member.roles.add(role);
//         } catch (roleErr) {
//           console.error(
//             `Failed to add role to user ${user.id} for gala ${galaId}:`,
//             roleErr
//           );
//           // Remove user from participants if role add fails
//           gala.participants = gala.participants.filter((p) => p.id !== user.id);
//           return interaction.followUp({
//             content:
//               "⚠️ Failed to assign the gala role. Please try again or contact an admin.",
//             ephemeral: true,
//           });
//         }
//         needsSave = true;
//       } else if (action === "leave-gala") {
//         if (!isJoined) {
//           return interaction.followUp({
//             content: "⚠️ You haven't joined this gala yet.",
//             ephemeral: true,
//           });
//         }
//         gala.participants = gala.participants.filter((p) => p.id !== user.id);
//         try {
//           await member.roles.remove(role);
//         } catch (roleErr) {
//           console.error(
//             `Failed to remove role from user ${user.id} for gala ${galaId}:`,
//             roleErr
//           );
//           // Re-add user to participants if role removal fails
//           if (!gala.participants.some((p) => p.id === user.id)) {
//             gala.participants.push({ id: user.id, username: user.username });
//           }
//           return interaction.followUp({
//             content:
//               "⚠️ Failed to remove the gala role. Please try again or contact an admin.",
//             ephemeral: true,
//           });
//         }
//         needsSave = true;
//       }

//       galas.set(galaId, gala);

//       // Update the message first for instant feedback
//       try {
//         await interaction.message.edit(createGalaEmbedAndButtons(gala));
//       } catch (editErr) {
//         console.error(`Failed to edit message for gala ${galaId}:`, editErr);
//         // Don't return here, still try to save data
//       }

//       // Then save to GitHub
//       if (needsSave) {
//         await saveGalas();
//       }
//     }
//   } catch (err) {
//     console.error("⚠️ Interaction Error:", err);

//     // --- FIX: Improved error handling to prevent double responses ---
//     const hasResponded = interaction.replied || interaction.deferred;

//     try {
//       const errorMessage =
//         "❌ An unexpected error occurred. Please try again later.";
//       if (!hasResponded) {
//         // If we haven't responded at all, we can send a direct reply
//         await interaction.reply({
//           content: errorMessage,
//           ephemeral: true,
//         });
//       } else {
//         // If we have responded (deferred, showModal, deferUpdate), we must use followUp
//         // Ensure we don't try to followUp on an already acknowledged interaction
//         // This is a bit tricky, but we try-catch the followUp itself
//         try {
//           await interaction.followUp({
//             content: errorMessage,
//             ephemeral: true,
//           });
//         } catch (followUpErr) {
//           // If followUp also fails, it's likely already acknowledged.
//           // We cannot send another response. Just log it.
//           console.error(
//             "CRITICAL: Failed to send error followUp. Interaction likely already acknowledged.",
//             followUpErr
//           );
//         }
//       }
//     } catch (responseErr) {
//       // If even the error response fails, log it but don't crash the bot
//       console.error(
//         "CRITICAL: Failed to send any error message to the user.",
//         responseErr
//       );
//     }
//   }
// });

// // --- INIT ---
// async function initialize() {
//   try {
//     console.log("🔧 Initializing bot...");
//     await loadGalas();
//     await deployCommands();
//     console.log("✅ Initialization complete.");
//   } catch (err) {
//     console.error("❌ Fatal Initialization error:", err);
//     process.exit(1);
//   }
// }

// initialize().catch(console.error);
// client.login(process.env.DISCORD_TOKEN);
