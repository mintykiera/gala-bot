// src/utils/scheduler.js
const { saveGalas } = require("../githubManager");
const { galas, completedGalas } = require("../state");
const { parseDate } = require("./dateParser");
const { PING_CHANNEL_ID } = require("../config");

async function dailySchedulerTick(client) {
  console.log("⏰ Daily scheduler tick...");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const guild = await client.guilds.fetch(process.env.GUILD_ID).catch((err) => {
    console.error("Could not fetch guild for scheduler.", err);
    return null;
  });
  if (!guild) return;

  let needsSave = false;

  for (const [galaId, gala] of galas.entries()) {
    const galaDate = parseDate(galaId);

    // Check if gala is today and ping hasn't been sent
    if (galaDate.getTime() === today.getTime() && !gala.pingSent) {
      console.log(`🎉 ${gala.title} is today! Sending ping.`);
      try {
        const pingChannel = await guild.channels.fetch(PING_CHANNEL_ID);
        if (pingChannel && pingChannel.isTextBased()) {
          await pingChannel.send({
            content: `<@&${gala.roleId}> The gala, **${gala.title}**, is happening today! Get ready! ✨`,
          });
          gala.pingSent = true;
          needsSave = true;
        }
      } catch (error) {
        console.error(`Failed to ping for ${gala.id}:`, error);
      }
    }

    // Auto-close sign-ups if today >= autoCloseDate
    if (gala.autoCloseDate && gala.status === "open") {
      const autoCloseDate = parseDate(gala.autoCloseDate);
      if (today.getTime() >= autoCloseDate.getTime()) {
        console.log(`🔒 Auto-closing sign-ups for ${gala.title}`);
        gala.status = "closed";
        needsSave = true;

        try {
          const channel = await guild.channels.fetch(gala.channelId);
          if (channel && channel.isTextBased()) {
            const message = await channel.messages.fetch(gala.messageId);
            if (message) {
              await message.edit(createGalaEmbedAndButtons(gala));
            }
          }
        } catch (err) {
          console.warn(`Failed to auto-close message for ${gala.id}:`, err);
        }
      }
    }

    // Check if gala date has passed and it's not already completed
    if (galaDate < today && gala.status !== "completed") {
      console.log(`✅ ${gala.title} ended. Archiving.`);
      gala.status = "completed";
      completedGalas.set(galaId, gala);
      galas.delete(galaId);
      needsSave = true;

      try {
        const role = await guild.roles.fetch(gala.roleId);
        if (role) await role.delete(`Gala "${gala.title}" has ended.`);
      } catch (error) {
        console.warn(`Could not delete role for completed gala ${gala.id}:`, error);
      }

      try {
        const channel = await guild.channels.fetch(gala.channelId);
        if (!channel || !channel.isTextBased()) continue;
        const message = await channel.messages.fetch(gala.messageId);
        if (message) {
          await message.edit(createGalaEmbedAndButtons(gala));
        }
      } catch (error) {
        console.warn(`Cleanup failed for ${gala.id}:`, error);
      }
    }
  }

  if (needsSave) {
    await saveGalas();
  }
}

module.exports = { dailySchedulerTick };