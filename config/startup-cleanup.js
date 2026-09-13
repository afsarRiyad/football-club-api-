/**
 * Startup data-integrity sweep.
 *
 * Older player deletes (before the backend gained reference cleanup) left
 * `Statistic.player` pointing at removed ObjectIds — rows that the admin
 * Statistics page could never display (they come back as `player: null`).
 *
 * This runs once per database after the server boots and deletes those orphaned
 * rows so legacy data heals itself without a manual script. It never touches
 * legitimate rows, is fully idempotent (a marker doc records completion), and
 * can never take the server down — every failure is logged and swallowed.
 *
 * Disable with: STARTUP_CLEANUP_DISABLED=true
 */
const mongoose = require("mongoose");
const Statistic = require("../modules/statistics/model/Statistic");

const META_COLLECTION = "app_meta";
const META_KEY = "startupOrphanStatCleanup";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForConnection(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (mongoose.connection.readyState !== 1 && Date.now() < deadline) {
    await sleep(300);
  }
  return mongoose.connection.readyState === 1;
}

async function alreadyRan() {
  const meta = mongoose.connection.collection(META_COLLECTION);
  const doc = await meta.findOne({ key: META_KEY });
  return !!doc;
}

async function markRan({ orphanPlayers = 0, deletedCount = 0 } = {}) {
  const meta = mongoose.connection.collection(META_COLLECTION);
  await meta.updateOne(
    { key: META_KEY },
    {
      $set: {
        completedAt: new Date(),
        orphanPlayerCount: orphanPlayers,
        deletedRowCount: deletedCount,
      },
    },
    { upsert: true }
  );
}

async function findOrphanStatRows() {
  return Statistic.aggregate([
    { $match: { player: { $exists: true, $ne: null } } },
    {
      $lookup: {
        from: "players",
        localField: "player",
        foreignField: "_id",
        as: "playerDoc",
      },
    },
    { $match: { playerDoc: { $size: 0 } } },
    { $project: { player: 1 } },
  ]);
}

/**
 * Delete statistic rows whose player no longer exists. Runs at most once per
 * database (tracked in `app_meta`) and never throws out of the caller.
 */
async function runStartupOrphanCleanup() {
  if (process.env.STARTUP_CLEANUP_DISABLED === "true") return;

  const connected = await waitForConnection();
  if (!connected) {
    console.warn("🧹 Startup cleanup skipped — MongoDB not connected in time.");
    return;
  }

  try {
    if (await alreadyRan()) return; // already healed this database

    const orphanRows = await findOrphanStatRows();
    const playerIds = [...new Set(orphanRows.map((r) => r.player))];

    if (playerIds.length === 0) {
      await markRan({ orphanPlayers: 0, deletedCount: 0 });
      return;
    }

    const result = await Statistic.deleteMany({ player: { $in: playerIds } });
    await markRan({ orphanPlayers: playerIds.length, deletedCount: result.deletedCount });
    console.log(
      `🧹 Startup cleanup: removed ${result.deletedCount} statistic row(s) referencing ` +
        `${playerIds.length} deleted player(s).`
    );
  } catch (err) {
    // Integrity sweep must never prevent the server from booting.
    console.warn("🧹 Startup orphan-stat cleanup skipped:", err.message);
  }
}

module.exports = { runStartupOrphanCleanup };
