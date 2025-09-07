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
} = require("discord.js");
const dotenv = require("dotenv");
const fs = require("fs").promises;
const path = require("path");
const { Octokit } = require("octokit");

dotenv.config();

const PING_CHANNEL_ID = "1312425724736704562";
const BUTTON_COOLDOWN_SECONDS = 10;
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
const GITHUB_REPO = process.env.GITHUB_REPO; // e.g. "mintykiera/gala-bot"
const GITHUB_FILE_PATH = process.env.GITHUB_FILE_PATH || "galas.json";

const commands = [
  new SlashCommandBuilder()
    .setName("plan")
    .setDescription("Schedule a new gala event")
    .addStringOption((option) =>
      option
        .setName("title")
        .setDescription("Name of the gala")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("When? Format: DDMMYYYY (e.g., 24082025)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("details")
        .setDescription("What's happening?")
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

  // ✅ NEW: Cancel Gala
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
      await saveGalas(); // Create empty file
    } else {
      console.error("Error loading galas from GitHub:", err);
    }
  }
}

async function saveGalas() {
  try {
    // Get current file SHA (needed for update)
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
      currentSha = null; // File doesn't exist yet
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
      sha: currentSha, // Required if file exists
    });

    console.log("✅ Gala data saved to GitHub successfully.");
  } catch (err) {
    console.error("Error saving gala data to GitHub:", err);
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
    .addFields({ name: "✅ Attendees", value: participantList, inline: false })
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
    components: gala.status === "open" ? [buttons] : [],
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
        value:
          "`/plan title: 'Summer Ball' date: 24082025 details: 'Dress fancy!'`\n→ Schedule a new gala.",
        inline: false,
      },
      {
        name: "✨ /tweak",
        value:
          "`/tweak gala-id: 24082025 new-title: 'Winter Ball'`\n→ Edit your gal's name or details.",
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
      iconURL: client.user.displayAvatarURL(),
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
          galas.set(galaId, gala);
          await saveGalas();
        }
      } catch (error) {
        console.error(`Failed to ping for ${gala.id}:`, error);
      }
    }

    if (galaDate < today) {
      console.log(`✅ ${gala.title} ended. Archiving.`);
      gala.status = "completed";
      completedGalas.set(galaId, gala);
      galas.delete(galaId);
      await saveGalas();

      try {
        const role = await guild.roles.fetch(gala.roleId);
        if (role) await role.delete(`Gala "${gala.title}" has ended.`);
        const channel = await guild.channels.fetch(gala.channelId);
        const message = await channel.messages.fetch(gala.messageId);
        await message.edit(createGalaEmbedAndButtons(gala));
      } catch (error) {
        console.error(`Cleanup failed for ${gala.id}:`, error);
      }
    }
  }
}

async function clearAllCommands() {
  try {
    console.log("🧹 Clearing all commands...");
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: [] }
    );
    console.log("All commands cleared.");
  } catch (error) {
    console.error("Clear error:", error);
  }
}

client.once("clientReady", () => {
  console.log(`🚀 Bot online as ${client.user.tag}`);
  dailySchedulerTick();
  setInterval(dailySchedulerTick, 60000);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.inGuild()) return;

  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === "help") {
      const helpEmbed = createHelpEmbed();
      return interaction.reply({ embeds: [helpEmbed] });
    }

    if (commandName === "past-galas") {
      const pastEmbed = createPastGalasEmbed();
      return interaction.reply({ embeds: [pastEmbed] });
    }

    // ✅ NEW: Cancel Gala
    if (commandName === "cancel-gala") {
      const galaId = interaction.options.getString("gala-id");
      if (!galas.has(galaId)) {
        return interaction.reply({
          content: `No active gala found with ID ${galaId}.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const gala = galas.get(galaId);
      if (interaction.user.id !== gala.authorId) {
        return interaction.reply({
          content: "Only the creator can cancel this gala.",
          flags: MessageFlags.Ephemeral,
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
        const cancelledEmbed = new EmbedBuilder()
          .setColor("#ED4245")
          .setTitle("❌ " + gala.title)
          .setDescription(gala.details)
          .addFields({
            name: "✅ Attendees",
            value:
              gala.participants.length > 0
                ? gala.participants
                    .map((p, i) => `${i + 1}.) <@${p.id}> (${p.username})`)
                    .join("\n")
                : "No one joined.",
            inline: false,
          })
          .setFooter({
            text: `Gala ID: ${gala.id} | Status: Cancelled | Cancelled by: ${interaction.user.username}`,
          });

        await message.edit({
          embeds: [cancelledEmbed],
          components: [],
        });
      } catch (err) {
        console.warn(
          `Could not update message for cancelled gala ${gala.id}:`,
          err
        );
      }

      completedGalas.set(galaId, gala);
      galas.delete(galaId);
      await saveGalas();

      return interaction.reply({
        content: `✅ Gala "${gala.title}" has been cancelled.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (commandName === "plan") {
      let title = interaction.options.getString("title");
      const date = interaction.options.getString("date");
      const details = interaction.options.getString("details");

      if (!title || typeof title !== "string" || title.trim() === "") {
        return interaction.reply({
          content: "Gala title cannot be empty.",
          flags: MessageFlags.Ephemeral,
        });
      }
      title = title.trim();

      if (!/^\d{8}$/.test(date)) {
        return interaction.reply({
          content: "Invalid date. Use DDMMYYYY (e.g., 24082025).",
          flags: MessageFlags.Ephemeral,
        });
      }

      const galaDate = parseDate(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (galaDate < today) {
        return interaction.reply({
          content: "Can't schedule in the past.",
          flags: MessageFlags.Ephemeral,
        });
      }

      if (galas.has(date)) {
        return interaction.reply({
          content: `A gala with ID ${date} already exists.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (
        !interaction.guild.members.me.permissions.has(
          PermissionsBitField.Flags.ManageRoles
        )
      ) {
        return interaction.reply({
          content: "I need 'Manage Roles' permission to create a role!",
          flags: MessageFlags.Ephemeral,
        });
      }

      const roleName = `Gala: ${title.substring(0, 50)}`;
      const galaRole = await interaction.guild.roles.create({
        name: roleName,
        mentionable: true,
        reason: `Role for ${title}`,
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

      return interaction.reply({
        content: `🎉 Gala "${title}" scheduled for ${date}!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const galaId = interaction.options.getString("gala-id");
    if (galaId && !galas.has(galaId)) {
      return interaction.reply({
        content: `No active gala found with ID ${galaId}.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    const gala = galas.get(galaId);

    const isAuthor = gala && interaction.user.id === gala.authorId;
    const authorOnly = ["close-doors", "open-doors", "tweak", "cancel-gala"];
    if (authorOnly.includes(commandName) && !isAuthor) {
      return interaction.reply({
        content: "Only the creator can do that.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (commandName === "tweak") {
      const newTitle = interaction.options.getString("new-title");
      const newDetails = interaction.options.getString("new-details");
      if (!newTitle && !newDetails) {
        return interaction.reply({
          content: "Provide a new title or details to edit.",
          flags: MessageFlags.Ephemeral,
        });
      }
      if (newTitle) gala.title = newTitle.trim();
      if (newDetails) gala.details = newDetails;
    } else if (commandName === "open-doors") {
      gala.status = "open";
    } else if (commandName === "close-doors") {
      gala.status = "closed";
    } else if (commandName === "peek") {
      return interaction.reply({
        ...createGalaEmbedAndButtons(gala),
        flags: MessageFlags.Ephemeral,
      });
    } else if (commandName === "whats-on") {
      if (galas.size === 0) {
        return interaction.reply("No galas scheduled right now.");
      }
      const list = Array.from(galas.values())
        .map((g) => `**${g.title}** (ID: \`${g.id}\`) — ${g.status}`)
        .join("\n");
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🎭 Upcoming Galas")
            .setDescription(list)
            .setColor("#5865F2"),
        ],
      });
    }

    if (gala && ["tweak", "open-doors", "close-doors"].includes(commandName)) {
      const channel = await client.channels.fetch(gala.channelId);
      const message = await channel.messages.fetch(gala.messageId);
      await message.edit(createGalaEmbedAndButtons(gala));
      galas.set(galaId, gala);
      await saveGalas();
      await interaction.reply({
        content: `✅ Updated "${gala.title}"`,
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  if (interaction.isButton()) {
    const [action, galaId] = interaction.customId.split("_");
    const gala = galas.get(galaId);

    if (!gala || gala.status !== "open") {
      return interaction.reply({
        content: "Sign-ups are closed for this gala.",
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
      return interaction.reply({
        content: `⏳ Wait ${left}s before trying again.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    buttonCooldowns.set(cooldownKey, now);

    const user = interaction.user;
    const member = interaction.member;
    const isJoined = gala.participants.some((p) => p.id === user.id);
    const role = await interaction.guild.roles.fetch(gala.roleId);
    if (!role) {
      return interaction.reply({
        content: "Role missing. Contact an admin.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (action === "join-gala") {
      if (isJoined) {
        return interaction.reply({
          content: "You're already signed up!",
          flags: MessageFlags.Ephemeral,
        });
      }
      gala.participants.push({ id: user.id, username: user.username });
      await member.roles.add(role);
    } else if (action === "leave-gala") {
      if (!isJoined) {
        return interaction.reply({
          content: "You haven't joined yet.",
          flags: MessageFlags.Ephemeral,
        });
      }
      gala.participants = gala.participants.filter((p) => p.id !== user.id);
      await member.roles.remove(role);
    }

    await interaction.message.edit(createGalaEmbedAndButtons(gala));
    galas.set(galaId, gala);
    await saveGalas();

    await interaction.reply({
      content: `✅ You've ${action === "join-gala" ? "joined" : "left"} "${
        gala.title
      }"!`,
      flags: MessageFlags.Ephemeral,
    });
  }
});

async function initialize() {
  await loadGalas();
  await deployCommands();
  // Uncomment below ONLY to wipe commands:
  // await clearAllCommands();
}

initialize().catch(console.error);
client.login(process.env.DISCORD_TOKEN);
