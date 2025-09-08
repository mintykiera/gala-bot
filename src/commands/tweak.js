// src/commands/tweak.js
const { galas } = require("../state");
const { saveGalas } = require("../githubManager");
const { createGalaEmbedAndButtons } = require("../utils/embeds");

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const galaId = interaction.options.getString("gala-id");
  if (!galas.has(galaId)) {
    return interaction.editReply({
      content: `❌ No active gala found with ID \`${galaId}\`.`,
    });
  }

  const gala = galas.get(galaId);
  if (interaction.user.id !== gala.authorId) {
    return interaction.editReply({
      content: "❌ Only the creator can do that.",
    });
  }

  const newTitle = interaction.options.getString("new-title");
  const newDetails = interaction.options.getString("new-details");

  if (!newTitle && !newDetails) {
    return interaction.editReply({
      content: "❌ Provide a new title or details to edit.",
    });
  }

  if (newTitle) gala.title = newTitle.trim();
  if (newDetails !== null) gala.details = newDetails;

  try {
    const channel = await interaction.client.channels.fetch(gala.channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error("Channel not found or not text-based for update");
    }
    const message = await channel.messages.fetch(gala.messageId);
    await message.edit(createGalaEmbedAndButtons(gala));
    galas.set(galaId, gala);
    await saveGalas();
    return interaction.editReply({
      content: `✅ Tweaked "**${gala.title}**"!`,
    });
  } catch (err) {
    console.error(`Error updating message for gala ${galaId}:`, err);
    return interaction.editReply({
      content:
        "⚠️ An error occurred while updating the gala post. Please try again.",
    });
  }
}

module.exports = { execute };
