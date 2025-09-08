// clear-commands.js
const { REST, Routes } = require("discord.js");
const { CLIENT_ID, GUILD_ID, DISCORD_TOKEN } = require("./src/config");

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log("🗑️ Clearing guild commands...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: [],
    });
    console.log("✅ Cleared all guild commands.");
  } catch (error) {
    console.error("❌ Error clearing commands:", error);
  }
})();
