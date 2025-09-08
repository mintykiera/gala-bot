const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const dotenv = require("dotenv");
const fs = require("fs").promises;
const path = require("path");
const { Octokit } = require("octokit");

dotenv.config();

const PING_CHANNEL_ID = "1312425724736704562";
const BUTTON_COOLDOWN_SECONDS = 5; // Reduced for better user experience
const DATA_FILE = path.join(__dirname, "galas.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const galas = new Map();
const completedGalas = new Map();
const buttonCooldowns = new Map();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_FILE_PATH = process.env.GITHUB_FILE_PATH || "galas.json";

const commands = [
  new SlashCommandBuilder()
    .setName("plan")
    .setDescription("Schedule a new gala event using a pop-up form")
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("When? Format: DDMMYYYY (e.g., 24082025)")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("tweak")
    .setDescription("Edit your gala's name or details")
    .addStringOption((option) =>
      option
        .setName("gala-id")
        .setDescription("Gala date (ID)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("new-title").setDescription("New name for the gala")
    )
    .addStringOption((option) =>
      option.setName("new-details").setDescription("New description")
    ),

  new SlashCommandBuilder()
    .setName("open-doors")
    .setDescription("Open sign-ups for your gala")
    .addStringOption((option) =>
      option.setName("gala-id").setDescription("Which gala?").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("close-doors")
    .setDescription("Close sign-ups for your gala")
    .addStringOption((option) =>
      option.setName("gala-id").setDescription("Which gala?").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("peek")
    .setDescription("See details of a specific gala")
    .addStringOption((option) =>
      option
        .setName("gala-id")
        .setDescription("Gala date (ID)")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("whats-on")
    .setDescription("See all upcoming galas"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all commands and how to use them!"),

  new SlashCommandBuilder()
    .setName("past-galas")
    .setDescription("See all completed galas and their stats!"),

  new SlashCommandBuilder()
    .setName("cancel-gala")
    .setDescription("Cancel your gala (author only)")
    .addStringOption((option) =>
      option
        .setName("gala-id")
        .setDescription("Gala date (ID)")
        .setRequired(true)
    ),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

async function deployCommands() {
  try {
    console.log("Refreshing commands...");
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );
    console.log("✅ Commands updated.");
  } catch (error) {
    console.error("Command deployment error:", error);
  }
}

async function loadGalas() {
  try {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner: GITHUB_REPO.split("/")[0],
        repo: GITHUB_REPO.split("/")[1],
        path: GITHUB_FILE_PATH,
      }
    );

    const content = Buffer.from(data.content, "base64").toString("utf8");
    const stored = JSON.parse(content);

    if (stored.active && typeof stored.active === "object") {
      for (const [id, gala] of Object.entries(stored.active)) {
        if (
          gala &&
          typeof gala === "object" &&
          typeof gala.title === "string" &&
          typeof gala.id === "string"
        ) {
          if (!Array.isArray(gala.participants)) gala.participants = [];
          if (
            !["open", "closed", "completed", "cancelled"].includes(gala.status)
          ) {
            gala.status = "open";
          }
          galas.set(id, gala);
        }
      }
    }

    if (stored.completed && typeof stored.completed === "object") {
      for (const [id, gala] of Object.entries(stored.completed)) {
        if (
          gala &&
          typeof gala === "object" &&
          typeof gala.title === "string" &&
          typeof gala.id === "string"
        ) {
          if (!Array.isArray(gala.participants)) gala.participants = [];
          if (
            !["open", "closed", "completed", "cancelled"].includes(gala.status)
          ) {
            gala.status = "completed";
          }
          completedGalas.set(id, gala);
        }
      }
    }

    console.log(
      `Loaded ${galas.size} active, ${completedGalas.size} completed galas.`
    );
  } catch (err) {
    if (err.status === 404) {
      console.log("No galas.json found on GitHub — starting fresh.");
      await saveGalas();
    } else {
      console.error("Error loading galas from GitHub:", err);
    }
  }
}

async function saveGalas() {
  try {
    let currentSha;
    try {
      const { data } = await octokit.request(
        "GET /repos/{owner}/{repo}/contents/{path}",
        {
          owner: GITHUB_REPO.split("/")[0],
          repo: GITHUB_REPO.split("/")[1],
          path: GITHUB_FILE_PATH,
        }
      );
      currentSha = data.sha;
    } catch (err) {
      if (err.status !== 404) throw err;
      currentSha = null;
    }

    const data = {
      active: Object.fromEntries(galas.entries()),
      completed: Object.fromEntries(completedGalas.entries()),
    };

    const content = Buffer.from(JSON.stringify(data, null, 2)).toString(
      "base64"
    );

    await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
      owner: GITHUB_REPO.split("/")[0],
      repo: GITHUB_REPO.split("/")[1],
      path: GITHUB_FILE_PATH,
      message: "💾 Auto-save gala data",
      content: content,
      sha: currentSha,
    });
  } catch (err) {
    console.error("Error saving gala data to GitHub:", err);
    throw err;
  }
}

function parseDate(dateString) {
  const day = parseInt(dateString.substring(0, 2), 10);
  const month = parseInt(dateString.substring(2, 4), 10) - 1;
  const year = parseInt(dateString.substring(4, 8), 10);
  return new Date(year, month, day);
}

function createGalaEmbedAndButtons(gala) {
  const participantList =
    gala.participants.length > 0
      ? gala.participants
          .map((p, index) => `${index + 1}.) <@${p.id}> (${p.username})`)
          .join("\n")
      : "No one has joined yet.";

  let color = "#5865F2";
  let statusText = `Status: ${
    gala.status.charAt(0).toUpperCase() + gala.status.slice(1)
  }`;
  if (gala.status === "cancelled") statusText = "Status: Cancelled";

  if (gala.status === "open") color = "#57F287";
  if (gala.status === "closed") color = "#ED4245";
  if (gala.status === "completed") color = "#95A5A6";
  if (gala.status === "cancelled") color = "#ED4245";

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(gala.title)
    .setDescription(gala.details)
    .addFields({
      name: `✅ Attendees (${gala.participants.length})`,
      value: participantList,
      inline: false,
    })
    .setFooter({
      text: `Gala ID: ${gala.id} | ${statusText} | Created by: ${gala.authorUsername}`,
    });

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`join-gala_${gala.id}`)
      .setLabel("Join Gala")
      .setStyle(ButtonStyle.Success)
      .setDisabled(gala.status !== "open"),
    new ButtonBuilder()
      .setCustomId(`leave-gala_${gala.id}`)
      .setLabel("Leave Gala")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(gala.status !== "open")
  );

  return {
    embeds: [embed],
    components:
      gala.status === "open" || gala.status === "closed" ? [buttons] : [],
  };
}

function createHelpEmbed() {
  return new EmbedBuilder()
    .setTitle("🎀 GALA BOT HELP")
    .setDescription("Here's how to plan, manage, and join galas with ease!")
    .setColor("#FF69B4")
    .addFields(
      {
        name: "📅 /plan",
        value: "`/plan date: 24082025`\n→ Opens a form to schedule a new gala.",
        inline: false,
      },
      {
        name: "✨ /tweak",
        value:
          '`/tweak gala-id: 24082025 new-title: "Winter Ball"`\n→ Edit your gala\'s name or details.',
        inline: false,
      },
      {
        name: "🚪 /open-doors",
        value: "`/open-doors gala-id: 24082025`\n→ Let people join your gala.",
        inline: false,
      },
      {
        name: "🔒 /close-doors",
        value: "`/close-doors gala-id: 24082025`\n→ Stop new sign-ups.",
        inline: false,
      },
      {
        name: "❌ /cancel-gala",
        value:
          "`/cancel-gala gala-id: 24082025`\n→ Cancel your gala (author only).",
        inline: false,
      },
      {
        name: "🔍 /peek",
        value:
          "`/peek gala-id: 24082025`\n→ See who's joined and event details.",
        inline: false,
      },
      {
        name: "🎭 /whats-on",
        value: "`/whats-on`\n→ See all upcoming galas at a glance.",
        inline: false,
      },
      {
        name: "📜 /past-galas",
        value: "`/past-galas`\n→ See all completed/cancelled galas.",
        inline: false,
      }
    )
    .setFooter({
      text: "Tip: Use the Join/Leave buttons under each gala post!",
    });
}

function createPastGalasEmbed() {
  if (completedGalas.size === 0) {
    return new EmbedBuilder()
      .setTitle("📜 Past Galas")
      .setDescription("No galas have been completed or cancelled yet.")
      .setColor("#A9A9A9");
  }

  const sortedGalas = Array.from(completedGalas.values()).sort(
    (a, b) => parseDate(b.id) - parseDate(a.id)
  );
  const fields = sortedGalas.map((gala) => ({
    name: `${gala.status === "cancelled" ? "❌" : "🎉"} ${gala.title}`,
    value: `**Date:** \`${gala.id}\`\n**Status:** ${gala.status}\n**Created by:** ${gala.authorUsername}\n**Attendees:** ${gala.participants.length}`,
    inline: false,
  }));

  return new EmbedBuilder()
    .setTitle("📜 Past Galas")
    .setDescription(`Showing ${completedGalas.size} completed/cancelled galas.`)
    .setColor("#95A5A6")
    .addFields(fields.slice(0, 25))
    .setFooter({
      text: "Oldest galas may be trimmed if over 25. Data is still saved!",
    });
}

async function dailySchedulerTick() {
  console.log("⏰ Checking galas...");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const guild = await client.guilds.fetch(process.env.GUILD_ID).catch((err) => {
    console.error("Could not fetch guild.", err);
    return null;
  });
  if (!guild) return;

  for (const [galaId, gala] of galas.entries()) {
    const galaDate = parseDate(galaId);

    if (galaDate.getTime() === today.getTime() && !gala.pingSent) {
      console.log(`🎉 ${gala.title} is today! Sending ping.`);
      try {
        const pingChannel = await guild.channels.fetch(PING_CHANNEL_ID);
        if (pingChannel && pingChannel.isTextBased()) {
          await pingChannel.send({
            content: `<@&${gala.roleId}> The gala, **${gala.title}**, is happening today! Get ready! ✨`,
          });
          gala.pingSent = true;
          await saveGalas();
        }
      } catch (error) {
        console.error(`Failed to ping for ${gala.id}:`, error);
      }
    }

    if (galaDate < today && gala.status !== "completed") {
      console.log(`✅ ${gala.title} ended. Archiving.`);
      gala.status = "completed";
      completedGalas.set(galaId, gala);
      galas.delete(galaId);

      try {
        const role = await guild.roles.fetch(gala.roleId);
        if (role) await role.delete(`Gala "${gala.title}" has ended.`);
      } catch (error) {
        console.error(
          `Could not delete role for completed gala ${gala.id}:`,
          error
        );
      }

      try {
        const channel = await guild.channels.fetch(gala.channelId);
        const message = await channel.messages.fetch(gala.messageId);
        await message.edit(createGalaEmbedAndButtons(gala));
      } catch (error) {
        console.error(`Cleanup failed for ${gala.id}:`, error);
      }

      await saveGalas();
    }
  }
}
// --- FIX: Correct event name and use client object from callback ---
client.once("ready", (c) => {
  console.log(`🚀 Bot online as ${c.user.tag}`);
  dailySchedulerTick();
  setInterval(dailySchedulerTick, 60000);
});

client.on("error", (err) => {
  console.error("⚠️ Global Client Error:", err);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.inGuild()) return;

  try {
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      // --- FIX: /help is now public by default (removed deprecated 'ephemeral' property) ---
      if (commandName === "help") {
        await interaction.reply({ embeds: [createHelpEmbed()] });
        return;
      }

      if (commandName === "past-galas") {
        await interaction.deferReply();
        const pastEmbed = createPastGalasEmbed();
        await interaction.editReply({ embeds: [pastEmbed] });
        return;
      }

      if (commandName === "cancel-gala") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const galaId = interaction.options.getString("gala-id");
        if (!galas.has(galaId)) {
          return interaction.editReply({
            content: `❌ No active gala found with ID ${galaId}.`,
          });
        }

        const gala = galas.get(galaId);
        if (interaction.user.id !== gala.authorId) {
          return interaction.editReply({
            content: "❌ Only the creator can cancel this gala.",
          });
        }

        gala.status = "cancelled";

        try {
          const role = await interaction.guild.roles.fetch(gala.roleId);
          if (role) await role.delete("Gala cancelled by author.");
        } catch (err) {
          console.warn(
            `Could not delete role for cancelled gala ${gala.id}:`,
            err
          );
        }

        try {
          const channel = await client.channels.fetch(gala.channelId);
          const message = await channel.messages.fetch(gala.messageId);
          await message.edit(createGalaEmbedAndButtons(gala));
        } catch (err) {
          console.warn(
            `Could not update message for cancelled gala ${gala.id}:`,
            err
          );
        }

        completedGalas.set(galaId, gala);
        galas.delete(galaId);
        await saveGalas();

        return interaction.editReply({
          content: `✅ Gala "${gala.title}" has been cancelled.`,
        });
      }

      if (commandName === "plan") {
        const date = interaction.options.getString("date");

        if (!/^\d{8}$/.test(date)) {
          return interaction.reply({
            content: "❌ Invalid date. Use DDMMYYYY (e.g., 24082025).",
            flags: MessageFlags.Ephemeral,
          });
        }

        const galaDate = parseDate(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (galaDate < today) {
          return interaction.reply({
            content: "❌ Can't schedule in the past.",
            flags: MessageFlags.Ephemeral,
          });
        }

        if (galas.has(date) || completedGalas.has(date)) {
          return interaction.reply({
            content: `❌ A gala with ID ${date} already exists.`,
            flags: MessageFlags.Ephemeral,
          });
        }

        const modal = new ModalBuilder()
          .setCustomId(`plan-gala-modal_${date}`)
          .setTitle("Plan a New Gala");

        const titleInput = new TextInputBuilder()
          .setCustomId("gala-title")
          .setLabel("Gala Title")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("e.g., Summer Ball 2025")
          .setRequired(true);

        const detailsInput = new TextInputBuilder()
          .setCustomId("gala-details")
          .setLabel("Details (Supports Markdown)")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder(
            "e.g., Join us for a night of fun! Dress code: formal.\n- Live music\n- Free food"
          )
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(titleInput),
          new ActionRowBuilder().addComponents(detailsInput)
        );

        await interaction.showModal(modal);
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const galaId = interaction.options.getString("gala-id");
      if (!galas.has(galaId)) {
        return interaction.editReply({
          content: `❌ No active gala found with ID ${galaId}.`,
        });
      }
      const gala = galas.get(galaId);

      const isAuthor = gala && interaction.user.id === gala.authorId;
      const authorOnly = ["close-doors", "open-doors", "tweak"];
      if (authorOnly.includes(commandName) && !isAuthor) {
        return interaction.editReply({
          content: "❌ Only the creator can do that.",
        });
      }

      let updateMessage = "";

      if (commandName === "tweak") {
        const newTitle = interaction.options.getString("new-title");
        const newDetails = interaction.options.getString("new-details");
        if (!newTitle && !newDetails) {
          return interaction.editReply({
            content: "❌ Provide a new title or details to edit.",
          });
        }
        if (newTitle) gala.title = newTitle.trim();
        if (newDetails) gala.details = newDetails;
        updateMessage = `✅ Tweaked "${gala.title}"!`;
      } else if (commandName === "open-doors") {
        if (gala.status === "open")
          return interaction.editReply("✅ Sign-ups are already open.");
        gala.status = "open";
        updateMessage = `✅ Opened doors for "${gala.title}"!`;
      } else if (commandName === "close-doors") {
        if (gala.status === "closed")
          return interaction.editReply("✅ Sign-ups are already closed.");
        gala.status = "closed";
        updateMessage = `✅ Closed doors for "${gala.title}"!`;
      } else if (commandName === "peek") {
        return interaction.editReply({
          ...createGalaEmbedAndButtons(gala),
          ephemeral: false, // This is okay for editReply, it just makes the deferred reply non-ephemeral
        });
      } else if (commandName === "whats-on") {
        if (galas.size === 0) {
          return interaction.editReply("🎭 No galas scheduled right now.");
        }
        const list = Array.from(galas.values())
          .map((g) => `**${g.title}** (ID: \`${g.id}\`) — ${g.status}`)
          .join("\n");
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle("🎭 Upcoming Galas")
              .setDescription(list)
              .setColor("#5865F2"),
          ],
        });
      }

      const channel = await client.channels.fetch(gala.channelId);
      const message = await channel.messages.fetch(gala.messageId);
      await message.edit(createGalaEmbedAndButtons(gala));
      galas.set(galaId, gala);
      await saveGalas();
      return interaction.editReply({ content: updateMessage });
    }

    if (interaction.isModalSubmit()) {
      const [customId, date] = interaction.customId.split("_");

      if (customId === "plan-gala-modal") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const title = interaction.fields.getTextInputValue("gala-title");
        const details = interaction.fields.getTextInputValue("gala-details");

        if (
          !interaction.guild.members.me.permissions.has(
            PermissionsBitField.Flags.ManageRoles
          )
        ) {
          return interaction.editReply({
            content:
              "❌ I need 'Manage Roles' permission to create a role for the gala!",
          });
        }

        const roleName = `Gala: ${title.substring(0, 50)}`;
        const galaRole = await interaction.guild.roles.create({
          name: roleName,
          mentionable: true,
          reason: `Role for gala: ${title}`,
        });

        const newGala = {
          id: date,
          title,
          details,
          status: "open",
          participants: [],
          messageId: null,
          channelId: interaction.channelId,
          authorId: interaction.user.id,
          authorUsername: interaction.user.username,
          roleId: galaRole.id,
          pingSent: false,
        };

        const messageComponents = createGalaEmbedAndButtons(newGala);
        const message = await interaction.channel.send(messageComponents);

        newGala.messageId = message.id;
        galas.set(date, newGala);
        await saveGalas();

        return interaction.editReply({
          content: `🎉 Gala "${title}" scheduled for ${date}! The announcement has been posted.`,
        });
      }
    }

    if (interaction.isButton()) {
      await interaction.deferUpdate();

      const [action, galaId] = interaction.customId.split("_");
      const gala = galas.get(galaId);

      if (!gala) {
        return interaction.followUp({
          content: "❌ This gala seems to have been removed.",
          flags: MessageFlags.Ephemeral,
        });
      }

      if (gala.status !== "open") {
        return interaction.followUp({
          content: "🔒 Sign-ups are currently closed for this gala.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const cooldownKey = `${interaction.user.id}-${galaId}`;
      const now = Date.now();
      const cooldown = buttonCooldowns.get(cooldownKey);

      if (cooldown && now - cooldown < BUTTON_COOLDOWN_SECONDS * 1000) {
        const left = (
          (cooldown + BUTTON_COOLDOWN_SECONDS * 1000 - now) /
          1000
        ).toFixed(1);
        return interaction.followUp({
          content: `⏳ Please wait ${left}s before trying again.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      buttonCooldowns.set(cooldownKey, now);

      const user = interaction.user;
      const member = interaction.member;
      const isJoined = gala.participants.some((p) => p.id === user.id);

      const role = await interaction.guild.roles
        .fetch(gala.roleId)
        .catch(() => null);
      if (!role) {
        return interaction.followUp({
          content:
            "⚠️ The role for this gala is missing. Please contact an admin.",
          flags: MessageFlags.Ephemeral,
        });
      }

      if (action === "join-gala") {
        if (isJoined) {
          return interaction.followUp({
            content: "✅ You're already signed up for this gala!",
            flags: MessageFlags.Ephemeral,
          });
        }
        gala.participants.push({ id: user.id, username: user.username });
        await member.roles.add(role);
      } else if (action === "leave-gala") {
        if (!isJoined) {
          return interaction.followUp({
            content: "⚠️ You haven't joined this gala yet.",
            flags: MessageFlags.Ephemeral,
          });
        }
        gala.participants = gala.participants.filter((p) => p.id !== user.id);
        await member.roles.remove(role);
      }

      galas.set(galaId, gala);

      // --- FIX: Update the message FIRST for instant feedback, then save. ---
      await interaction.message.edit(createGalaEmbedAndButtons(gala));
      await saveGalas();
    }
    // --- FIX: Completely rebuilt error handler for stability ---
  } catch (err) {
    console.error("⚠️ Interaction Error:", err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: "❌ An error occurred while executing this command!",
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: "❌ An error occurred while executing this command!",
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (e) {
      console.error("CRITICAL: Failed to send error message to the user.", e);
    }
  }
});

async function initialize() {
  try {
    await loadGalas();
    await deployCommands();
  } catch (err) {
    console.error("❌ Initialization error:", err);
  }
}

initialize().catch(console.error);
client.login(process.env.DISCORD_TOKEN);
