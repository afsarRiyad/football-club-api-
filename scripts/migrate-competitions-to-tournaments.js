/**
 * One-time migration: copy TOURNAMENT-type competitions into the Tournament collection.
 *
 * Older versions of the admin app created tournaments as competitions
 * (type: "TOURNAMENT"). The admin now reads /api/tournaments, so run this
 * once to make legacy tournaments visible there:
 *
 *   node scripts/migrate-competitions-to-tournaments.js
 */
const dotenv = require("dotenv");
dotenv.config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Competition = require("../modules/competitions/model/Competition");
const Tournament = require("../modules/tournaments/model/Tournament");

async function migrate() {
  try {
    await connectDB();
    console.log("📦 Connected to MongoDB\n");

    const competitions = await Competition.find({ type: "TOURNAMENT" }).lean();
    console.log(`Found ${competitions.length} tournament-type competition(s)\n`);

    let created = 0;
    for (const comp of competitions) {
      const exists = await Tournament.findOne({ name: comp.name, club: comp.club });
      if (exists) {
        console.log(`↩︎  Skip (already migrated): ${comp.name}`);
        continue;
      }

      const teamCount = Math.max(2, comp.teams?.length || 2);
      await Tournament.create({
        club: comp.club,
        name: comp.name,
        slug: undefined, // pre-save hook regenerates it
        format: "SINGLE_KNOCKOUT",
        teamCount: [2, 4, 8, 16, 32].includes(teamCount) ? teamCount : 2,
        description: comp.description || "",
        logo: comp.logo || "",
        season: comp.season || undefined,
        teams: comp.teams || [],
        status: "DRAFT",
      });
      created++;
      console.log(`✅ Migrated: ${comp.name} (${teamCount} teams)`);
    }

    console.log(`\nDone. ${created} tournament(s) migrated.`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();
