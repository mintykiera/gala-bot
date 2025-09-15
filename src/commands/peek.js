const { galas, completedGalas } = require("../state");
const { createGalaEmbedAndButtons } = require("../utils/embeds");

async function execute(interaction) {
  const galaId = interaction.options.getString("gala-id");
  const gala = galas.get(galaId) || completedGalas.get(galaId);

  await interaction.reply(createGalaEmbedAndButtons(gala));
}

module.exports = { execute };