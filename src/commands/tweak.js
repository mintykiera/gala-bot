// src/commands/tweak.js
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

  if (!galas.has(galaId)) {
    return interaction.reply({
      content: `❌ No active gala found with ID \`${galaId}\`.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const gala = galas.get(galaId);
  const isAuthor = interaction.user.id === gala.authorId;
  const isCoHost = gala.coHosts?.includes(interaction.user.id) || false;
  const hasPermission = isAuthor || isCoHost;

  if (!hasPermission) {
    return interaction.reply({
      content: "❌ Only the creator or co-hosts can do that.",
      flags: MessageFlags.Ephemeral,
    });
  }

  // Create modal with current values as placeholders
  const modal = new ModalBuilder()
    .setCustomId(`tweak-gala-modal_${galaId}`)
    .setTitle(
      `Tweak: ${gala.title.substring(0, 20)}${
        gala.title.length > 20 ? "..." : ""
      }`
    );

  const titleInput = new TextInputBuilder()
    .setCustomId("new-title")
    .setLabel("Gala Title")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(gala.title)
    .setValue(gala.title)
    .setRequired(true)
    .setMaxLength(100);

  const detailsInput = new TextInputBuilder()
    .setCustomId("new-details")
    .setLabel("Details (Markdown OK)")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(gala.details || "No description set")
    .setValue(gala.details || "")
    .setRequired(true)
    .setMaxLength(2000);

  const autoCloseInput = new TextInputBuilder()
    .setCustomId("auto-close-date")
    .setLabel("Auto-Close Date (Optional)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(gala.autoCloseDate || "DDMMYYYY (e.g., 20082025)")
    .setValue(gala.autoCloseDate || "")
    .setRequired(false)
    .setMaxLength(8);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(detailsInput),
    new ActionRowBuilder().addComponents(autoCloseInput)
  );

  await interaction.showModal(modal);
}

module.exports = { execute };
