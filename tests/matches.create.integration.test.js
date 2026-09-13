/**
 * Integration test: creating a match from the admin form.
 *
 * Uses a real in-memory MongoDB and the REAL validation schema, controller and
 * model, so it exercises the actual create path rather than mocks.
 *
 * Two regressions are covered here:
 *
 *  1. The validation middleware REPLACES req.body with the Zod-parsed object and
 *     Zod drops undeclared keys. `status`, `score` and `attendance` were missing
 *     from createMatchSchema, so a match created directly as "FT 4-1" was stored
 *     as SCHEDULED 0-0 and never appeared in the homepage Results section.
 *
 *  2. The opponent may be one of the club's Team documents OR a one-off typed
 *     name. A typed name must be stored on the match only — it must never create
 *     a Team document.
 */
const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Club = require("../modules/club/model/Club");
const Team = require("../modules/teams/model/Team");
const Match = require("../modules/matches/model/Match");
/* getAllMatches populates these refs, and Mongoose throws if the referenced
   model was never registered — the models have to be loaded even though this
   test never writes to them. */
require("../modules/players/model/Player");
require("../modules/competitions/model/Competition");
const matchesController = require("../modules/matches/controller/matchesController");
const validate = require("../middleware/validate");
const { createMatchSchema } = require("../modules/matches/validation/matchesValidation");
const errorHandler = require("../middleware/errorHandler");

jest.setTimeout(120000);

describe("Match creation (integration)", () => {
  let mongo;
  let app;
  let club;
  let ourTeam;
  let opponent;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
    await mongoose.connect(mongo.getUri());

    // The real create route, minus auth — authorization is not under test.
    app = express();
    app.use(express.json());
    app.post("/api/matches", validate(createMatchSchema), matchesController.createMatch);
    app.get("/api/matches", matchesController.getAllMatches);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all([Match.deleteMany({}), Team.deleteMany({}), Club.deleteMany({})]);

    club = await Club.create({ name: "Nayadiganta Sporting Club" });
    ourTeam = await Team.create({ club: club._id, name: "Nayadiganta Sporting Club" });
    opponent = await Team.create({ club: club._id, name: "Hazi Bari" });
  });

  const post = (overrides = {}) =>
    request(app)
      .post("/api/matches")
      .send({
        club: club._id.toString(),
        homeTeam: ourTeam._id.toString(),
        matchDate: new Date("2026-09-12T10:27:00.000Z").toISOString(),
        ...overrides,
      });

  it("keeps the status, score and attendance the admin form sends", async () => {
    const res = await post({
      awayTeam: opponent._id.toString(),
      status: "FT",
      score: { home: 4, away: 1 },
      attendance: 1200,
    });

    expect(res.status).toBe(201);

    const saved = await Match.findById(res.body.data.match._id);
    expect(saved.status).toBe("FT");
    expect(saved.score.home).toBe(4);
    expect(saved.score.away).toBe(1);
    expect(saved.attendance).toBe(1200);
  });

  it("stores a typed opponent on the match without creating a team", async () => {
    const teamsBefore = await Team.countDocuments();

    const res = await post({ awayTeam: null, awayTeamName: "Feni XI", status: "FT", score: { home: 2, away: 2 } });

    expect(res.status).toBe(201);
    expect(await Team.countDocuments()).toBe(teamsBefore);

    const saved = await Match.findById(res.body.data.match._id);
    expect(saved.awayTeamName).toBe("Feni XI");
    expect(saved.awayTeam ?? null).toBeNull();
    expect(saved.awayTeamDisplayName).toBe("Feni XI");
  });

  it("still requires an opponent when neither a team nor a name is given", async () => {
    const res = await post({ awayTeamName: "   " });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Away team is required");
    expect(await Match.countDocuments()).toBe(0);
  });

  it("resolves the opponent name for a match linked to a real team", async () => {
    const res = await post({ awayTeam: opponent._id.toString() });

    const saved = await Match.findById(res.body.data.match._id).populate("awayTeam", "name");
    expect(saved.awayTeamDisplayName).toBe("Hazi Bari");
  });

  it("lists finished matches separately from scheduled fixtures", async () => {
    const post1 = await post({ awayTeam: opponent._id.toString(), status: "FT", score: { home: 4, away: 1 } });
    expect(post1.status).toBe(201);
    await post({ awayTeam: opponent._id.toString(), status: "SCHEDULED", matchDate: new Date("2026-10-01T10:00:00.000Z").toISOString() });
    await post({ awayTeam: opponent._id.toString(), status: "SCHEDULED", matchDate: new Date("2026-10-08T10:00:00.000Z").toISOString() });

    const finished = await request(app).get("/api/matches").query({ status: "FT,LIVE,HT", limit: 4, sort: "-matchDate" });
    expect(finished.status).toBe(200);
    expect(finished.body.data).toHaveLength(1);
    expect(finished.body.data[0].status).toBe("FT");

    const fixtures = await request(app).get("/api/matches").query({ status: "SCHEDULED", limit: 4, sort: "matchDate" });
    expect(fixtures.body.data).toHaveLength(2);
    expect(fixtures.body.data.map((m) => m.status)).toEqual(["SCHEDULED", "SCHEDULED"]);
  });
});
