const { galas } = require("../state");
const { saveGala } = require("../databaseManager");
const { MessageFlags, EmbedBuilder } = require("discord.js");

async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const galaId = interaction.options.getString("gala-id");
  const targetUser = interaction.options.getUser("user");
  const gala = galas.get(galaId);

  if (interaction.user.id !== gala.authorId) {
    return interaction.editReply({
      content: "❌ Only the creator can remove access from this gala.",
    });
  }

  if (targetUser.id === interaction.user.id) {
    return interaction.editReply({
      content: "❌ You’re the host — you can’t remove yourself!",
    });
  }

  if (!gala.coHosts.includes(targetUser.id)) {
    return interaction.editReply({
      content: `❌ <@${targetUser.id}> is not a co-host.`,
    });
  }

  gala.coHosts = gala.coHosts.filter((id) => id !== targetUser.id);
  saveGala(gala);

  try {
    const dmEmbed = new EmbedBuilder()
      .setColor("#ED4245")
      .setTitle("🚫 Your Co-Host Access Has Been Revoked")
      .setDescription(
        `Your co-host access for the gala: **${gala.title}** (ID: \`${gala.id}\`) has been removed.`
      )
      .addFields({
        name: "What this means",
        value: "You can no longer manage this event using admin commands.",
      })
      .setFooter({ text: `Revoked by: ${interaction.user.tag}` })
      .setTimestamp();
    await targetUser.send({ embeds: [dmEmbed] });
  } catch (dmError) {
    console.warn(`Could not DM user ${targetUser.tag}:`, dmError.message);
  }

  return interaction.editReply({
    content: `✅ Removed <@${targetUser.id}> as co-host of "**${gala.title}**".`,
  });
}

module.exports = { execute };
