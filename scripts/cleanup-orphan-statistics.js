/**
 * One-time repair: delete Statistic rows that reference players who no longer exist.
 *
 * Background — deleting a player (before the backend gained reference cleanup)
 * left `Statistic.player` pointing at a removed ObjectId. Those rows come back
 * from the API as `player: null` (populate of a missing doc), which the admin
 * Statistics page used to crash on and can never display anyway.
 *
 * This script is SAFE BY DEFAULT: without flags it only reports what it would
 * delete. Pass `--apply` to actually remove the orphaned rows.
 *
 *   node scripts/cleanup-orphan-statistics.js          # dry run (report only)
 *   node scripts/cleanup-orphan-statistics.js --apply  # delete the orphans
 */
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

const mongoose = require("mongoose");
const Statistic = require("../modules/statistics/model/Statistic");

const APPLY = process.argv.includes("--apply");

async function findOrphanPlayerIds() {
  // Distinct statistic player ids that have no matching Player document.
  const orphans = await Statistic.aggregate([
    { $match: { player: { $exists: true, $ne: null } } },
    { $group: { _id: "$player" } },
    {
      $lookup: {
        from: "players",
        localField: "_id",
        foreignField: "_id",
        as: "playerDoc",
      },
    },
    { $match: { playerDoc: { $size: 0 } } },
    { $project: { _id: 1 } },
  ]);
  return orphans.map((o) => o._id);
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI is not set. Add it to FclubBackend/.env first.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log("📦 Connected to MongoDB\n");
  } catch (error) {
    console.error("❌ Could not connect to MongoDB:", error.message);
    process.exit(1);
  }

  const orphanPlayerIds = await findOrphanPlayerIds();

  if (orphanPlayerIds.length === 0) {
    console.log("✅ No statistic rows reference deleted players — nothing to clean up.");
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(
    `Found ${orphanPlayerIds.length} deleted player id(s) still referenced by statistics.\n`
  );

  // Pull the actual orphaned rows for a clear report (limited listing).
  const orphanStats = await Statistic.find({ player: { $in: orphanPlayerIds } })
    .populate("club", "name")
    .sort("-createdAt")
    .lean();

  console.log(`That's ${orphanStats.length} statistic row(s) in total.\n`);

  // Summary grouped by club and season so you can see where the damage is.
  const byClub = new Map(); // clubName -> { season -> count }
  for (const s of orphanStats) {
    const clubName = s.club && s.club.name ? s.club.name : "(no club)";
    const season = s.season || "(no season)";
    if (!byClub.has(clubName)) byClub.set(clubName, new Map());
    const seasons = byClub.get(clubName);
    seasons.set(season, (seasons.get(season) || 0) + 1);
  }

  console.log("Summary (club → season → rows):");
  for (const [clubName, seasons] of byClub) {
    console.log(`  • ${clubName}`);
    for (const [season, count] of seasons) {
      console.log(`      ${season}: ${count} row(s)`);
    }
  }

  // Preview a handful of rows being cleaned.
  console.log(`\nSample rows that would be removed (showing up to 10):`);
  for (const s of orphanStats.slice(0, 10)) {
    console.log(
      `  - club=${s.club && s.club.name ? s.club.name : "(no club)"} | ` +
        `player=${String(s.player)} (deleted) | ${s.type}=${s.value} | season=${s.season || "—"}`
    );
  }

  if (!APPLY) {
    console.log(
      `\nℹ️  Dry run — nothing was deleted. Re-run with --apply to remove ` +
        `these ${orphanStats.length} orphaned row(s).`
    );
    await mongoose.disconnect();
    process.exit(0);
  }

  const result = await Statistic.deleteMany({ player: { $in: orphanPlayerIds } });
  console.log(`\n🗑️  Deleted ${result.deletedCount} orphaned statistic row(s).`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Cleanup failed:", error);
  process.exit(1);
});
