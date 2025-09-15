const { galas } = require("../state");
const { saveGala } = require("../databaseManager"); // Correctly import saveGala
const { createGalaEmbedAndButtons } = require("../utils/embeds");
const { MessageFlags } = require("discord.js");

async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const galaId = interaction.options.getString("gala-id");
  if (!galas.has(galaId)) {
    return interaction.editReply({
      content: `❌ No active gala found with ID \`${galaId}\`.`,
    });
  }

  const gala = galas.get(galaId);
  const isAuthor = interaction.user.id === gala.authorId;
  const isCoHost = gala.coHosts?.includes(interaction.user.id) || false;
  const hasPermission = isAuthor || isCoHost;

  if (!hasPermission) {
    return interaction.editReply({
      content: "❌ Only the creator or co-hosts can do that.",
    });
  }

  if (gala.status === "closed") {
    return interaction.editReply("✅ Sign-ups are already closed.");
  }

  gala.status = "closed";

  try {
    const channel = await interaction.client.channels.fetch(gala.channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error("Channel not found or not text-based for update");
    }
    const message = await channel.messages.fetch(gala.messageId);
    await message.edit(createGalaEmbedAndButtons(gala));

    saveGala(gala); // Replaced saveGalas() with saveGala(gala)

    return interaction.editReply({
      content: `✅ Closed doors for "**${gala.title}**"!`,
    });
  } catch (err) {
    console.error(`Error updating message for gala ${galaId}:`, err);
    // Revert state if the message fails to update
    gala.status = "open";
    return interaction.editReply({
      content:
        "⚠️ An error occurred while updating the gala post. Please try again.",
    });
  }
}

module.exports = { execute };
