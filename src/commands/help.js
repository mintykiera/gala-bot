// src/commands/help.js
const { createHelpEmbed } = require("../utils/embeds");

async function execute(interaction) {
  await interaction.reply({ embeds: [createHelpEmbed()] });
}

module.exports = { execute };
