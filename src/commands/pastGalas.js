// src/commands/pastGalas.js
const { createPastGalasEmbed } = require("../utils/embeds");

async function execute(interaction) {
  await interaction.deferReply();
  const embed = createPastGalasEmbed();
  await interaction.editReply({ embeds: [embed] });
}

module.exports = { execute };
