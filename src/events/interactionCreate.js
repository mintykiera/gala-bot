// src/events/interactionCreate.js
const { galas, completedGalas, buttonCooldowns } = require("../state");
const { saveGalas } = require("../githubManager");
const {
  createGalaEmbedAndButtons,
  createHelpEmbed,
  createPastGalasEmbed,
} = require("../utils/embeds");
const { parseDate } = require("../utils/dateParser");
const { BUTTON_COOLDOWN_SECONDS, GUILD_ID } = require("../config");
const { MessageFlags } = require("discord.js");

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
  "give-access": require("../commands/giveAccess"),
  "remove-access": require("../commands/removeAccess"),
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
          flags: MessageFlags.Ephemeral,
        });
      }

      return await handler.execute(interaction, client);
    }

    if (interaction.isModalSubmit()) {
      const [customId, date] = interaction.customId.split("_");

      // Handle plan modal
      if (customId === "plan-gala-modal") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const title = interaction.fields.getTextInputValue("gala-title");
        const details = interaction.fields.getTextInputValue("gala-details");
        const autoCloseDateString = interaction.fields
          .getTextInputValue("auto-close-date")
          .trim();

        if (!interaction.guild.members.me.permissions.has("ManageRoles")) {
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

        let autoCloseDate = null;
        if (autoCloseDateString) {
          if (!/^\d{8}$/.test(autoCloseDateString)) {
            return interaction.editReply({
              content: "❌ Invalid auto-close date. Use DDMMYYYY format.",
            });
          }

          const parsedDate = parseDate(autoCloseDateString);
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          if (isNaN(parsedDate.getTime()) || parsedDate < today) {
            return interaction.editReply({
              content: "❌ Auto-close date can't be in the past or invalid.",
            });
          }

          const galaEventDate = parseDate(date);
          if (parsedDate >= galaEventDate) {
            return interaction.editReply({
              content: "❌ Auto-close date must be BEFORE the gala date.",
            });
          }

          autoCloseDate = autoCloseDateString;
        }

        const newGala = {
          id: date,
          title,
          details,
          status: "open",
          participants: [],
          coHosts: [],
          autoCloseDate: autoCloseDate,
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

      // ✅ HANDLE TWEAK MODAL ←←← NEW CODE HERE
      if (customId === "tweak-gala-modal") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const galaId = date;
        if (!galas.has(galaId)) {
          return interaction.editReply({
            content: `❌ No active gala found with ID \`${galaId}\`.`,
          });
        }

        const gala = galas.get(galaId);
        const isAuthor = interaction.user.id === gala.authorId;
        const isCoHost = gala.coHosts?.includes(interaction.user.id) || false;
        const hasPermission = isAuthor || isCoHost;

        if (!hasPermission) {
          return interaction.editReply({
            content: "❌ Only the creator or co-hosts can do that.",
          });
        }

        const newTitle = interaction.fields
          .getTextInputValue("new-title")
          .trim();
        const newDetails = interaction.fields.getTextInputValue("new-details");
        const autoCloseDateString = interaction.fields
          .getTextInputValue("auto-close-date")
          .trim();

        if (!newTitle) {
          return interaction.editReply({
            content: "❌ Title cannot be empty.",
          });
        }

        if (autoCloseDateString) {
          if (!/^\d{8}$/.test(autoCloseDateString)) {
            return interaction.editReply({
              content: "❌ Invalid date format. Use DDMMYYYY (e.g., 20082025).",
            });
          }

          const parsedDate = parseDate(autoCloseDateString);
          const galaEventDate = parseDate(gala.id);

          if (isNaN(parsedDate.getTime())) {
            return interaction.editReply({
              content: "❌ Invalid date. Please check the format.",
            });
          }

          if (parsedDate >= galaEventDate) {
            return interaction.editReply({
              content: "❌ Auto-close date must be BEFORE the gala date.",
            });
          }
        }

        // Apply changes
        gala.title = newTitle;
        gala.details = newDetails;
        gala.autoCloseDate = autoCloseDateString || null;

        try {
          const channel = await client.channels.fetch(gala.channelId);
          if (!channel || !channel.isTextBased()) {
            throw new Error("Channel not found");
          }

          const message = await channel.messages.fetch(gala.messageId);
          await message.edit(createGalaEmbedAndButtons(gala));

          galas.set(galaId, gala);
          await saveGalas();

          return interaction.editReply({
            content: `✅ Successfully updated "**${gala.title}**"!`,
          });
        } catch (err) {
          console.error(`Failed to update gala ${galaId}:`, err);
          return interaction.editReply({
            content: "⚠️ Failed to update the gala. Please try again.",
          });
        }
      }
    }

    if (interaction.isButton()) {
      await interaction.deferUpdate();

      const [action, galaId] = interaction.customId.split("_");
      const gala = galas.get(galaId);

      if (!gala) {
        return interaction.followUp({
          content: "❌ This gala seems to have been removed.",
          flags: MessageFlags.Ephemeral,
        });
      }

      if (gala.status !== "open") {
        return interaction.followUp({
          content: "🔒 Sign-ups are currently closed for this gala.",
          flags: MessageFlags.Ephemeral,
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
          flags: MessageFlags.Ephemeral,
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
          flags: MessageFlags.Ephemeral,
        });
      }

      let needsSave = false;
      if (action === "join-gala") {
        if (isJoined) {
          return interaction.followUp({
            content: "✅ You're already signed up for this gala!",
            flags: MessageFlags.Ephemeral,
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
            flags: MessageFlags.Ephemeral,
          });
        }
        needsSave = true;
      } else if (action === "leave-gala") {
        if (!isJoined) {
          return interaction.followUp({
            content: "⚠️ You haven't joined this gala yet.",
            flags: MessageFlags.Ephemeral,
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
            flags: MessageFlags.Ephemeral,
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
        await interaction.reply({
          content: errorMessage,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.followUp({
          content: errorMessage,
          flags: MessageFlags.Ephemeral,
        });
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
