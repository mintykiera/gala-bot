// src/githubManager.js
const { Octokit } = require("octokit");
const { GITHUB_REPO, GITHUB_FILE_PATH } = require("./config");
const { galas, completedGalas } = require("./state");

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function loadGalas() {
  try {
    console.log("☁️ Loading galas from GitHub...");
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner: GITHUB_REPO.split("/")[0],
        repo: GITHUB_REPO.split("/")[1],
        path: GITHUB_FILE_PATH,
      }
    );

    const content = Buffer.from(data.content, "base64").toString("utf8");
    const stored = JSON.parse(content);

    if (stored.active && typeof stored.active === "object") {
      for (const [id, gala] of Object.entries(stored.active)) {
        if (
          gala &&
          typeof gala === "object" &&
          typeof gala.title === "string" &&
          typeof gala.id === "string"
        ) {
          if (!Array.isArray(gala.participants)) gala.participants = [];
          if (
            !["open", "closed", "completed", "cancelled"].includes(gala.status)
          ) {
            gala.status = "open";
          }
          gala.pingSent = gala.pingSent ?? false;
          galas.set(id, gala);
        }
      }
    }

    if (stored.completed && typeof stored.completed === "object") {
      for (const [id, gala] of Object.entries(stored.completed)) {
        if (
          gala &&
          typeof gala === "object" &&
          typeof gala.title === "string" &&
          typeof gala.id === "string"
        ) {
          if (!Array.isArray(gala.participants)) gala.participants = [];
          if (!["completed", "cancelled"].includes(gala.status)) {
            gala.status = "completed";
          }
          completedGalas.set(id, gala);
        }
      }
    }

    console.log(
      `💾 Loaded ${galas.size} active, ${completedGalas.size} completed galas from GitHub.`
    );
  } catch (err) {
    if (err.status === 404) {
      console.log("🆕 No galas.json found on GitHub — starting fresh.");
      await saveGalas();
    } else {
      console.error("❌ Error loading galas from GitHub:", err);
    }
  }
}

async function saveGalas() {
  try {
    console.log("💾 Saving galas to GitHub...");
    let currentSha;
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
      currentSha = null;
    }

    const data = {
      active: Object.fromEntries(galas.entries()),
      completed: Object.fromEntries(completedGalas.entries()),
    };

    const content = Buffer.from(JSON.stringify(data, null, 2)).toString(
      "base64"
    );

    await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
      owner: GITHUB_REPO.split("/")[0],
      repo: GITHUB_REPO.split("/")[1],
      path: GITHUB_FILE_PATH,
      message: "💾 Auto-save gala data",
      content: content,
      sha: currentSha,
    });
    console.log("✅ Gala data saved to GitHub.");
  } catch (err) {
    console.error("❌ Error saving gala data to GitHub:", err);
  }
}

module.exports = { loadGalas, saveGalas };
