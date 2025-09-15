const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const db = new Database("galas.db"); // This will connect to the same DB file your bot uses

// This is a simplified version of the schema setup from your databaseManager.
// It ensures the table exists before we try to insert data into it.
db.exec(`
  CREATE TABLE IF NOT EXISTS galas (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, details TEXT, authorId TEXT, authorUsername TEXT,
    channelId TEXT, messageId TEXT, roleId TEXT, status TEXT NOT NULL DEFAULT 'open',
    autoCloseDate TEXT, pingSent INTEGER NOT NULL DEFAULT 0, participants TEXT NOT NULL DEFAULT '[]',
    coHosts TEXT NOT NULL DEFAULT '[]', isCompleted INTEGER NOT NULL DEFAULT 0
  );
`);

// Prepare the SQL statement for inserting/updating data.
// This prevents duplicates if you accidentally run the script more than once.
const stmt = db.prepare(`
  INSERT INTO galas (
    id, title, details, authorId, authorUsername, channelId, messageId, roleId, status, 
    autoCloseDate, pingSent, participants, coHosts, isCompleted
  ) VALUES (
    @id, @title, @details, @authorId, @authorUsername, @channelId, @messageId, @roleId, @status, 
    @autoCloseDate, @pingSent, @participants, @coHosts, @isCompleted
  ) ON CONFLICT(id) DO UPDATE SET
    title = excluded.title, details = excluded.details, authorId = excluded.authorId,
    authorUsername = excluded.authorUsername, channelId = excluded.channelId, messageId = excluded.messageId,
    roleId = excluded.roleId, status = excluded.status, autoCloseDate = excluded.autoCloseDate,
    pingSent = excluded.pingSent, participants = excluded.participants, coHosts = excluded.coHosts,
    isCompleted = excluded.isCompleted;
`);

// This function processes a single gala object and runs the database statement
function migrateGala(gala, isCompletedFlag) {
  // Ensure default values for fields that might be missing in your old data
  gala.participants = gala.participants || [];
  gala.coHosts = gala.coHosts || [];
  gala.pingSent = gala.pingSent || false;

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
    pingSent: gala.pingSent ? 1 : 0, // Convert boolean to integer (0 or 1)
    participants: JSON.stringify(gala.participants), // Convert array to JSON string
    coHosts: JSON.stringify(gala.coHosts), // Convert array to JSON string
    isCompleted: isCompletedFlag,
  });
  console.log(`✅ Migrated Gala: ${gala.title} (ID: ${gala.id})`);
}

// --- Main Migration Logic ---
try {
  console.log("Starting migration from galas.json...");
  const filePath = path.join(__dirname, "galas.json");
  const fileContent = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(fileContent);

  // Process all active galas
  if (data.active && typeof data.active === "object") {
    for (const gala of Object.values(data.active)) {
      migrateGala(gala, 0); // 0 means isCompleted = false
    }
  }

  // Process all completed galas
  if (data.completed && typeof data.completed === "object") {
    for (const gala of Object.values(data.completed)) {
      migrateGala(gala, 1); // 1 means isCompleted = true
    }
  }

  console.log("🎉 Migration complete! All data has been moved to galas.db.");
} catch (err) {
  if (err.code === "ENOENT") {
    console.error(
      "❌ ERROR: galas.json not found in the root directory. Please place it there and try again."
    );
  } else {
    console.error("❌ An error occurred during migration:", err);
  }
}
