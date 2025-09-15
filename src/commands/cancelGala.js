const { galas, completedGalas } = require("../state");
const { saveGala } = require("../databaseManager");
const { createGalaEmbedAndButtons } = require("../utils/embeds");
const { MessageFlags } = require("discord.js");

async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const galaId = interaction.options.getString("gala-id");

  if (
    completedGalas.has(galaId) &&
    completedGalas.get(galaId).status === "cancelled"
  ) {
    const gala = completedGalas.get(galaId);
    return interaction.editReply({
      content: `❌ Gala "**${gala.title}**" is already cancelled.`,
    });
  }

  if (!galas.has(galaId)) {
    return interaction.editReply({
      content: `❌ No active gala found with ID \`${galaId}\`.`,
    });
  }

  const gala = galas.get(galaId);
  const hasPermission =
    gala.authorId === interaction.user.id ||
    gala.coHosts?.includes(interaction.user.id);

  if (!hasPermission) {
    return interaction.editReply({
      content: "❌ Only the creator or co-hosts can cancel this gala.",
    });
  }

  gala.status = "cancelled";
  completedGalas.set(galaId, gala);
  galas.delete(galaId);

  await interaction.guild.roles
    .fetch(gala.roleId)
    .then((role) => role?.delete("Gala cancelled"))
    .catch((err) =>
      console.warn(`Could not delete role for cancelled gala ${gala.id}:`, err)
    );
  await interaction.client.channels
    .fetch(gala.channelId)
    .then((channel) => channel.messages.fetch(gala.messageId))
    .then((message) => message.edit(createGalaEmbedAndButtons(gala)))
    .catch((err) =>
      console.warn(
        `Could not update message for cancelled gala ${gala.id}:`,
        err
      )
    );

  saveGala(gala);

  return interaction.editReply({
    content: `✅ Gala "**${gala.title}**" has been cancelled.`,
  });
}

module.exports = { execute };
