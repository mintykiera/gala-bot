// src/utils/embeds.js
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

function createGalaEmbedAndButtons(gala) {
  const participantList =
    gala.participants.length > 0
      ? gala.participants
          .map((p, index) => `${index + 1}. <@${p.id}> (${p.username})`)
          .join("\n")
      : "No one has joined yet.";

  let color = "#5865F2";
  let statusText = `Status: ${
    gala.status.charAt(0).toUpperCase() + gala.status.slice(1)
  }`;

  if (gala.status === "open") color = "#57F287";
  if (gala.status === "closed") color = "#ED4245";
  if (gala.status === "completed") color = "#95A5A6";
  if (gala.status === "cancelled") {
    color = "#ED4245";
    statusText = "Status: Cancelled";
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(gala.title)
    .setDescription(gala.details || "No description provided.")
    .addFields({
      name: `✅ Attendees (${gala.participants.length})`,
      value: participantList,
      inline: false,
    })
    .setFooter({
      text: `Gala ID: ${gala.id} | ${statusText} | Created by: ${gala.authorUsername}`,
    });

  const showButtons = ["open", "closed"].includes(gala.status);
  if (showButtons) {
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`join-gala_${gala.id}`)
        .setLabel("Join Gala")
        .setStyle(ButtonStyle.Success)
        .setDisabled(gala.status !== "open"),
      new ButtonBuilder()
        .setCustomId(`leave-gala_${gala.id}`)
        .setLabel("Leave Gala")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(gala.status !== "open")
    );
    return {
      embeds: [embed],
      components: [buttons],
    };
  } else {
    return {
      embeds: [embed],
      components: [],
    };
  }
}

function createHelpEmbed() {
  return new EmbedBuilder()
    .setTitle("🎀 GALA BOT HELP")
    .setDescription("Here's how to plan, manage, and join galas with ease!")
    .setColor("#FF69B4")
    .addFields(
      {
        name: "📅 /plan",
        value: "`/plan date: 24082025`\n→ Opens a form to schedule a new gala.",
        inline: false,
      },
      {
        name: "✨ /tweak",
        value:
          '`/tweak gala-id: 24082025 new-title: "Winter Ball"`\n→ Edit your gala\'s name or details.',
        inline: false,
      },
      {
        name: "🚪 /open-doors",
        value: "`/open-doors gala-id: 24082025`\n→ Let people join your gala.",
        inline: false,
      },
      {
        name: "🔒 /close-doors",
        value: "`/close-doors gala-id: 24082025`\n→ Stop new sign-ups.",
        inline: false,
      },
      {
        name: "❌ /cancel-gala",
        value:
          "`/cancel-gala gala-id: 24082025`\n→ Cancel your gala (author only).",
        inline: false,
      },
      {
        name: "🔍 /peek",
        value:
          "`/peek gala-id: 24082025`\n→ See who's joined and event details.",
        inline: false,
      },
      {
        name: "🎭 /whats-on",
        value: "`/whats-on`\n→ See all upcoming galas at a glance.",
        inline: false,
      },
      {
        name: "📜 /past-galas",
        value: "`/past-galas`\n→ See all completed/cancelled galas.",
        inline: false,
      }
    )
    .setFooter({
      text: "Tip: Use the Join/Leave buttons under each gala post!",
    });
}

function createPastGalasEmbed() {
  const { completedGalas } = require("../state");
  if (completedGalas.size === 0) {
    return new EmbedBuilder()
      .setTitle("📜 Past Galas")
      .setDescription("No galas have been completed or cancelled yet.")
      .setColor("#A9A9A9");
  }

  const sortedGalas = Array.from(completedGalas.values()).sort(
    (a, b) => parseDate(b.id) - parseDate(a.id)
  );
  const fields = sortedGalas.slice(0, 25).map((gala) => ({
    name: `${gala.status === "cancelled" ? "❌" : "🎉"} ${gala.title}`,
    value: `**Date:** \`${gala.id}\`\n**Status:** ${gala.status}\n**Created by:** ${gala.authorUsername}\n**Attendees:** ${gala.participants.length}`,
    inline: false,
  }));

  return new EmbedBuilder()
    .setTitle("📜 Past Galas")
    .setDescription(
      `Showing ${Math.min(
        completedGalas.size,
        25
      )} recent completed/cancelled galas.`
    )
    .setColor("#95A5A6")
    .addFields(fields)
    .setFooter({
      text:
        completedGalas.size > 25
          ? "Oldest galas may be trimmed. Data is still saved!"
          : "",
    });
}

const { parseDate } = require("./dateParser");

module.exports = {
  createGalaEmbedAndButtons,
  createHelpEmbed,
  createPastGalasEmbed,
};
