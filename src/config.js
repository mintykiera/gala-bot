// src/config.js
const dotenv = require("dotenv");
dotenv.config({ quiet: true }); // Suppress dotenv logs

const PING_CHANNEL_ID = process.env.PING_CHANNEL_ID || "1312425724736704562";
const BUTTON_COOLDOWN_SECONDS = 5;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_FILE_PATH = process.env.GITHUB_FILE_PATH || "galas.json";
const DATA_FILE = require("path").join(__dirname, "..", "galas.json");

const requiredEnvVars = [
  "DISCORD_TOKEN",
  "CLIENT_ID",
  "GUILD_ID",
  "GITHUB_TOKEN",
  "GITHUB_REPO",
];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.error(`❌ Missing ${key} in .env`);
    process.exit(1);
  }
}

module.exports = {
  PING_CHANNEL_ID,
  BUTTON_COOLDOWN_SECONDS,
  GITHUB_REPO,
  GITHUB_FILE_PATH,
  DATA_FILE,
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
};
