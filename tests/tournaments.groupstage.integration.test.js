/**
 * Integration test: "auto match setup" for a group-then-knockout tournament.
 *
 * Covers the whole stated flow: create the tournament, add teams, generate the
 * groups + knockout tree in one call, play the group matches, and have the
 * qualifiers land in the knockout round.
 *
 * Two real bugs are locked down here:
 *
 *  1. The knockout seeds were written into the wrong matches. Every PENDING
 *     knockout match was sorted by `position` alone, but a semi-final, the final
 *     and quarter-final #1 all have position 0 — so qualifiers were scattered
 *     across rounds instead of filling the first one.
 *
 *  2. `nextMatchId` was always undefined. The generators link rounds from plain
 *     objects that have no `_id` yet (Mongoose assigns those when the array is
 *     cast onto the document, which happens afterwards), so `advanceWinner`
 *     bailed out on its first line and no winner ever moved on.
 */
jest.mock("../middleware/auth", () => ({
  protect: (req, res, next) => {
    req.user = { id: "test-admin", role: "CLUB_ADMIN", club: "test-club" };
    next();
  },
}));

const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Club = require("../modules/club/model/Club");
const Team = require("../modules/teams/model/Team");
const Tournament = require("../modules/tournaments/model/Tournament");
const tournamentRoutes = require("../modules/tournaments/routes/tournamentRoutes");
const errorHandler = require("../middleware/errorHandler");

jest.setTimeout(120000);

describe("Tournament group stage → knockout (integration)", () => {
  let mongo;
  let app;
  let club;
  let teams;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
    await mongoose.connect(mongo.getUri());

    app = express();
    app.use(express.json());
    app.use("/api/tournaments", tournamentRoutes);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all([Tournament.deleteMany({}), Team.deleteMany({}), Club.deleteMany({})]);

    club = await Club.create({ name: "Nayadiganta Sporting Club" });
    teams = await Team.create([
      { club: club._id, name: "Alpha" },
      { club: club._id, name: "Bravo" },
      { club: club._id, name: "Charlie" },
      { club: club._id, name: "Delta" },
    ]);
  });

  /** Create + fill + generate in one go, exactly like the admin create wizard. */
  const createGroupTournament = async () => {
    const created = await request(app)
      .post("/api/tournaments")
      .send({
        club: club._id.toString(),
        name: "Summer Cup 26",
        format: "GROUP_AND_KNOCKOUT",
        teamCount: 4,
        matchIntervalDays: 2,
      });
    expect(created.status).toBe(201);
    const id = created.body.data.tournament._id;

    for (const team of teams) {
      const added = await request(app)
        .post(`/api/tournaments/${id}/teams`)
        .send({ teamId: team._id.toString() });
      expect(added.status).toBe(200);
    }

    const generated = await request(app)
      .post(`/api/tournaments/${id}/generate-bracket`)
      .send({ startDate: new Date("2026-09-21T09:00:00.000Z").toISOString(), matchIntervalDays: 2, numGroups: 2 });
    expect(generated.status).toBe(200);

    return id;
  };

  const bracket = async (id) => {
    const res = await request(app).get(`/api/tournaments/${id}/bracket`);
    expect(res.status).toBe(200);
    return res.body.data;
  };

  const recordResult = async (id, matchId, homeScore, awayScore) => {
    const res = await request(app)
      .post(`/api/tournaments/${id}/matches/${matchId}/result`)
      .send({ homeScore, awayScore });
    expect(res.status).toBe(200);
    return res.body.data.tournament;
  };

  it("generates group matches plus a knockout tree in one call", async () => {
    const id = await createGroupTournament();
    const { bracket: rounds, tournament } = await bracket(id);

    // 4 teams in 2 groups → one round-robin match per group, then 2 semis + final.
    expect(rounds.GROUP_STAGE).toHaveLength(2);
    expect(rounds.SEMI_FINAL).toHaveLength(2);
    expect(rounds.FINAL).toHaveLength(1);
    expect(tournament.currentRound).toBe("GROUP_STAGE");

    // Every group match is a real fixture between two different teams.
    for (const match of rounds.GROUP_STAGE) {
      expect(["A", "B"]).toContain(match.group);
      expect(match.homeTeam?._id).toBeTruthy();
      expect(match.awayTeam?._id).toBeTruthy();
      expect(match.homeTeam._id).not.toBe(match.awayTeam._id);
      expect(match.status).toBe("SCHEDULED");
      expect(match.matchDate).toBeTruthy();
    }

    // One match per group, and the groups hold disjoint teams.
    const groupA = rounds.GROUP_STAGE.filter((m) => m.group === "A");
    const groupB = rounds.GROUP_STAGE.filter((m) => m.group === "B");
    expect(groupA).toHaveLength(1);
    expect(groupB).toHaveLength(1);

    // Knockout slots wait for the qualifiers.
    for (const match of [...rounds.SEMI_FINAL, ...rounds.FINAL]) {
      expect(match.homeTeam).toBeNull();
      expect(match.awayTeam).toBeNull();
      expect(match.status).toBe("PENDING");
    }
  });

  it("returns the team roster from the bracket endpoint (admin page keeps one payload)", async () => {
    const id = await createGroupTournament();
    const { tournament } = await bracket(id);

    // The admin page fetches this AND /tournaments/:id and merges them. When the
    // bracket payload omitted `teams` it wiped the roster and threw on render.
    expect(Array.isArray(tournament.teams)).toBe(true);
    expect(tournament.teams).toHaveLength(4);
    expect(tournament.teams[0]).toHaveProperty("name");
  });

  it("keeps bracket links so a winner can travel to the next round", async () => {
    const id = await createGroupTournament();
    const stored = await Tournament.findById(id);

    const withLinks = stored.matches.filter((m) => m.nextMatchId);
    // 2 semis feeding the final.
    expect(withLinks).toHaveLength(2);

    const finalId = stored.matches.find((m) => m.round === "FINAL")._id.toString();
    for (const match of withLinks) {
      expect(match.nextMatchId.toString()).toBe(finalId);
      expect([0, 1]).toContain(match.nextMatchPosition);
    }
    // The two semis must feed different slots, or both winners collide.
    expect(new Set(withLinks.map((m) => m.nextMatchPosition)).size).toBe(2);
  });

  it("seeds the qualifiers into the first knockout round only", async () => {
    const id = await createGroupTournament();
    const initial = await bracket(id);

    // Group A: Alpha beats Bravo. Group B: Charlie beats Delta.
    const groupA = initial.bracket.GROUP_STAGE.find((m) => m.group === "A");
    const groupB = initial.bracket.GROUP_STAGE.find((m) => m.group === "B");
    await recordResult(id, groupA._id, 2, 0);
    const afterGroups = await recordResult(id, groupB._id, 3, 1);

    const semis = afterGroups.matches.filter((m) => m.round === "SEMI_FINAL");
    const final = afterGroups.matches.find((m) => m.round === "FINAL");

    // Both semi-finals are now playable...
    for (const semi of semis) {
      expect(semi.status).toBe("SCHEDULED");
      expect(semi.homeTeam).toBeTruthy();
      expect(semi.awayTeam).toBeTruthy();
    }

    // ...and the final is still waiting for them.
    expect(final.status).toBe("PENDING");
    expect(final.homeTeam ?? null).toBeNull();
    expect(final.awayTeam ?? null).toBeNull();

    // A group winner faces the other group's runner-up — never a rematch.
    const pairings = semis.map((m) => [m.homeTeam.toString(), m.awayTeam.toString()]);
    expect(pairings).toHaveLength(2);
    expect(afterGroups.currentRound).toBe("SEMI_FINAL");

    /* Which group a side was drawn into is random, so read it from the draw
       instead of assuming — the property under test is that a group winner
       faces another group's runner-up, never the side it already played. */
    const groupOf = new Map();
    for (const gm of initial.bracket.GROUP_STAGE) {
      groupOf.set(gm.homeTeam._id.toString(), gm.group);
      groupOf.set(gm.awayTeam._id.toString(), gm.group);
    }

    const flat = pairings.flat();
    expect(flat.every((id) => groupOf.has(id))).toBe(true);
    for (const [home, away] of pairings) {
      expect(groupOf.get(home)).not.toBe(groupOf.get(away));
    }
  });

  it("regenerating replaces the fixture list instead of duplicating it", async () => {
    const id = await createGroupTournament();
    const first = await bracket(id);
    const firstIds = Object.values(first.bracket).flat().map((m) => m._id).sort();

    // What the admin's Regenerate button does. It is the only repair path for a
    // bracket built by an older generator (a 4-team draw used to produce two
    // finals and no links between rounds).
    const again = await request(app)
      .post(`/api/tournaments/${id}/generate-bracket`)
      .send({ startDate: new Date("2026-09-21T09:00:00.000Z").toISOString(), matchIntervalDays: 2, numGroups: 2 });
    expect(again.status).toBe(200);

    const second = await bracket(id);
    const secondIds = Object.values(second.bracket).flat().map((m) => m._id).sort();

    expect(secondIds).toHaveLength(firstIds.length);
    expect(second.bracket.FINAL).toHaveLength(1);
    expect(second.bracket.SEMI_FINAL).toHaveLength(2);
    // Fresh matches, not the old ones kept alongside.
    expect(secondIds).not.toEqual(firstIds);
  });

  it("accepts a hand-typed side without ever creating a Team document", async () => {
    const teamsBefore = await Team.countDocuments();

    const created = await request(app).post("/api/tournaments").send({
      club: club._id.toString(),
      name: "Guest Cup",
      format: "SINGLE_KNOCKOUT",
      teamCount: 4,
      manualTeams: ["Feni XI", "Sonaimuri United"],
    });
    expect(created.status).toBe(201);
    const id = created.body.data.tournament._id;
    expect(created.body.data.tournament.manualTeams).toEqual(["Feni XI", "Sonaimuri United"]);

    for (const team of teams.slice(0, 2)) {
      const added = await request(app)
        .post(`/api/tournaments/${id}/teams`)
        .send({ teamId: team._id.toString() });
      expect(added.status).toBe(200);
    }

    const generated = await request(app)
      .post(`/api/tournaments/${id}/generate-bracket`)
      .send({ matchIntervalDays: 2 });
    expect(generated.status).toBe(200);

    // A typed side is text on the tournament, never a Team.
    expect(await Team.countDocuments()).toBe(teamsBefore);

    const { bracket: rounds } = await bracket(id);
    const firstRound = rounds.SEMI_FINAL;
    expect(firstRound).toHaveLength(2);

    const names = firstRound.flatMap((m) => [m.homeTeamName, m.awayTeamName]);
    expect(names).toContain("Feni XI");
    // Every slot carries a name snapshot, whether it is a real team or typed in.
    expect(names.every((n) => Boolean(n))).toBe(true);

    // A typed side has no Team ref, but the slot is still playable.
    const typedSlot = firstRound.find((m) => m.homeTeamName === "Feni XI" || m.awayTeamName === "Feni XI");
    expect(typedSlot.status).toBe("SCHEDULED");
    expect(typedSlot.homeTeamName === "Feni XI" ? typedSlot.homeTeam : typedSlot.awayTeam).toBeNull();
  });

  it("keeps the name a side played under after it is removed from the tournament", async () => {
    const id = await createGroupTournament();
    const initial = await bracket(id);

    const played = initial.bracket.GROUP_STAGE[0];
    const playedName = played.homeTeam.name;
    const playedTeamId = played.homeTeam._id;
    await recordResult(id, played._id, 2, 0);

    /* Mid-tournament, a side that still has a fixture to play cannot be removed —
       that would leave a slot nobody can fill. */
    await Tournament.findByIdAndUpdate(id, { status: "IN_PROGRESS" });
    const stillToPlay = initial.bracket.GROUP_STAGE[1].homeTeam._id;
    const blocked = await request(app).delete(`/api/tournaments/${id}/teams/${stillToPlay}`);
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toMatch(/still has matches to play/i);

    // The side whose matches are finished can go, and the result keeps its name.
    const removed = await request(app).delete(`/api/tournaments/${id}/teams/${playedTeamId}`);
    expect(removed.status).toBe(200);

    const after = await bracket(id);
    const stored = after.bracket.GROUP_STAGE.find((m) => m._id === played._id);
    // The result is untouched, and the fixture still names the side.
    expect(stored.homeTeamName).toBe(playedName);
    expect(stored.homeScore).toBe(2);

    /* The case that used to lose the name: the Team document itself is deleted
       from the club's teams, so the reference dangles. The match must still show
       who played, which is exactly what the snapshot is for. */
    await Team.findByIdAndDelete(playedTeamId);

    const orphaned = await bracket(id);
    const orphan = orphaned.bracket.GROUP_STAGE.find((m) => m._id === played._id);
    expect(orphan.homeTeam ?? null).toBeNull();
    expect(orphan.homeTeamName).toBe(playedName);
    expect(orphan.homeScore).toBe(2);
    expect(orphan.awayTeamName).toBeTruthy();
  });

  it("stores goal scorers and assists with the result", async () => {
    const id = await createGroupTournament();
    const { bracket: rounds } = await bracket(id);
    const match = rounds.GROUP_STAGE[0];

    const res = await request(app)
      .post(`/api/tournaments/${id}/matches/${match._id}/result`)
      .send({
        homeScore: 2,
        awayScore: 1,
        events: [
          { type: "GOAL", minute: 12, side: "HOME", playerName: "Rakib", assistName: "Sabbir" },
          { type: "GOAL", minute: 44, side: "HOME", playerName: "Nayem" },
          { type: "GOAL", minute: 70, side: "AWAY", playerName: "Their striker" },
          { type: "YELLOW_CARD", minute: 80, side: "AWAY", playerName: "Their defender" },
        ],
      });
    expect(res.status).toBe(200);

    // Re-read: the events must survive the Zod-validated route and the database.
    const stored = await Tournament.findById(id);
    const saved = stored.matches.id(match._id);
    expect(saved.events).toHaveLength(4);
    expect(saved.events[0]).toMatchObject({
      type: "GOAL",
      minute: 12,
      side: "HOME",
      playerName: "Rakib",
      assistName: "Sabbir",
    });
    expect(saved.events[3]).toMatchObject({ type: "YELLOW_CARD", side: "AWAY" });

    // Editing the result without events must not silently wipe them.
    const again = await request(app)
      .post(`/api/tournaments/${id}/matches/${match._id}/result`)
      .send({ homeScore: 3, awayScore: 1 });
    expect(again.status).toBe(200);
    expect((await Tournament.findById(id)).matches.id(match._id).events).toHaveLength(4);
  });

  it("lets a hand-typed side win its group and reach the knockout", async () => {
    const created = await request(app).post("/api/tournaments").send({
      club: club._id.toString(),
      name: "Guest Groups Cup",
      format: "GROUP_AND_KNOCKOUT",
      teamCount: 4,
      manualTeams: ["Feni XI", "Sonaimuri United"],
      matchIntervalDays: 2,
    });
    const id = created.body.data.tournament._id;

    for (const team of teams.slice(0, 2)) {
      await request(app).post(`/api/tournaments/${id}/teams`).send({ teamId: team._id.toString() });
    }
    await request(app)
      .post(`/api/tournaments/${id}/generate-bracket`)
      .send({ startDate: new Date("2026-09-21T09:00:00.000Z").toISOString(), matchIntervalDays: 2, numGroups: 2 });

    const initial = await bracket(id);
    const groupMatches = initial.bracket.GROUP_STAGE;
    expect(groupMatches).toHaveLength(2);

    // Whichever group Feni XI is in, it wins it.
    for (const gm of groupMatches) {
      const feniIsHome = gm.homeTeamName === "Feni XI";
      const feniIsAway = gm.awayTeamName === "Feni XI";
      await recordResult(id, gm._id, feniIsHome ? 3 : 0, feniIsAway ? 3 : 0);
    }

    const after = await bracket(id);
    const semis = after.bracket.SEMI_FINAL;
    expect(semis).toHaveLength(2);

    const names = semis.flatMap((m) => [m.homeTeamName, m.awayTeamName]);
    expect(names).toContain("Feni XI");
    expect(names.filter(Boolean)).toHaveLength(4);
  });

  it("lets the admin reschedule a fixture (date, time and venue)", async () => {
    const id = await createGroupTournament();
    const { bracket: rounds } = await bracket(id);
    const match = rounds.GROUP_STAGE[0];

    const kickOff = new Date("2026-09-25T13:45:00.000Z");
    const res = await request(app)
      .patch(`/api/tournaments/${id}/matches/${match._id}`)
      .send({ matchDate: kickOff.toISOString(), venue: "Basurhat Turf" });
    expect(res.status).toBe(200);

    // Re-read from the database, not from the response.
    const updated = await bracket(id);
    const saved = updated.bracket.GROUP_STAGE.find((m) => m._id === match._id);
    expect(new Date(saved.matchDate).toISOString()).toBe(kickOff.toISOString());
    expect(saved.venue).toBe("Basurhat Turf");

    // Rescheduling must not disturb the rest of the fixture list.
    const untouched = updated.bracket.GROUP_STAGE.find((m) => m._id !== match._id);
    expect(new Date(untouched.matchDate).toISOString()).not.toBe(kickOff.toISOString());
  });

  it("advances a knockout winner into the next round and crowns a champion", async () => {
    const id = await createGroupTournament();
    const initial = await bracket(id);

    const groupA = initial.bracket.GROUP_STAGE.find((m) => m.group === "A");
    const groupB = initial.bracket.GROUP_STAGE.find((m) => m.group === "B");
    await recordResult(id, groupA._id, 2, 0);
    let tournament = await recordResult(id, groupB._id, 3, 1);

    const semis = tournament.matches.filter((m) => m.round === "SEMI_FINAL");
    // Semi 1: home wins 4-1. Semi 2: away wins 0-2. Read the winners off the
    // fixtures (the snapshot above still carries null scores).
    const semiWinners = [semis[0].homeTeam.toString(), semis[1].awayTeam.toString()];
    tournament = await recordResult(id, semis[0]._id, 4, 1);
    tournament = await recordResult(id, semis[1]._id, 0, 2);

    const final = tournament.matches.find((m) => m.round === "FINAL");

    // Both semi winners reached the final, one in each slot.
    expect(final.homeTeam.toString()).toBe(semiWinners[0]);
    expect(final.awayTeam.toString()).toBe(semiWinners[1]);

    const decided = await recordResult(id, final._id, 2, 1);
    expect(decided.status).toBe("COMPLETED");
    expect(decided.champion).toBeTruthy();
    expect(decided.champion.toString()).toBe(final.homeTeam.toString());
  });
});
