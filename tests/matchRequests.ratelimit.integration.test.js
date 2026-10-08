/**
 * Integration test: the public "Request a Match" form is rate limited.
 *
 * It is an unauthenticated write that lands in the admin's inbox, so a single
 * IP gets a human-sized quota (20/hour) instead of an open firehose. The limit
 * lives in its own file because the limiter is a process-wide singleton and
 * Jest gives each test file a fresh module registry.
 *
 * Goes through the real router (`matchRequestRoutes.js`), so this also fails if
 * `matchRequestLimiter` is ever dropped from the POST route.
 */
const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Club = require("../modules/club/model/Club");
const MatchRequest = require("../modules/matchRequests/model/MatchRequest");
const matchRequestRoutes = require("../modules/matchRequests/routes/matchRequestRoutes");
const errorHandler = require("../middleware/errorHandler");

jest.setTimeout(120000);

describe("Match request rate limiting (integration)", () => {
  let mongo;
  let app;
  let club;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
    await mongoose.connect(mongo.getUri());

    app = express();
    app.use(express.json());
    app.use("/api/match-requests", matchRequestRoutes);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  beforeEach(async () => {
    await MatchRequest.deleteMany({});
    club = await Club.create({ name: "Nayadiganta Sporting Club" });
  });

  const payload = (i) => ({
    club: String(club._id),
    requesterName: `Requester ${i}`,
    requesterEmail: `team${i}@example.com`,
    teamName: `Team ${i}`,
  });

  it("accepts the first submissions and refuses the burst after that", async () => {
    const statuses = [];
    for (let i = 0; i < 21; i += 1) {
      const res = await request(app).post("/api/match-requests").send(payload(i));
      statuses.push(res.status);
      if (res.status === 429) {
        expect(res.body.message).toMatch(/too many match requests/i);
      }
    }

    // The quota is 20/hour: the first 20 land, the 21st is refused.
    expect(statuses.slice(0, 20).every((s) => s === 201)).toBe(true);
    expect(statuses[20]).toBe(429);
    expect(await MatchRequest.countDocuments({})).toBe(20);

    // …and the quota stays spent: nothing further is stored.
    const after = await request(app).post("/api/match-requests").send(payload(99));
    expect(after.status).toBe(429);
    expect(await MatchRequest.countDocuments({})).toBe(20);
  });
});
