const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require("discord.js");
const { galas } = require("../state");

async function execute(interaction) {
  const galaId = interaction.options.getString("gala-id");
  const gala = galas.get(galaId);

  const hasPermission =
    gala.authorId === interaction.user.id ||
    gala.coHosts?.includes(interaction.user.id);

  if (!hasPermission) {
    return interaction.reply({
      content: "❌ Only the creator or co-hosts can edit this gala.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`tweak-gala-modal_${galaId}`)
    .setTitle(`Editing: ${gala.title.substring(0, 40)}`);

  const titleInput = new TextInputBuilder()
    .setCustomId("new-title")
    .setLabel("Gala Title")
    .setStyle(TextInputStyle.Short)
    .setValue(gala.title)
    .setRequired(true)
    .setMaxLength(100);

  const detailsInput = new TextInputBuilder()
    .setCustomId("new-details")
    .setLabel("Details (Markdown OK)")
    .setStyle(TextInputStyle.Paragraph)
    .setValue(gala.details || "")
    .setRequired(true)
    .setMaxLength(2000);

  const autoCloseInput = new TextInputBuilder()
    .setCustomId("auto-close-date")
    .setLabel("Auto-Close Date (Optional)")
    .setStyle(TextInputStyle.Short)
    .setValue(gala.autoCloseDate || "")
    .setPlaceholder("DDMMYYYY (e.g., 20082025)")
    .setRequired(false)
    .setMaxLength(8);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowRowBuilder().addComponents(detailsInput),
    new ActionRowBuilder().addComponents(autoCloseInput)
  );

  await interaction.showModal(modal);
}

module.exports = { execute };