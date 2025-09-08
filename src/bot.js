// src/bot.js
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  MessageFlags,
} = require("discord.js");
const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = require("./config");
const { loadGalas } = require("./githubManager");
const { handleInteraction } = require("./events/interactionCreate");
const { handleClientReady } = require("./events/clientReady");

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

  new SlashCommandBuilder()
    .setName("give-access")
    .setDescription("Grant co-host access to another user")
    .addStringOption((option) =>
      option
        .setName("gala-id")
        .setDescription("Gala date (ID)")
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to grant access to")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("remove-access")
    .setDescription("Remove co-host access from a user")
    .addStringOption((option) =>
      option
        .setName("gala-id")
        .setDescription("Gala date (ID)")
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to remove access from")
        .setRequired(true)
    ),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

async function deployCommands() {
  try {
    console.log("🔄 Refreshing commands...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log("✅ Commands updated.");
  } catch (error) {
    console.error("❌ Command deployment error:", error);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("clientReady", () => handleClientReady(client)); // ← FIXED
client.on("interactionCreate", (interaction) =>
  handleInteraction(interaction, client)
);
client.on("error", (err) => console.error("⚠️ Global Client Error:", err));

async function initialize() {
  try {
    console.log("🔧 Initializing bot...");
    await loadGalas();
    await deployCommands();
    console.log("✅ Initialization complete.");
    client.login(DISCORD_TOKEN);
  } catch (err) {
    console.error("❌ Fatal Initialization error:", err);
    process.exit(1);
  }
}

module.exports = { initialize };
