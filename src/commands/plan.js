// src/commands/plan.js
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionsBitField,
} = require("discord.js");
const { galas } = require("../state");
const { saveGalas } = require("../githubManager");
const { parseDate } = require("../utils/dateParser");

async function execute(interaction) {
  const date = interaction.options.getString("date");

  if (!/^\d{8}$/.test(date)) {
    return interaction.reply({
      content: "❌ Invalid date. Use DDMMYYYY (e.g., 24082025).",
      ephemeral: true,
    });
  }

  const galaDate = parseDate(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (isNaN(galaDate.getTime()) || galaDate < today) {
    return interaction.reply({
      content: "❌ Can't schedule in the past or invalid date.",
      ephemeral: true,
    });
  }

  if (galas.has(date) || require("../state").completedGalas.has(date)) {
    return interaction.reply({
      content: `❌ A gala with ID \`${date}\` already exists.`,
      ephemeral: true,
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
    .setPlaceholder(
      "e.g., Join us for a night of fun! Dress code: formal.\n- Live music\n- Free food"
    )
    .setRequired(true)
    .setMaxLength(2000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(detailsInput)
  );

  await interaction.showModal(modal);
}

module.exports = { execute };
