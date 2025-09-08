// reset-galas.js
const { Octokit } = require("octokit");
require("dotenv").config();

const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_FILE_PATH = process.env.GITHUB_FILE_PATH || "galas.json";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_REPO || !GITHUB_TOKEN) {
  console.error("❌ Missing GITHUB_REPO or GITHUB_TOKEN in .env");
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

async function resetGalas() {
  try {
    let currentSha = null;
    try {
      const { data } = await octokit.request(
        "GET /repos/{owner}/{repo}/contents/{path}",
        {
          owner: GITHUB_REPO.split("/")[0],
          repo: GITHUB_REPO.split("/")[1],
          path: GITHUB_FILE_PATH,
        }
      );
      currentSha = data.sha;
    } catch (err) {
      if (err.status !== 404) throw err;
      console.log("File doesn't exist yet — will create fresh.");
    }

    const emptyData = {
      active: {},
      completed: {},
    };

    const content = Buffer.from(JSON.stringify(emptyData, null, 2)).toString(
      "base64"
    );

    await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
      owner: GITHUB_REPO.split("/")[0],
      repo: GITHUB_REPO.split("/")[1],
      path: GITHUB_FILE_PATH,
      message: "🧹 Reset gala data",
      content: content,
      sha: currentSha,
    });

    console.log("✅ Gala data reset successfully on GitHub!");
  } catch (err) {
    console.error("❌ Error resetting gala data:", err);
    process.exit(1);
  }
}

resetGalas();
