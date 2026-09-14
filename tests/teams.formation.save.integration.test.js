/**
 * Integration test: what the formation editor saves must actually persist.
 *
 * Three separate silent failures were behind "I refresh and my formation is
 * gone / my bench and captain never show up":
 *
 *  1. `PATCH /api/teams/:id` runs through `updateTeamSchema`, and the validator
 *     replaced the body with the *parsed* value. `players` was not in the schema,
 *     so the editor's roster merge was dropped on the floor — a team's roster
 *     never grew no matter how many line-ups were saved.
 *  2. The same schema is the only gate on `captain`; clearing the armband has to
 *     survive it as an explicit `null` rather than being treated as absent.
 *  3. `upsertMatchFormation` did `captain || existing.captain`, so a captain could
 *     be set but never removed — every save restored the old one.
 *
 * Real in-memory MongoDB, real validation schemas, real controllers.
 */
const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Club = require("../modules/club/model/Club");
const Team = require("../modules/teams/model/Team");
const Player = require("../modules/players/model/Player");
const MatchFormation = require("../modules/matches/model/MatchFormation");
require("../modules/competitions/model/Competition");
require("../modules/seasons/model/Season");
require("../modules/matches/model/Match");

const teamsController = require("../modules/teams/controller/teamsController");
const matchFormationController = require("../modules/matches/controller/matchFormationController");
const validate = require("../middleware/validate");
const { updateTeamSchema } = require("../modules/teams/validation/teamsValidation");
const errorHandler = require("../middleware/errorHandler");

jest.setTimeout(120000);

describe("Formation saves persist (integration)", () => {
  let mongo;
  let app;
  let club;
  let team;
  let players;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
    await mongoose.connect(mongo.getUri());

    app = express();
    app.use(express.json());
    app.patch("/api/teams/:id", validate(updateTeamSchema), teamsController.updateTeam);
    app.get("/api/teams/:id", teamsController.getTeam);
    app.post("/api/match-formations", matchFormationController.upsertMatchFormation);
    app.get("/api/match-formations/match/:matchId", matchFormationController.getMatchFormations);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      Team.deleteMany({}),
      Club.deleteMany({}),
      Player.deleteMany({}),
      MatchFormation.deleteMany({}),
    ]);

    club = await Club.create({ name: "Nayadiganta Sporting Club" });
    team = await Team.create({ club: club._id, name: "Nayadiganta Sporting Club" });
    players = await Player.create(
      [
        { firstName: "MD", lastName: "SIYAAM", position: "GOALKEEPER", number: 1 },
        { firstName: "I", lastName: "SAYEM", position: "DEFENDER", number: 4 },
        { firstName: "MD", lastName: "SAMIUL", position: "MIDFIELDER", number: 8 },
        { firstName: "MD", lastName: "SOIKOT", position: "MIDFIELDER", number: 19 },
      ].map((p) => ({ ...p, club: club._id })),
    );
  });

  const ids = (...indexes) => indexes.map((i) => players[i]._id.toString());

  it("saves the roster the editor sends (it used to be stripped by validation)", async () => {
    const res = await request(app)
      .patch(`/api/teams/${team._id}`)
      .send({ players: ids(0, 1, 2) });

    expect(res.status).toBe(200);

    const stored = await Team.findById(team._id);
    expect(stored.players.map((p) => p.toString())).toEqual(ids(0, 1, 2));

    // And it comes back on the read the editor uses.
    const read = await request(app).get(`/api/teams/${team._id}`);
    expect(read.body.data.team.players.map((p) => p._id.toString())).toEqual(ids(0, 1, 2));
  });

  it("saves a team's bench and starting XI", async () => {
    const res = await request(app)
      .patch(`/api/teams/${team._id}`)
      .send({
        formation: "4-3-3",
        bench: ids(2, 3),
        startingXI: [
          { player: players[0]._id.toString(), position: "GK", slotIndex: 0 },
          { player: players[1]._id.toString(), position: "CB", slotIndex: 2 },
        ],
      });

    expect(res.status).toBe(200);

    const stored = await Team.findById(team._id);
    expect(stored.bench.map((p) => p.toString())).toEqual(ids(2, 3));
    expect(stored.startingXI.map((e) => e.slotIndex)).toEqual([0, 2]);
  });

  it("lets the armband be cleared, not just set", async () => {
    await request(app).patch(`/api/teams/${team._id}`).send({ captain: players[1]._id.toString() });
    expect((await Team.findById(team._id)).captain.toString()).toBe(ids(1)[0]);

    const cleared = await request(app).patch(`/api/teams/${team._id}`).send({ captain: null });
    expect(cleared.status).toBe(200);
    expect((await Team.findById(team._id)).captain).toBeNull();
  });

  it("clears a match formation's captain when the editor sends null", async () => {
    const matchId = new mongoose.Types.ObjectId();

    const created = await request(app).post("/api/match-formations").send({
      club: club._id.toString(),
      team: team._id.toString(),
      match: matchId.toString(),
      formation: "4-3-3",
      playerCount: 11,
      startingXI: [{ player: players[1]._id.toString(), position: "CB", slotIndex: 2 }],
      bench: ids(2),
      captain: players[1]._id.toString(),
    });
    expect(created.status).toBe(201);
    expect((await MatchFormation.findOne({ match: matchId })).captain.toString()).toBe(ids(1)[0]);

    const cleared = await request(app).post("/api/match-formations").send({
      club: club._id.toString(),
      team: team._id.toString(),
      match: matchId.toString(),
      formation: "4-3-3",
      playerCount: 11,
      startingXI: [{ player: players[1]._id.toString(), position: "CB", slotIndex: 2 }],
      bench: ids(2),
      captain: null,
    });

    expect(cleared.status).toBe(200);
    expect((await MatchFormation.findOne({ match: matchId })).captain).toBeNull();
  });

  it("keeps the bench that was saved, so the public bench renders", async () => {
    const matchId = new mongoose.Types.ObjectId();

    // The editor always sends `captain`, even when it is empty.
    const created = await request(app).post("/api/match-formations").send({
      club: club._id.toString(),
      team: team._id.toString(),
      match: matchId.toString(),
      formation: "4-3-3",
      playerCount: 11,
      startingXI: [{ player: players[0]._id.toString(), position: "GK", slotIndex: 0 }],
      bench: ids(2, 3),
      captain: null,
    });
    expect(created.status).toBe(201);

    const read = await request(app).get(`/api/match-formations/match/${matchId}`);
    expect(read.status).toBe(200);
    expect(read.body.data[0].bench.map((p) => p.lastName)).toEqual(["SAMIUL", "SOIKOT"]);
  });
});
