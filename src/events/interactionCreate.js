const { galas, buttonCooldowns } = require("../state");
const { saveGala } = require("../databaseManager"); // UPDATED
const { createGalaEmbedAndButtons } = require("../utils/embeds");
const { parseDate } = require("../utils/dateParser");
const { BUTTON_COOLDOWN_SECONDS } = require("../config");
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
      const handler = commandHandlers[interaction.commandName];
      if (handler) {
        return await handler.execute(interaction, client);
      }
    }

    if (interaction.isModalSubmit()) {
      const [customId, date] = interaction.customId.split("_");

      // Handle plan modal
      if (customId === "plan-gala-modal") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const title = interaction.fields.getTextInputValue("gala-title");
        const details = interaction.fields.getTextInputValue("gala-details");
        const autoCloseDateString = interaction.fields.getTextInputValue("auto-close-date").trim();

        if (!interaction.guild.members.me.permissions.has("ManageRoles")) {
          return interaction.editReply({
            content: "❌ I need the 'Manage Roles' permission to create a role for the gala!",
          });
        }

        const roleName = `Gala: ${title.substring(0, 50)}`;
        let galaRole;
        try {
          galaRole = await interaction.guild.roles.create({ name: roleName, mentionable: true, reason: `Role for gala: ${title}` });
        } catch (roleErr) {
          return interaction.editReply({ content: "❌ Failed to create a role. Please check my permissions." });
        }

        let autoCloseDate = null;
        if (autoCloseDateString) {
          if (!/^\d{8}$/.test(autoCloseDateString)) {
            return interaction.editReply({ content: "❌ Invalid auto-close date. Use DDMMYYYY." });
          }
          const parsedDate = parseDate(autoCloseDateString);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (isNaN(parsedDate.getTime()) || parsedDate < today) {
            return interaction.editReply({ content: "❌ Auto-close date can't be in the past." });
          }
          if (parsedDate >= parseDate(date)) {
            return interaction.editReply({ content: "❌ Auto-close date must be BEFORE the gala date." });
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

        try {
          const message = await interaction.channel.send(createGalaEmbedAndButtons(newGala));
          newGala.messageId = message.id;
        } catch (msgErr) {
          await galaRole.delete("Failed to announce gala").catch(err => console.warn("Failed to clean up role:", err));
          return interaction.editReply({ content: "❌ Failed to post the gala announcement." });
        }

        galas.set(date, newGala);
        saveGala(newGala); // UPDATED

        return interaction.editReply({ content: `🎉 Gala "**${title}**" scheduled for \`${date}\`!` });
      }

      // Handle tweak modal
      if (customId === "tweak-gala-modal") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const galaId = date;
        const gala = galas.get(galaId);

        if (!gala || !(gala.authorId === interaction.user.id || gala.coHosts?.includes(interaction.user.id))) {
          return interaction.editReply({ content: "❌ You don't have permission to edit this gala." });
        }

        const newTitle = interaction.fields.getTextInputValue("new-title").trim();
        const newDetails = interaction.fields.getTextInputValue("new-details");
        const autoCloseDateString = interaction.fields.getTextInputValue("auto-close-date").trim();

        if (!newTitle) return interaction.editReply({ content: "❌ Title cannot be empty." });

        if (autoCloseDateString) {
          if (!/^\d{8}$/.test(autoCloseDateString)) return interaction.editReply({ content: "❌ Invalid date format. Use DDMMYYYY." });
          if (parseDate(autoCloseDateString) >= parseDate(gala.id)) return interaction.editReply({ content: "❌ Auto-close date must be BEFORE the gala date." });
        }

        gala.title = newTitle;
        gala.details = newDetails;
        gala.autoCloseDate = autoCloseDateString || null;
        
        try {
          const channel = await client.channels.fetch(gala.channelId);
          const message = await channel.messages.fetch(gala.messageId);
          await message.edit(createGalaEmbedAndButtons(gala));
          
          saveGala(gala); // UPDATED
          
          return interaction.editReply({ content: `✅ Successfully updated "**${gala.title}**"!` });
        } catch (err) {
          console.error(`Failed to update gala ${galaId}:`, err);
          return interaction.editReply({ content: "⚠️ Failed to update the gala message. Please check my permissions." });
        }
      }
    }

    if (interaction.isButton()) {
      await interaction.deferUpdate();
      const [action, galaId] = interaction.customId.split("_");
      const gala = galas.get(galaId);

      if (!gala) return;
      if (gala.status !== "open") return;

      const cooldownKey = `${interaction.user.id}-${galaId}`;
      const now = Date.now();
      const cooldown = buttonCooldowns.get(cooldownKey);
      if (cooldown && now - cooldown < BUTTON_COOLDOWN_SECONDS * 1000) return;
      buttonCooldowns.set(cooldownKey, now);

      const member = interaction.member;
      const isJoined = gala.participants.some((p) => p.id === member.id);
      const role = await interaction.guild.roles.fetch(gala.roleId).catch(() => null);
      if (!role) return;

      if (action === "join-gala" && !isJoined) {
        gala.participants.push({ id: member.id, username: member.user.username });
        await member.roles.add(role).catch(() => {
            gala.participants = gala.participants.filter((p) => p.id !== member.id); // Revert state on failure
        });
      } else if (action === "leave-gala" && isJoined) {
        gala.participants = gala.participants.filter((p) => p.id !== member.id);
        await member.roles.remove(role).catch(() => {
            if (!gala.participants.some((p) => p.id === member.id)) { // Revert state on failure
                gala.participants.push({ id: member.id, username: member.user.username });
            }
        });
      }
      
      await interaction.message.edit(createGalaEmbedAndButtons(gala));
      saveGala(gala); // UPDATED
    }
  } catch (err) {
    console.error("⚠️ Interaction Error:", err);
    const errorMessage = "❌ An unexpected error occurred. Please try again later.";
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
      }
    } catch (responseErr) {
      console.error("CRITICAL: Failed to send error message to user.", responseErr);
    }
  }
}

module.exports = { handleInteraction };