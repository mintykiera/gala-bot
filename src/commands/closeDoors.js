const { galas } = require("../state");
const { saveGala } = require("../databaseManager");
const { createGalaEmbedAndButtons } = require("../utils/embeds");
const { MessageFlags } = require("discord.js");

async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const galaId = interaction.options.getString("gala-id");
  const gala = galas.get(galaId);

  const hasPermission =
    gala.authorId === interaction.user.id ||
    gala.coHosts?.includes(interaction.user.id);
  if (!hasPermission) {
    return interaction.editReply({
      content: "❌ Only the creator or co-hosts can manage this gala.",
    });
  }

  if (gala.status === "closed") {
    return interaction.editReply({
      content: `🔒 Sign-ups for "**${gala.title}**" are already closed.`,
    });
  }

  gala.status = "closed";

  try {
    const channel = await interaction.client.channels.fetch(gala.channelId);
    const message = await channel.messages.fetch(gala.messageId);
    await message.edit(createGalaEmbedAndButtons(gala));

    saveGala(gala);

    return interaction.editReply({
      content: `🔒 Sign-ups for "**${gala.title}**" have been closed.`,
    });
  } catch (err) {
    gala.status = "open";
    console.error(`Failed to close doors for gala ${gala.id}:`, err);
    return interaction.editReply({
      content:
        "⚠️ Could not update the gala message. Please check my permissions.",
    });
  }
}

module.exports = { execute };
