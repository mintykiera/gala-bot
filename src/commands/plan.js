const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require("discord.js");
const { galas, completedGalas } = require("../state");
const { parseDate } = require("../utils/dateParser");

async function execute(interaction) {
  const date = interaction.options.getString("date");

  if (!/^\d{8}$/.test(date)) {
    return interaction.reply({
      content: "❌ Invalid date. Use DDMMYYYY (e.g., 24082025).",
      flags: MessageFlags.Ephemeral,
    });
  }

  const galaDate = parseDate(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (isNaN(galaDate.getTime()) || galaDate < today) {
    return interaction.reply({
      content: "❌ Can't schedule in the past or on an invalid date.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (galas.has(date) || completedGalas.has(date)) {
    return interaction.reply({
      content: `❌ A gala with ID \`${date}\` already exists.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`plan-gala-modal_${date}`)
    .setTitle("Plan a New Gala");

  const titleInput = new TextInputBuilder()
    .setCustomId("gala-title")
    .setLabel("Gala Title")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("e.g., Summer Ball 2025")
    .setRequired(true)
    .setMaxLength(100);

  const detailsInput = new TextInputBuilder()
    .setCustomId("gala-details")
    .setLabel("Details (Supports Markdown)")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("e.g., Join us for a night of fun! Dress code: formal.")
    .setRequired(true)
    .setMaxLength(2000);

  const autoCloseInput = new TextInputBuilder()
    .setCustomId("auto-close-date")
    .setLabel("Auto-Close Sign-ups On (Optional)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("DDMMYYYY (e.g., 20082025)")
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
