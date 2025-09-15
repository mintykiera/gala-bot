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
      content: "❌ Only the creator can grant access to this gala.",
    });
  }

  if (targetUser.id === interaction.user.id) {
    return interaction.editReply({ content: "❌ You’re already the host!" });
  }

  if (targetUser.bot) {
    return interaction.editReply({
      content: "❌ You cannot give co-host access to a bot.",
    });
  }

  if (gala.coHosts.includes(targetUser.id)) {
    return interaction.editReply({
      content: `❌ <@${targetUser.id}> is already a co-host.`,
    });
  }

  gala.coHosts.push(targetUser.id);
  saveGala(gala);

  try {
    const dmEmbed = new EmbedBuilder()
      .setColor("#57F287")
      .setTitle("🎉 You've Been Granted Co-Host Access!")
      .setDescription(
        `You are now a co-host for the gala: **${gala.title}** (ID: \`${gala.id}\`)`
      )
      .addFields({
        name: "What can you do?",
        value:
          "You can now use `/tweak`, `/open-doors`, `/close-doors`, and `/cancel-gala` for this event.",
      })
      .setFooter({ text: `Granted by: ${interaction.user.tag}` })
      .setTimestamp();
    await targetUser.send({ embeds: [dmEmbed] });
  } catch (dmError) {
    console.warn(`Could not DM user ${targetUser.tag}:`, dmError.message);
  }

  return interaction.editReply({
    content: `✅ <@${targetUser.id}> is now a co-host of "**${gala.title}**"!`,
  });
}

module.exports = { execute };
