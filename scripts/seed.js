/**
 * Database Seed Script
 * Usage: node scripts/seed.js [--drop]
 *
 * --drop  Drops all collections before seeding
 */
const dotenv = require("dotenv");
dotenv.config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");

// Models
const User = require("../modules/auth/model/User");
const Club = require("../modules/club/model/Club");
const Player = require("../modules/players/model/Player");
const Team = require("../modules/teams/model/Team");
const Season = require("../modules/seasons/model/Season");
const Competition = require("../modules/competitions/model/Competition");
const Match = require("../modules/matches/model/Match");
const News = require("../modules/news/model/News");
const Gallery = require("../modules/gallery/model/Gallery");
const Academy = require("../modules/academy/model/Academy");
const Training = require("../modules/training/model/Training");
const Member = require("../modules/members/model/Member");
const Statistic = require("../modules/statistics/model/Statistic");

const DROP = process.argv.includes("--drop");

// ─── Sample Data ────────────────────────────────────────────────────

const users = [
  { name: "Admin Super", email: "admin@fclub.com", password: "password123", role: "SUPER_ADMIN" },
  { name: "Club Manager", email: "manager@fclub.com", password: "password123", role: "CLUB_ADMIN" },
  { name: "Team Boss", email: "teammanager@fclub.com", password: "password123", role: "TEAM_MANAGER" },
  { name: "Coach John", email: "coach@fclub.com", password: "password123", role: "COACH" },
  { name: "Scorer Tim", email: "scorer@fclub.com", password: "password123", role: "SCORER" },
  { name: "Alice Player", email: "alice@fclub.com", password: "password123", role: "PLAYER" },
  { name: "Bob Player", email: "bob@fclub.com", password: "password123", role: "PLAYER" },
  { name: "Carol Player", email: "carol@fclub.com", password: "password123", role: "PLAYER" },
  { name: "Dave Player", email: "dave@fclub.com", password: "password123", role: "PLAYER" },
  { name: "Eve Member", email: "eve@fclub.com", password: "password123", role: "MEMBER" },
  { name: "Frank Member", email: "frank@fclub.com", password: "password123", role: "MEMBER" },
];

const clubsData = [
  {
    name: "Royal Tigers FC",
    description: "A premier football club founded in 1995, known for developing young talent.",
    founded: 1995,
    primaryColor: "#e94560",
    secondaryColor: "#1a1a2e",
    stadium: { name: "Tigers Arena", capacity: 45000, address: "123 Stadium Road" },
    location: { city: "London", country: "England" },
    contact: { email: "info@royaltigers.com", website: "https://royaltigers.com" },
  },
  {
    name: "Metro United",
    description: "Urban football club with a passionate fanbase.",
    founded: 2005,
    primaryColor: "#0066cc",
    secondaryColor: "#ffffff",
    stadium: { name: "Metro Park", capacity: 30000, address: "456 City Avenue" },
    location: { city: "Manchester", country: "England" },
  },
];

const playersData = (clubId, userIds) => [
  {
    user: userIds[5],
    club: clubId,
    firstName: "Alice",
    lastName: "Johnson",
    number: 10,
    position: "FORWARD",
    subPosition: "STRIKER",
    dateOfBirth: new Date("1998-03-15"),
    nationality: "English",
    height: 170,
    weight: 65,
    preferredFoot: "RIGHT",
    bio: "Prolific striker with excellent finishing ability.",
  },
  {
    user: userIds[6],
    club: clubId,
    firstName: "Bob",
    lastName: "Williams",
    number: 5,
    position: "DEFENDER",
    subPosition: "CENTRE_BACK",
    dateOfBirth: new Date("1996-07-22"),
    nationality: "English",
    height: 188,
    weight: 82,
    preferredFoot: "RIGHT",
    bio: "Strong and commanding centre-back.",
  },
  {
    user: userIds[7],
    club: clubId,
    firstName: "Carol",
    lastName: "Martinez",
    number: 8,
    position: "MIDFIELDER",
    subPosition: "CENTRAL_MIDFIELDER",
    dateOfBirth: new Date("1999-11-08"),
    nationality: "Spanish",
    height: 175,
    weight: 70,
    preferredFoot: "LEFT",
    bio: "Creative midfielder with great passing range.",
  },
  {
    user: userIds[8],
    club: clubId,
    firstName: "Dave",
    lastName: "Brown",
    number: 1,
    position: "GOALKEEPER",
    dateOfBirth: new Date("1995-01-30"),
    nationality: "English",
    height: 192,
    weight: 85,
    preferredFoot: "RIGHT",
    bio: "Reliable goalkeeper with great reflexes.",
  },
];

async function seed() {
  try {
    await connectDB();
    console.log("📦 Connected to MongoDB\n");

    // ── Drop collections ──
    if (DROP) {
      console.log("🗑️  Dropping all collections...");
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        await collections[key].deleteMany({});
      }
      console.log("✅ All collections dropped\n");
    }

    // ── Users ──
    console.log("👤 Seeding users...");
    const createdUsers = await User.insertMany(users);
    console.log(`   Created ${createdUsers.length} users`);

    const adminId = createdUsers[0]._id;
    const managerId = createdUsers[1]._id;
    const teamManagerId = createdUsers[2]._id;
    const coachId = createdUsers[3]._id;
    const userIds = createdUsers.map((u) => u._id);

    // ── Clubs ──
    console.log("🏟️  Seeding clubs...");
    const clubPromises = clubsData.map((data) =>
      Club.create({ ...data, admin: managerId })
    );
    const createdClubs = await Promise.all(clubPromises);
    console.log(`   Created ${createdClubs.length} clubs`);

    const club1 = createdClubs[0];
    const club2 = createdClubs[1];

    // ── Seasons ──
    console.log("📅 Seeding seasons...");
    const seasons = await Season.insertMany([
      { club: club1._id, name: "2025/26 Season", year: 2025, startDate: new Date("2025-08-01"), endDate: new Date("2026-05-31"), isActive: true },
      { club: club1._id, name: "2024/25 Season", year: 2024, startDate: new Date("2024-08-01"), endDate: new Date("2025-05-31"), isActive: false },
      { club: club2._id, name: "2025/26 Season", year: 2025, startDate: new Date("2025-08-01"), endDate: new Date("2026-05-31"), isActive: true },
    ]);
    console.log(`   Created ${seasons.length} seasons`);

    const currentSeason = seasons[0];

    // ── Players ──
    console.log("⚽ Seeding players...");
    const createdPlayers = await Player.insertMany(playersData(club1._id, userIds));
    console.log(`   Created ${createdPlayers.length} players`);

    // ── Teams ──
    console.log("👕 Seeding teams...");
    const teams = await Team.insertMany([
      {
        club: club1._id,
        name: "Royal Tigers First XI",
        category: "SENIOR",
        division: "Premier League",
        manager: teamManagerId,
        coach: coachId,
        players: createdPlayers.map((p) => p._id),
        captain: createdPlayers[0]._id,
      },
      {
        club: club1._id,
        name: "Royal Tigers U21",
        category: "JUNIOR",
        division: "Premier League U21",
        coach: coachId,
      },
      {
        club: club2._id,
        name: "Metro United First XI",
        category: "SENIOR",
        division: "Championship",
      },
    ]);
    console.log(`   Created ${teams.length} teams`);

    const team1 = teams[0]; // Royal Tigers First XI
    const team2 = teams[2]; // Metro United First XI

    // ── Competitions ──
    console.log("🏆 Seeding competitions...");
    const competitions = await Competition.insertMany([
      {
        club: club1._id,
        name: "Premier League 2025/26",
        type: "LEAGUE",
        season: currentSeason._id,
        country: "England",
        format: "ROUND_ROBIN",
        teams: [team1._id, team2._id],
      },
      {
        club: club1._id,
        name: "FA Cup 2025/26",
        type: "CUP",
        season: currentSeason._id,
        country: "England",
        format: "KNOCKOUT",
      },
    ]);
    console.log(`   Created ${competitions.length} competitions`);

    // ── Matches ──
    console.log("⚽ Seeding matches...");
    const matches = await Match.insertMany([
      {
        club: club1._id,
        competition: competitions[0]._id,
        season: currentSeason._id,
        homeTeam: team1._id,
        awayTeam: team2._id,
        matchDate: new Date("2025-09-15T15:00:00Z"),
        venue: { name: "Tigers Arena", address: "123 Stadium Road" },
        status: "FT",
        score: { home: 3, away: 1 },
        events: [
          { type: "GOAL", minute: 23, player: createdPlayers[0]._id, description: "Header from corner" },
          { type: "GOAL", minute: 45, player: createdPlayers[2]._id, assist: createdPlayers[0]._id, description: "Long-range shot" },
          { type: "YELLOW_CARD", minute: 67, player: createdPlayers[1]._id, description: "Tactical foul" },
          { type: "GOAL", minute: 78, player: createdPlayers[0]._id, description: "Penalty kick" },
        ],
        attendance: 42000,
        referee: "Mike Dean",
      },
      {
        club: club1._id,
        competition: competitions[0]._id,
        season: currentSeason._id,
        homeTeam: team2._id,
        awayTeam: team1._id,
        matchDate: new Date("2025-10-01T19:45:00Z"),
        venue: { name: "Metro Park", address: "456 City Avenue" },
        status: "LIVE",
        score: { home: 1, away: 2 },
        events: [
          { type: "GOAL", minute: 15, player: createdPlayers[0]._id, description: "Counter-attack" },
          { type: "OWN_GOAL", minute: 33, description: "Deflection" },
          { type: "GOAL", minute: 55, player: createdPlayers[2]._id, assist: createdPlayers[0]._id, description: "Free kick" },
        ],
        referee: "Anthony Taylor",
      },
      {
        club: club1._id,
        competition: competitions[0]._id,
        season: currentSeason._id,
        homeTeam: team1._id,
        awayTeam: team2._id,
        matchDate: new Date("2025-11-20T15:00:00Z"),
        venue: { name: "Tigers Arena", address: "123 Stadium Road" },
        status: "SCHEDULED",
        score: { home: 0, away: 0 },
      },
    ]);
    console.log(`   Created ${matches.length} matches`);

    // ── News ──
    console.log("📰 Seeding news...");
    const newsArticles = await News.insertMany([
      {
        club: club1._id,
        author: adminId,
        title: "Welcome to the 2025/26 Season!",
        excerpt: "Royal Tigers FC kicks off another exciting season with new signings and big ambitions.",
        content: "The 2025/26 season is here and Royal Tigers FC is ready to compete at the highest level. With a strengthened squad and a clear tactical vision, the team is poised for success.",
        category: "ANNOUNCEMENT",
        isPublished: true,
        publishedAt: new Date("2025-08-01"),
        tags: ["season", "announcement"],
      },
      {
        club: club1._id,
        author: managerId,
        title: "Match Report: Tigers 3-1 Metro United",
        excerpt: "A dominant display from the Tigers sees them claim three points at home.",
        content: "Royal Tigers FC delivered a commanding performance to defeat Metro United 3-1 at Tigers Arena. Two goals from Alice Johnson and one from Carol Martinez sealed the victory.",
        category: "MATCH_REPORT",
        isPublished: true,
        publishedAt: new Date("2025-09-15"),
        tags: ["match-report", "premier-league"],
      },
      {
        club: club1._id,
        author: adminId,
        title: "Training Ground Upgrade Complete",
        excerpt: "State-of-the-art training facilities now available for all teams.",
        content: "We are pleased to announce the completion of our training ground upgrade. The new facilities include a hydrotherapy pool, indoor pitch, and video analysis room.",
        category: "GENERAL",
        isPublished: true,
        publishedAt: new Date("2025-08-15"),
        tags: ["facilities", "training"],
      },
    ]);
    console.log(`   Created ${newsArticles.length} news articles`);

    // ── Gallery ─────────────────────────────────────────────────────
    console.log("📸 Seeding gallery...");
    const galleries = await Gallery.insertMany([
      {
        club: club1._id,
        title: "Season Opener vs Metro United",
        description: "Photos from the opening day victory.",
        category: "MATCH",
        media: [
          { url: "https://res.cloudinary.com/demo/image/upload/sample.jpg", type: "IMAGE", caption: "Goal celebration" },
          { url: "https://res.cloudinary.com/demo/image/upload/sample2.jpg", type: "IMAGE", caption: "Team lineup" },
        ],
        isPublished: true,
      },
      {
        club: club1._id,
        title: "Pre-Season Training Camp",
        description: "Behind the scenes from our training camp in Spain.",
        category: "TRAINING",
        media: [
          { url: "https://res.cloudinary.com/demo/image/upload/sample3.jpg", type: "IMAGE", caption: "Training session" },
        ],
        isPublished: true,
      },
    ]);
    console.log(`   Created ${galleries.length} galleries`);

    // ── Academy ─────────────────────────────────────────────────────
    console.log("🎓 Seeding academy...");
    const academies = await Academy.insertMany([
      {
        club: club1._id,
        name: "Tigers Academy U16",
        description: "Youth development program for under-16 players.",
        ageGroup: "U16",
        headCoach: coachId,
        players: [createdPlayers[2]._id],
        schedule: {
          trainingDays: ["Monday", "Wednesday", "Friday"],
          trainingTime: "16:00-18:00",
        },
      },
      {
        club: club1._id,
        name: "Tigers Academy U12",
        description: "Youth development program for under-12 players.",
        ageGroup: "U12",
        headCoach: coachId,
        schedule: {
          trainingDays: ["Tuesday", "Thursday"],
          trainingTime: "16:00-17:30",
        },
      },
    ]);
    console.log(`   Created ${academies.length} academy entries`);

    // ── Training ────────────────────────────────────────────────────
    console.log("🏋️ Seeding training sessions...");
    const trainingSessions = await Training.insertMany([
      {
        club: club1._id,
        team: team1._id,
        title: "Tactical Session - Set Pieces",
        date: new Date("2025-09-10T10:00:00Z"),
        startTime: "10:00",
        endTime: "12:00",
        location: "Training Ground A",
        type: "TACTICAL",
        description: "Focus on defensive and attacking set-piece routines.",
        coach: coachId,
        status: "COMPLETED",
        attendance: [
          { player: createdPlayers[0]._id, status: "PRESENT" },
          { player: createdPlayers[1]._id, status: "PRESENT" },
          { player: createdPlayers[2]._id, status: "LATE" },
          { player: createdPlayers[3]._id, status: "PRESENT" },
        ],
      },
      {
        club: club1._id,
        team: team1._id,
        title: "Fitness and Recovery",
        date: new Date("2025-09-12T09:00:00Z"),
        startTime: "09:00",
        endTime: "10:30",
        location: "Gym",
        type: "PHYSICAL",
        description: "Light fitness session and recovery work.",
        coach: coachId,
        status: "COMPLETED",
      },
    ]);
    console.log(`   Created ${trainingSessions.length} training sessions`);

    // ── Members ─────────────────────────────────────────────────────
    console.log("🎟️  Seeding members...");
    const members = await Member.insertMany([
      {
        user: userIds[9],
        club: club1._id,
        membershipType: "PREMIUM",
        joinDate: new Date("2025-01-15"),
        expiryDate: new Date("2026-01-15"),
      },
      {
        user: userIds[10],
        club: club1._id,
        membershipType: "BASIC",
        joinDate: new Date("2025-06-01"),
        expiryDate: new Date("2026-06-01"),
      },
    ]);
    console.log(`   Created ${members.length} members`);

    // ── Statistics ──────────────────────────────────────────────────
    console.log("📊 Seeding statistics...");
    const statistics = await Statistic.insertMany([
      {
        club: club1._id,
        player: createdPlayers[0]._id,
        team: team1._id,
        season: currentSeason._id,
        type: "PLAYER_SEASON",
        matchesPlayed: 8,
        goals: 6,
        assists: 3,
        yellowCards: 1,
        redCards: 0,
        minutesPlayed: 720,
      },
      {
        club: club1._id,
        player: createdPlayers[2]._id,
        team: team1._id,
        season: currentSeason._id,
        type: "PLAYER_SEASON",
        matchesPlayed: 8,
        goals: 2,
        assists: 5,
        yellowCards: 2,
        redCards: 0,
        minutesPlayed: 680,
      },
      {
        club: club1._id,
        team: team1._id,
        season: currentSeason._id,
        competition: competitions[0]._id,
        type: "TEAM_SEASON",
        matchesPlayed: 8,
        wins: 6,
        draws: 1,
        losses: 1,
        goalsFor: 18,
        goalsAgainst: 7,
        points: 19,
        winRate: 75,
      },
    ]);
    console.log(`   Created ${statistics.length} statistics`);

    // ── Summary ─────────────────────────────────────────────────────
    console.log("\n✅ Seed complete!\n");
    console.log("📊 Summary:");
    console.log(`   Users:         ${createdUsers.length}`);
    console.log(`   Clubs:         ${createdClubs.length}`);
    console.log(`   Seasons:       ${seasons.length}`);
    console.log(`   Players:       ${createdPlayers.length}`);
    console.log(`   Teams:         ${teams.length}`);
    console.log(`   Competitions:  ${competitions.length}`);
    console.log(`   Matches:       ${matches.length}`);
    console.log(`   News:          ${newsArticles.length}`);
    console.log(`   Galleries:     ${galleries.length}`);
    console.log(`   Academies:     ${academies.length}`);
    console.log(`   Training:      ${trainingSessions.length}`);
    console.log(`   Members:       ${members.length}`);
    console.log(`   Statistics:    ${statistics.length}`);
    console.log("\n🔑 Default login: admin@fclub.com / password123");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();
