// src/commands/whatsOn.js
const { EmbedBuilder } = require("discord.js");
const { galas } = require("../state");
const { MessageFlags } = require("discord.js");

async function execute(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (galas.size === 0) {
    return interaction.editReply("🎭 No galas scheduled right now.");
  }

  const list = Array.from(galas.values())
    .map((g) => `**${g.title}** (ID: \`${g.id}\`) — ${g.status}`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle("🎭 Upcoming Galas")
    .setDescription(list)
    .setColor("#5865F2");

  return interaction.editReply({ embeds: [embed] });
}

module.exports = { execute };
