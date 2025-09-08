// src/commands/peek.js
const { galas } = require("../state");
const { createGalaEmbedAndButtons } = require("../utils/embeds");

async function execute(interaction) {
  await interaction.deferReply(); // Public reply

  const galaId = interaction.options.getString("gala-id");
  if (!galas.has(galaId)) {
    return interaction.editReply({
      content: `❌ No active gala found with ID \`${galaId}\`.`,
    });
  }

  const gala = galas.get(galaId);
  return interaction.editReply(createGalaEmbedAndButtons(gala));
}

module.exports = { execute };
