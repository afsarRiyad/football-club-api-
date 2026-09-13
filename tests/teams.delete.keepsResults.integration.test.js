/**
 * Integration test: deleting a team must not erase the results it played.
 *
 * This was a real data-loss bug. `deleteTeam` used to cascade:
 *
 *     Match.deleteMany({ $or: [{ homeTeam: id }, { awayTeam: id }] })
 *
 * so tidying up a retired or mistyped team silently deleted every fixture it had
 * played — scores, scorers and the fixtures' place in the history along with it.
 * Deleting a team is a roster decision; a played result is history and has to
 * outlive it.
 *
 * The fix has two halves, and both are covered here:
 *
 *  1. Every match stores a name/logo snapshot of each side when it is saved, so a
 *     result stays readable once the Team document is gone (case 2 below, where the
 *     Team is removed behind the controller's back).
 *  2. `deleteTeam` freezes that snapshot onto existing fixtures before removing the
 *     team, and no longer deletes the matches at all (case 1). This is what protects
 *     matches created before snapshots existed.
 *
 * Uses a real in-memory MongoDB, the real controllers, the real validation schema
 * and real models — only authentication is skipped, since it is not under test.
 */
const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Club = require("../modules/club/model/Club");
const Team = require("../modules/teams/model/Team");
const Match = require("../modules/matches/model/Match");
const Tournament = require("../modules/tournaments/model/Tournament");
require("../modules/players/model/Player");
require("../modules/competitions/model/Competition");
require("../modules/seasons/model/Season");
require("../modules/matches/model/MatchFormation");
require("../modules/statistics/model/Statistic");

const matchesController = require("../modules/matches/controller/matchesController");
const teamsController = require("../modules/teams/controller/teamsController");
const validate = require("../middleware/validate");
const { createMatchSchema } = require("../modules/matches/validation/matchesValidation");
const errorHandler = require("../middleware/errorHandler");

jest.setTimeout(120000);

describe("Deleting a team keeps the results it played", () => {
  let mongo;
  let app;
  let club;
  let ourTeam;
  let opponent;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
    await mongoose.connect(mongo.getUri());

    app = express();
    app.use(express.json());
    app.post("/api/matches", validate(createMatchSchema), matchesController.createMatch);
    app.get("/api/matches", matchesController.getAllMatches);
    app.get("/api/matches/:id", matchesController.getMatch);
    app.delete("/api/teams/:id", teamsController.deleteTeam);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      Match.deleteMany({}),
      Team.deleteMany({}),
      Club.deleteMany({}),
      Tournament.deleteMany({}),
    ]);

    club = await Club.create({ name: "Nayadiganta Sporting Club" });
    ourTeam = await Team.create({ club: club._id, name: "Bangla Bazar" });
    opponent = await Team.create({ club: club._id, name: "Hazi Bari" });
  });

  const createMatch = (overrides = {}) =>
    request(app)
      .post("/api/matches")
      .send({
        club: club._id.toString(),
        homeTeam: ourTeam._id.toString(),
        awayTeam: opponent._id.toString(),
        matchDate: new Date("2026-09-12T10:27:00.000Z").toISOString(),
        status: "FT",
        score: { home: 4, away: 1 },
        ...overrides,
      });

  it("keeps the fixture, the score and the name when a team is deleted", async () => {
    const created = await createMatch();
    expect(created.status).toBe(201);
    const matchId = created.body.data.match._id;

    const del = await request(app).delete(`/api/teams/${ourTeam._id}`);
    expect(del.status).toBe(200);

    // The result is still there at all — this is what used to vanish.
    expect(await Match.countDocuments({})).toBe(1);

    const listed = await request(app).get("/api/matches");
    expect(listed.status).toBe(200);
    expect(listed.body.total).toBe(1);

    const match = listed.body.data[0];
    expect(match._id).toBe(matchId);
    expect(match.score).toEqual({ home: 4, away: 1 });
    expect(match.status).toBe("FT");

    // ...and it still says who played, rather than "TBD".
    expect(match.homeTeam).toBeTruthy();
    expect(match.homeTeam.name).toBe("Bangla Bazar");
    expect(match.awayTeam.name).toBe("Hazi Bari");

    // The single-match endpoint agrees.
    const single = await request(app).get(`/api/matches/${matchId}`);
    expect(single.status).toBe(200);
    expect(single.body.data.match.homeTeam.name).toBe("Bangla Bazar");
  });

  it("keeps the name when the away side is the team that goes", async () => {
    await createMatch();

    await request(app).delete(`/api/teams/${opponent._id}`);

    const listed = await request(app).get("/api/matches");
    expect(listed.body.total).toBe(1);
    expect(listed.body.data[0].awayTeam.name).toBe("Hazi Bari");
    expect(listed.body.data[0].homeTeam.name).toBe("Bangla Bazar");
  });

  it("survives a team vanishing without going through deleteTeam at all", async () => {
    const created = await createMatch();
    const matchId = created.body.data.match._id;

    // Simulates a Team removed by any other route, a manual edit in the database,
    // or (as actually happened here) matches created before snapshots existed.
    await Team.findByIdAndDelete(ourTeam._id);

    const single = await request(app).get(`/api/matches/${matchId}`);
    expect(single.body.data.match.homeTeam.name).toBe("Bangla Bazar");
  });

  it("keeps the name of a match that was created before snapshots existed", async () => {
    /* The rule moving forward is that matches snapshot themselves on save, but
       every match already in the database has none — exactly like the live data
       here. The delete hook is the last moment a team's name is knowable, so it
       has to write the snapshot itself rather than rely on create having done it. */
    const legacy = await Match.create({
      club: club._id,
      homeTeam: ourTeam._id,
      awayTeam: opponent._id,
      matchDate: new Date("2026-08-01T10:00:00.000Z"),
      status: "FT",
      score: { home: 3, away: 2 },
    });
    expect(legacy.homeTeamName).toBe("");

    await Team.findByIdAndDelete(ourTeam._id);

    const kept = await Match.findById(legacy._id);
    expect(kept).toBeTruthy();
    expect(kept.homeTeamName).toBe("Bangla Bazar");

    const single = await request(app).get(`/api/matches/${legacy._id}`);
    expect(single.body.data.match.homeTeam.name).toBe("Bangla Bazar");
  });

  it("still shows the live team name, so a rename is not frozen out", async () => {
    const created = await createMatch();
    const matchId = created.body.data.match._id;

    await Team.findByIdAndUpdate(ourTeam._id, { name: "Bangla Bazar FC" });

    const single = await request(app).get(`/api/matches/${matchId}`);
    expect(single.body.data.match.homeTeam.name).toBe("Bangla Bazar FC");
  });

  it("leaves a typed-in opponent exactly as it was", async () => {
    // A one-off side has no Team document, so there is nothing to resolve. It must
    // not gain a synthetic team object — code relies on `awayTeam` being empty here.
    const created = await createMatch({ awayTeam: null, awayTeamName: "Feni XI" });
    expect(created.status).toBe(201);

    const listed = await request(app).get("/api/matches");
    const match = listed.body.data[0];

    expect(match.awayTeam).toBeFalsy();
    expect(match.awayTeamName).toBe("Feni XI");
    expect(match.awayTeamDisplayName).toBe("Feni XI");
  });

  it("drops the deleted team from a tournament roster but keeps its bracket", async () => {
    const tournament = await Tournament.create({
      club: club._id,
      name: "Winter Cup",
      format: "SINGLE_KNOCKOUT",
      teamCount: 4,
      teams: [ourTeam._id, opponent._id],
    });

    await request(app).delete(`/api/teams/${ourTeam._id}`);

    const after = await Tournament.findById(tournament._id);
    expect(after.teams.map((t) => t.toString())).toEqual([opponent._id.toString()]);
  });
});
