// src/events/interactionCreate.js
const { galas, completedGalas, buttonCooldowns } = require("../state");
const { saveGalas } = require("../githubManager");
const {
  createGalaEmbedAndButtons,
  createHelpEmbed,
  createPastGalasEmbed,
} = require("../utils/embeds");
const { parseDate } = require("../utils/dateParser");
const { BUTTON_COOLDOWN_SECONDS } = require("../config");

// Import command handlers
const commandHandlers = {
  plan: require("../commands/plan"),
  tweak: require("../commands/tweak"),
  "open-doors": require("../commands/openDoors"),
  "close-doors": require("../commands/closeDoors"),
  peek: require("../commands/peek"),
  "whats-on": require("../commands/whatsOn"),
  help: require("../commands/help"),
  "past-galas": require("../commands/pastGalas"),
  "cancel-gala": require("../commands/cancelGala"),
};

async function handleInteraction(interaction, client) {
  if (!interaction.inGuild()) return;

  try {
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;
      const handler = commandHandlers[commandName];

      if (!handler) {
        return interaction.reply({
          content: "❌ Unknown command.",
          ephemeral: true,
        });
      }

      return await handler.execute(interaction, client);
    }

    if (interaction.isModalSubmit()) {
      const [customId, date] = interaction.customId.split("_");
      if (customId === "plan-gala-modal") {
        await interaction.deferReply({ ephemeral: true });

        const title = interaction.fields.getTextInputValue("gala-title");
        const details = interaction.fields.getTextInputValue("gala-details");

        if (
          !interaction.guild.members.me.permissions.has(
            PermissionsBitField.Flags.ManageRoles
          )
        ) {
          return interaction.editReply({
            content:
              "❌ I need the 'Manage Roles' permission to create a role for the gala!",
          });
        }

        const roleName = `Gala: ${title.substring(0, 50)}`;
        let galaRole;
        try {
          galaRole = await interaction.guild.roles.create({
            name: roleName,
            mentionable: true,
            reason: `Role for gala: ${title}`,
          });
        } catch (roleErr) {
          return interaction.editReply({
            content:
              "❌ Failed to create a role for the gala. Please check my permissions.",
          });
        }

        const newGala = {
          id: date,
          title,
          details,
          status: "open",
          participants: [],
          messageId: null,
          channelId: interaction.channelId,
          authorId: interaction.user.id,
          authorUsername: interaction.user.username,
          roleId: galaRole.id,
          pingSent: false,
        };

        let message;
        try {
          const messageComponents = createGalaEmbedAndButtons(newGala);
          message = await interaction.channel.send(messageComponents);
          newGala.messageId = message.id;
        } catch (msgErr) {
          try {
            await galaRole.delete("Failed to announce gala");
          } catch (delErr) {
            console.warn("Failed to delete role after message error:", delErr);
          }
          return interaction.editReply({
            content:
              "❌ Failed to post the gala announcement. Please try again.",
          });
        }

        galas.set(date, newGala);
        await saveGalas();

        return interaction.editReply({
          content: `🎉 Gala "**${title}**" scheduled for \`${date}\`! The announcement has been posted.`,
        });
      }
    }

    if (interaction.isButton()) {
      await interaction.deferUpdate();

      const [action, galaId] = interaction.customId.split("_");
      const gala = galas.get(galaId);

      if (!gala) {
        return interaction.followUp({
          content: "❌ This gala seems to have been removed.",
          ephemeral: true,
        });
      }

      if (gala.status !== "open") {
        return interaction.followUp({
          content: "🔒 Sign-ups are currently closed for this gala.",
          ephemeral: true,
        });
      }

      const cooldownKey = `${interaction.user.id}-${galaId}`;
      const now = Date.now();
      const cooldown = buttonCooldowns.get(cooldownKey);

      if (cooldown && now - cooldown < BUTTON_COOLDOWN_SECONDS * 1000) {
        const left = (
          (cooldown + BUTTON_COOLDOWN_SECONDS * 1000 - now) /
          1000
        ).toFixed(1);
        return interaction.followUp({
          content: `⏳ Please wait ${left}s before trying again.`,
          ephemeral: true,
        });
      }
      buttonCooldowns.set(cooldownKey, now);

      const user = interaction.user;
      const member = interaction.member;
      const isJoined = gala.participants.some((p) => p.id === user.id);

      const role = await interaction.guild.roles
        .fetch(gala.roleId)
        .catch(() => null);
      if (!role) {
        return interaction.followUp({
          content:
            "⚠️ The role for this gala is missing. Please contact an admin.",
          ephemeral: true,
        });
      }

      let needsSave = false;
      if (action === "join-gala") {
        if (isJoined) {
          return interaction.followUp({
            content: "✅ You're already signed up for this gala!",
            ephemeral: true,
          });
        }
        gala.participants.push({ id: user.id, username: user.username });
        try {
          await member.roles.add(role);
        } catch (roleErr) {
          gala.participants = gala.participants.filter((p) => p.id !== user.id);
          return interaction.followUp({
            content:
              "⚠️ Failed to assign the gala role. Please try again or contact an admin.",
            ephemeral: true,
          });
        }
        needsSave = true;
      } else if (action === "leave-gala") {
        if (!isJoined) {
          return interaction.followUp({
            content: "⚠️ You haven't joined this gala yet.",
            ephemeral: true,
          });
        }
        gala.participants = gala.participants.filter((p) => p.id !== user.id);
        try {
          await member.roles.remove(role);
        } catch (roleErr) {
          if (!gala.participants.some((p) => p.id === user.id)) {
            gala.participants.push({ id: user.id, username: user.username });
          }
          return interaction.followUp({
            content:
              "⚠️ Failed to remove the gala role. Please try again or contact an admin.",
            ephemeral: true,
          });
        }
        needsSave = true;
      }

      galas.set(galaId, gala);
      try {
        await interaction.message.edit(createGalaEmbedAndButtons(gala));
      } catch (editErr) {
        console.error(`Failed to edit message for gala ${galaId}:`, editErr);
      }

      if (needsSave) {
        await saveGalas();
      }
    }
  } catch (err) {
    console.error("⚠️ Interaction Error:", err);
    const hasResponded = interaction.replied || interaction.deferred;
    const errorMessage =
      "❌ An unexpected error occurred. Please try again later.";

    try {
      if (!hasResponded) {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      }
    } catch (responseErr) {
      console.error(
        "CRITICAL: Failed to send error message to user.",
        responseErr
      );
    }
  }
}

module.exports = { handleInteraction };
