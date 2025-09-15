const { galas, completedGalas, buttonCooldowns } = require("../state");
const { saveGala } = require("../databaseManager");
const { createGalaEmbedAndButtons } = require("../utils/embeds");
const { parseDate } = require("../utils/dateParser");
const { BUTTON_COOLDOWN_SECONDS } = require("../config");
const {
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

const fs = require("fs");
const commandHandlers = {};
const commandFiles = fs
  .readdirSync("./src/commands")
  .filter((file) => file.endsWith(".js"));
for (const file of commandFiles) {
  const commandName = file.split(".")[0];
  const command = require(`../commands/${file}`);
  commandHandlers[commandName.toLowerCase()] = command;
}

async function handleInteraction(interaction, client) {
  if (!interaction.inGuild()) return;

  try {
    if (interaction.isAutocomplete()) {
      const focusedValue = interaction.options.getFocused().toLowerCase();
      let choices = [];

      for (const [id, gala] of galas.entries()) {
        if (
          gala.title.toLowerCase().includes(focusedValue) ||
          id.toLowerCase().includes(focusedValue)
        ) {
          choices.push({
            name: `[${id}] ${gala.title.substring(0, 70)}`,
            value: id,
          });
        }
      }

      if (interaction.commandName === "peek") {
        for (const [id, gala] of completedGalas.entries()) {
          if (
            gala.title.toLowerCase().includes(focusedValue) ||
            id.toLowerCase().includes(focusedValue)
          ) {
            choices.push({
              name: `[PAST] ${id} - ${gala.title.substring(0, 60)}`,
              value: id,
            });
          }
        }
      }
      await interaction.respond(choices.slice(0, 25));
      return;
    }

    if (interaction.isChatInputCommand()) {
      const handler =
        commandHandlers[
          interaction.commandName.toLowerCase().replace(/-/g, "")
        ];
      if (handler) {
        return await handler.execute(interaction, client);
      }
    }

    if (interaction.isModalSubmit()) {
      const [customIdPrefix, galaId] = interaction.customId.split("_");

      if (customIdPrefix === "plan-gala-modal") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const title = interaction.fields.getTextInputValue("gala-title");
        const details = interaction.fields.getTextInputValue("gala-details");
        const autoCloseDateString = interaction.fields
          .getTextInputValue("auto-close-date")
          .trim();

        let autoCloseDate = null;
        if (autoCloseDateString) {
          if (!/^\d{8}$/.test(autoCloseDateString)) {
            return interaction.editReply({
              content: "❌ Invalid auto-close date format. Use DDMMYYYY.",
            });
          }
          const parsedDate = parseDate(autoCloseDateString);
          if (isNaN(parsedDate.getTime()) || parsedDate >= parseDate(galaId)) {
            return interaction.editReply({
              content:
                "❌ Auto-close date must be a valid date set BEFORE the gala.",
            });
          }
          autoCloseDate = autoCloseDateString;
        }

        const newGala = {
          id: galaId,
          title,
          details,
          status: "open",
          participants: [],
          coHosts: [],
          autoCloseDate,
          messageId: null,
          channelId: interaction.channelId,
          authorId: interaction.user.id,
          authorUsername: interaction.user.username,
          roleId: null,
          pingSent: false,
        };

        try {
          const roleName = `Gala: ${title.substring(0, 50)}`;
          const galaRole = await interaction.guild.roles.create({
            name: roleName,
            mentionable: true,
          });
          newGala.roleId = galaRole.id;

          const message = await interaction.channel.send(
            createGalaEmbedAndButtons(newGala)
          );
          newGala.messageId = message.id;

          galas.set(galaId, newGala);
          saveGala(newGala);

          return interaction.editReply({
            content: `🎉 Gala "**${title}**" scheduled for \`${galaId}\`!`,
          });
        } catch (err) {
          if (newGala.roleId) {
            await interaction.guild.roles
              .delete(newGala.roleId)
              .catch(() => {});
          }
          console.error("Error during gala creation:", err);
          return interaction.editReply({
            content: "❌ Failed to create role or post announcement.",
          });
        }
      }

      if (customIdPrefix === "tweak-gala-modal") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const gala = galas.get(galaId);
        if (!gala) return;

        gala.title = interaction.fields.getTextInputValue("new-title");
        gala.details = interaction.fields.getTextInputValue("new-details");
        const autoCloseDateString = interaction.fields
          .getTextInputValue("auto-close-date")
          .trim();
        gala.autoCloseDate = autoCloseDateString || null;

        try {
          const channel = await client.channels.fetch(gala.channelId);
          const message = await channel.messages.fetch(gala.messageId);
          await message.edit(createGalaEmbedAndButtons(gala));

          saveGala(gala);

          return interaction.editReply({
            content: `✅ Successfully updated "**${gala.title}**"!`,
          });
        } catch (err) {
          console.error(`Failed to update gala ${galaId}:`, err);
          return interaction.editReply({
            content: "⚠️ Failed to update gala message.",
          });
        }
      }
    }

    if (interaction.isButton()) {
      const [action, galaId] = interaction.customId.split("_");
      const gala = galas.get(galaId);
      if (!gala) return;

      if (gala.status !== "open") {
        await interaction.deferUpdate();
        return;
      }

      const cooldownKey = `${interaction.user.id}-${galaId}`;
      const now = Date.now();
      if (
        buttonCooldowns.has(cooldownKey) &&
        now - buttonCooldowns.get(cooldownKey) < BUTTON_COOLDOWN_SECONDS * 1000
      ) {
        await interaction.deferUpdate();
        return;
      }
      buttonCooldowns.set(cooldownKey, now);

      const member = interaction.member;
      const isJoined = gala.participants.some((p) => p.id === member.id);
      const role = await interaction.guild.roles
        .fetch(gala.roleId)
        .catch(() => null);
      if (!role) {
        await interaction.deferUpdate();
        return;
      }

      let needsSave = false;
      if (action === "join-gala" && !isJoined) {
        await member.roles
          .add(role)
          .then(() => {
            gala.participants.push({
              id: member.id,
              username: member.user.username,
            });
            needsSave = true;
          })
          .catch((err) => console.error("Failed to add role:", err));
      } else if (action === "leave-gala" && isJoined) {
        await member.roles
          .remove(role)
          .then(() => {
            gala.participants = gala.participants.filter(
              (p) => p.id !== member.id
            );
            needsSave = true;
          })
          .catch((err) => console.error("Failed to remove role:", err));
      }

      if (needsSave) {
        await interaction.message.edit(createGalaEmbedAndButtons(gala));
        saveGala(gala);
      } else {
        await interaction.deferUpdate();
      }
    }
  } catch (err) {
    console.error("⚠️ Top-Level Interaction Error:", err);
  }
}

module.exports = { handleInteraction };
