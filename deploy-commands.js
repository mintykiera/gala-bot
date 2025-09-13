// deploy-commands.js
const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const { CLIENT_ID, GUILD_ID, DISCORD_TOKEN } = require("./src/config");

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
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log("🔄 Deploying commands...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log("✅ Successfully deployed commands.");
  } catch (error) {
    console.error("❌ Error deploying commands:", error);
  }
})();
