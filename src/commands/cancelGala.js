// src/commands/cancelGala.js
const { galas, completedGalas } = require("../state");
const { saveGalas } = require("../githubManager");
const { createGalaEmbedAndButtons } = require("../utils/embeds");
const { MessageFlags } = require("discord.js");

async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const galaId = interaction.options.getString("gala-id");

  // Check if already cancelled
  if (completedGalas.has(galaId)) {
    const gala = completedGalas.get(galaId);
    if (gala.status === "cancelled") {
      return interaction.editReply({
        content: `❌ Gala "**${gala.title}**" has already been cancelled.`,
      });
    }
  }

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
      content: "❌ Only the creator or co-hosts can cancel this gala.",
    });
  }

  gala.status = "cancelled";
  completedGalas.set(galaId, gala);
  galas.delete(galaId);

  try {
    const role = await interaction.guild.roles.fetch(gala.roleId);
    if (role) await role.delete("Gala cancelled by author.");
  } catch (err) {
    console.warn(`Could not delete role for cancelled gala ${gala.id}:`, err);
  }

  try {
    const channel = await interaction.client.channels.fetch(gala.channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error("Channel not found or not text-based");
    }
    const message = await channel.messages.fetch(gala.messageId);
    await message.edit(createGalaEmbedAndButtons(gala));
  } catch (err) {
    console.warn(
      `Could not update message for cancelled gala ${gala.id}:`,
      err
    );
  }

  await saveGalas();

  return interaction.editReply({
    content: `✅ Gala "**${gala.title}**" has been cancelled.`,
  });
}

module.exports = { execute };
