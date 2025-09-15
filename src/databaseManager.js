const Database = require("better-sqlite3");
const { galas, completedGalas } = require("./state");

// This creates a galas.db file in your project's root directory
const db = new Database("galas.db");

/**
 * This runs once when the bot starts to ensure the database table is created with the correct structure.
 */
function setupDatabase() {
  console.log("🗄️ Setting up database schema...");
  db.exec(`
    CREATE TABLE IF NOT EXISTS galas (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      details TEXT,
      authorId TEXT,
      authorUsername TEXT,
      channelId TEXT,
      messageId TEXT,
      roleId TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      autoCloseDate TEXT,
      pingSent INTEGER NOT NULL DEFAULT 0,
      participants TEXT NOT NULL DEFAULT '[]',
      coHosts TEXT NOT NULL DEFAULT '[]',
      isCompleted INTEGER NOT NULL DEFAULT 0
    );
  `);
  console.log("✅ Database schema is ready.");
}

/**
 * Loads all gala data from the database into the in-memory state on bot startup.
 */
function loadGalas() {
  console.log("🗄️ Loading galas from database...");
  const activeStmt = db.prepare("SELECT * FROM galas WHERE isCompleted = 0");
  const completedStmt = db.prepare("SELECT * FROM galas WHERE isCompleted = 1");

  for (const gala of activeStmt.all()) {
    // Deserialize data from the database format back into the live object format
    gala.participants = JSON.parse(gala.participants);
    gala.coHosts = JSON.parse(gala.coHosts);
    gala.pingSent = Boolean(gala.pingSent); // Convert 0/1 to false/true
    galas.set(gala.id, gala);
  }

  for (const gala of completedStmt.all()) {
    gala.participants = JSON.parse(gala.participants);
    gala.coHosts = JSON.parse(gala.coHosts);
    gala.pingSent = Boolean(gala.pingSent);
    completedGalas.set(gala.id, gala);
  }

  console.log(
    `💾 Loaded ${galas.size} active, ${completedGalas.size} completed galas from database.`
  );
}

/**
 * Saves or updates a SINGLE gala in the database.
 * This is the fast, safe replacement for the old saveGalas() function.
 * @param {object} gala The gala object to save.
 */
function saveGala(gala) {
  const isCompleted = ["completed", "cancelled"].includes(gala.status) ? 1 : 0;

  // Serialize arrays and booleans into a format the database can store
  const participantsJson = JSON.stringify(gala.participants || []);
  const coHostsJson = JSON.stringify(gala.coHosts || []);
  const pingSentInt = gala.pingSent ? 1 : 0;

  const stmt = db.prepare(`
    INSERT INTO galas (
      id, title, details, authorId, authorUsername, channelId, messageId, roleId, status, 
      autoCloseDate, pingSent, participants, coHosts, isCompleted
    ) VALUES (
      @id, @title, @details, @authorId, @authorUsername, @channelId, @messageId, @roleId, @status, 
      @autoCloseDate, @pingSent, @participants, @coHosts, @isCompleted
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      details = excluded.details,
      authorId = excluded.authorId,
      authorUsername = excluded.authorUsername,
      channelId = excluded.channelId,
      messageId = excluded.messageId,
      roleId = excluded.roleId,
      status = excluded.status,
      autoCloseDate = excluded.autoCloseDate,
      pingSent = excluded.pingSent,
      participants = excluded.participants,
      coHosts = excluded.coHosts,
      isCompleted = excluded.isCompleted;
  `);

  stmt.run({
    id: gala.id,
    title: gala.title,
    details: gala.details,
    authorId: gala.authorId,
    authorUsername: gala.authorUsername,
    channelId: gala.channelId,
    messageId: gala.messageId,
    roleId: gala.roleId,
    status: gala.status,
    autoCloseDate: gala.autoCloseDate,
    pingSent: pingSentInt,
    participants: participantsJson,
    coHosts: coHostsJson,
    isCompleted: isCompleted,
  });
  console.log(`💾 Saved gala "${gala.id}" to the database.`);
}

// Run setup immediately when this file is loaded
setupDatabase();

module.exports = {
  loadGalas,
  saveGala,
};
