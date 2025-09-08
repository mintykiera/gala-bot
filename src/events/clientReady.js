// src/events/clientReady.js
const { dailySchedulerTick } = require("../utils/scheduler");

function handleClientReady(client) {
  console.log(`🚀 Bot online as ${client.user.tag}`);
  dailySchedulerTick(client).catch(console.error);
  setInterval(() => {
    dailySchedulerTick(client).catch(console.error);
  }, 60000);
}

module.exports = { handleClientReady };
