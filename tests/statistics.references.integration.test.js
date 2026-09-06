/**
 * Integration test: player ↔ statistic referential integrity.
 *
 * Uses a real in-memory MongoDB (mongodb-memory-server) with the REAL models,
 * controllers and error handler — so it exercises the actual delete cascade
 * (controller cleanup + the Player model middleware) and the write-time
 * existence guard, not mocks.
 *
 *   node tests/statistics.playerRef.integration.test.js
 *   (also picked up by `npm test` via the standard tests glob)
 */
const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Club = require("../modules/club/model/Club");
const Player = require("../modules/players/model/Player");
const Team = require("../modules/teams/model/Team");
const Match = require("../modules/matches/model/Match");
const MatchFormation = require("../modules/matches/model/MatchFormation");
const Statistic = require("../modules/statistics/model/Statistic");
const statisticsController = require("../modules/statistics/controller/statisticsController");
const playersController = require("../modules/players/controller/playersController");
const teamsController = require("../modules/teams/controller/teamsController");
const errorHandler = require("../middleware/errorHandler");

// First-run downloads the MongoDB binary; allow plenty of time.
jest.setTimeout(120000);

describe("Player/Statistic referential integrity (integration)", () => {
  let mongo;
  let app;
  let clubA;
  let clubB;
  let player;
  let ghostPlayerId; // a well-formed ObjectId that references no player

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
    await mongoose.connect(mongo.getUri());

    // Mount the REAL controllers directly (auth/validate skipped — not under test).
    app = express();
    app.use(express.json());
    app.post("/api/statistics", statisticsController.createStatistic);
    app.delete("/api/players/:id", playersController.deletePlayer);
    app.delete("/api/teams/:id", teamsController.deleteTeam);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      Statistic.deleteMany({}),
      Match.deleteMany({}),
      MatchFormation.deleteMany({}),
      Team.deleteMany({}),
      Player.deleteMany({}),
      Club.deleteMany({}),
    ]);

    clubA = await Club.create({ name: "Alpha FC" });
    clubB = await Club.create({ name: "Beta FC" });
    player = await Player.create({
      club: clubA._id,
      firstName: "Leo",
      lastName: "Test",
      number: 10,
      position: "FORWARD",
    });
    ghostPlayerId = new mongoose.Types.ObjectId();
  });

  const postStat = (overrides = {}) =>
    request(app).post("/api/statistics").send({
      club: clubA._id.toString(),
      player: player._id.toString(),
      type: "GOALS",
      value: 2,
      ...overrides,
    });

  it("rejects creating a statistic for a player that does not exist", async () => {
    const res = await postStat({ player: ghostPlayerId.toString() });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("does not exist");
    expect(await Statistic.countDocuments()).toBe(0);
  });

  it("rejects a statistic whose player belongs to a different club", async () => {
    const res = await postStat({ club: clubB._id.toString() });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("does not belong");
    expect(await Statistic.countDocuments()).toBe(0);
  });

  it("accepts a statistic for an existing player", async () => {
    const res = await postStat();

    expect(res.status).toBe(201);
    const stat = await Statistic.findOne({ player: player._id });
    expect(stat).not.toBeNull();
    expect(stat.value).toBe(2);
  });

  it("deleting a player removes their statistics AND lineup refs (via API)", async () => {
    await postStat();

    const team = await Team.create({
      club: clubA._id,
      name: "First XI",
      players: [player._id],
      captain: player._id,
      viceCaptain: player._id,
      bench: [player._id],
      startingXI: [{ player: player._id, position: "ST", slotIndex: 0 }],
    });
    await MatchFormation.create({
      club: clubA._id,
      match: new mongoose.Types.ObjectId(),
      team: team._id,
      startingXI: [{ player: player._id, position: "ST", slotIndex: 0 }],
      captain: player._id,
      bench: [player._id],
    });

    const res = await request(app).delete(`/api/players/${player._id}`);
    expect(res.status).toBe(200);

    // Statistics for the player are gone.
    expect(await Statistic.countDocuments({ player: player._id })).toBe(0);

    // Team references are purged too (players, bench, XI, captaincy).
    const reloadedTeam = await Team.findById(team._id);
    expect(reloadedTeam.players).toHaveLength(0);
    expect(reloadedTeam.bench).toHaveLength(0);
    expect(reloadedTeam.startingXI).toHaveLength(0);
    expect(reloadedTeam.captain).toBeUndefined();
    expect(reloadedTeam.viceCaptain).toBeUndefined();

    // MatchFormation references are purged too.
    const reloadedFormation = await MatchFormation.findOne({ team: team._id });
    expect(reloadedFormation.startingXI).toHaveLength(0);
    expect(reloadedFormation.bench).toHaveLength(0);
    expect(reloadedFormation.captain).toBeUndefined();
  });

  it("model middleware cascades even on a direct Player.findByIdAndDelete (no controller)", async () => {
    await postStat();

    await Player.findByIdAndDelete(player._id);

    expect(await Statistic.countDocuments({ player: player._id })).toBe(0);
  });

  // ─── Team references ───────────────────────────────────────────────
  it("rejects creating a statistic for a team that does not exist", async () => {
    const ghostTeamId = new mongoose.Types.ObjectId();
    const res = await postStat({ team: ghostTeamId.toString(), player: undefined });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("team that does not exist");
    expect(await Statistic.countDocuments()).toBe(0);
  });

  it("rejects a statistic whose team belongs to a different club", async () => {
    const otherClubTeam = await Team.create({ club: clubB._id, name: "Beta XI" });
    const res = await postStat({ team: otherClubTeam._id.toString(), player: undefined });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Team does not belong");
    expect(await Statistic.countDocuments()).toBe(0);
  });

  it("accepts a statistic for an existing team", async () => {
    const team = await Team.create({ club: clubA._id, name: "First XI" });
    const res = await postStat({ team: team._id.toString(), player: undefined });

    expect(res.status).toBe(201);
    expect(await Statistic.countDocuments({ team: team._id })).toBe(1);
  });

  it("deleting a team removes its matches, formations, and statistics (via API)", async () => {
    const team = await Team.create({ club: clubA._id, name: "First XI" });
    const opponent = await Team.create({ club: clubB._id, name: "Rivals" });
    const match = await Match.create({
      club: clubA._id,
      homeTeam: team._id,
      awayTeam: opponent._id,
      matchDate: new Date(),
    });
    await MatchFormation.create({
      club: clubA._id,
      match: match._id,
      team: team._id,
    });
    await Statistic.create({
      club: clubA._id,
      team: team._id,
      type: "GOALS",
      value: 3,
    });

    const res = await request(app).delete(`/api/teams/${team._id}`);
    expect(res.status).toBe(200);

    expect(await Match.countDocuments({ homeTeam: team._id })).toBe(0);
    expect(await Match.countDocuments({ awayTeam: team._id })).toBe(0);
    expect(await MatchFormation.countDocuments({ team: team._id })).toBe(0);
    expect(await Statistic.countDocuments({ team: team._id })).toBe(0);
  });

  it("model middleware cascades on a direct Team.findByIdAndDelete (no controller)", async () => {
    const team = await Team.create({ club: clubA._id, name: "Solo XI" });
    const match = await Match.create({
      club: clubA._id,
      homeTeam: team._id,
      awayTeam: player._id, // player id is fine as a stand-in ObjectId ref here
      matchDate: new Date(),
    });
    await Statistic.create({ club: clubA._id, team: team._id, type: "APPEARANCES", value: 1 });

    await Team.findByIdAndDelete(team._id);

    expect(await Match.countDocuments({ _id: match._id })).toBe(0);
    expect(await Statistic.countDocuments({ team: team._id })).toBe(0);
  });
});