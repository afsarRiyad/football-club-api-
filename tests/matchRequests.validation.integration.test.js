
const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Club = require("../modules/club/model/Club");
const MatchRequest = require("../modules/matchRequests/model/MatchRequest");
const matchRequestController = require("../modules/matchRequests/controller/matchRequestController");
const matchRequestRoutes = require("../modules/matchRequests/routes/matchRequestRoutes");
const validate = require("../middleware/validate");
const {
  createMatchRequestSchema,
  updateMatchRequestSchema,
  LIMITS,
} = require("../modules/matchRequests/validation/matchRequestValidation");
const errorHandler = require("../middleware/errorHandler");

jest.setTimeout(120000);

const VALID_EMAIL = "coach@dhakaxi.example";

describe("Match request validation (integration)", () => {
  let mongo;
  let app;
  let unguardedApp;
  /* The real router, middleware chain included — proves the validator is
     actually wired to the public route and not merely available. */
  let wiredApp;
  let club;

  const payload = (overrides = {}) => ({
    club: String(club._id),
    requesterName: "Rakib Hasan",
    requesterEmail: VALID_EMAIL,
    requesterPhone: "+880 1712-345678",
    teamName: "Dhaka XI",
    preferredVenue: "Kabirhat Stadium",
    message: "We would like a friendly 11v11.",
    ...overrides,
  });

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
    await mongoose.connect(mongo.getUri());

    // Mirrors the middleware order in `matchRequestRoutes.js`; the rate limiter
    // is left off here for the same reason it lives on the real route only once
    // per IP per hour — a suite this size would trip it. It has its own file.
    app = express();
    app.use(express.json());
    app.post(
      "/api/match-requests",
      validate(createMatchRequestSchema),
      matchRequestController.createMatchRequest
    );
    app.get("/api/match-requests", matchRequestController.getAllMatchRequests);
    app.patch(
      "/api/match-requests/:id",
      validate(updateMatchRequestSchema),
      matchRequestController.updateMatchRequest
    );
    app.use(errorHandler);

    wiredApp = express();
    wiredApp.use(express.json());
    wiredApp.use("/api/match-requests", matchRequestRoutes);
    wiredApp.use(errorHandler);

    // Control: the controller alone, with no validator in front of it.
    unguardedApp = express();
    unguardedApp.use(express.json());
    unguardedApp.post(
      "/api/match-requests",
      matchRequestController.createMatchRequest
    );
    unguardedApp.use(errorHandler);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all([MatchRequest.deleteMany({}), Club.deleteMany({})]);
    club = await Club.create({ name: "Nayadiganta Sporting Club" });
  });

  const countStored = () => MatchRequest.countDocuments({});

  /* ─────────────── the reported bug: links in identity fields ─────────────── */

  describe("links are refused in name, team and venue", () => {
    const linkyNames = [
      ["a plain URL", "http://evil.example/claim"],
      ["a www host", "www.evil.example"],
      ["a scheme-less host", "bit.ly/free-kit"],
      ["a protocol-relative URL", "//evil.example"],
      ["a shortened path", "evil.com/claim"],
      ["an email address", "contact@evil.example"],
      ["an html tag", "Rakib <script>alert(1)</script>"],
      ["a fullwidth URL (NFKC evasion)", "\uFF48\uFF54\uFF54\uFF50://evil.example"],
      ["a zero-width URL (invisible-char evasion)", "h\u200Bttp://evil.example"],
      ["a bidi-marked URL", "http:\u202E//evil.example"],
    ];

    it.each(linkyNames)("rejects %s in the name field", async (_label, name) => {
      const res = await request(app).post("/api/match-requests").send(payload({ requesterName: name }));

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/link|email|HTML/i);
      expect(await countStored()).toBe(0);
    });

    it("rejects the Facebook link that was found in teamName", async () => {
      const res = await request(app)
        .post("/api/match-requests")
        .send(payload({ teamName: "https://www.facebook.com/share/p/14xMDA7rJcm/" }));

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("must not contain a link or URL");
      expect(await countStored()).toBe(0);
    });

    it("rejects a link in the venue field", async () => {
      const res = await request(app)
        .post("/api/match-requests")
        .send(payload({ preferredVenue: "Ground https://maps.example/x" }));

      expect(res.status).toBe(400);
      expect(await countStored()).toBe(0);
    });

    it("rejects a name that is only a link, even when every other field is valid", async () => {
      const res = await request(app)
        .post("/api/match-requests")
        .send(payload({ requesterName: "https://t.me/freefollowers" }));

      expect(res.status).toBe(400);
      expect(await countStored()).toBe(0);
    });
  });

  /* ─────────────────────── legitimate submissions still pass ──────────────── */

  it("accepts a real request and stores sanitized values", async () => {
    const res = await request(app)
      .post("/api/match-requests")
      .send(
        payload({
          requesterName: "  Md. Ibrahim (U-19) \n ",
          requesterEmail: VALID_EMAIL.toUpperCase(),
          teamName: "আবাহনী ক্রিরা চক্র",
          preferredVenue: "Bhuiyarhat Chowrasta   Ground 2",
          preferredDate: "2026-11-20T00:00:00.000Z",
        })
      );

    expect(res.status).toBe(201);

    const stored = await MatchRequest.findById(res.body.data.request._id);
    expect(stored.requesterName).toBe("Md. Ibrahim (U-19)");
    expect(stored.requesterEmail).toBe(VALID_EMAIL);
    expect(stored.teamName).toBe("আবাহনী ক্রিরা চক্র");
    expect(stored.preferredVenue).toBe("Bhuiyarhat Chowrasta Ground 2");
    expect(stored.preferredDate.toISOString()).toBe("2026-11-20T00:00:00.000Z");
    expect(stored.status).toBe("PENDING");
    await expect(countStored()).resolves.toBe(1);
  });

  it("keeps a plain name with initials and an apostrophe", async () => {
    const res = await request(app)
      .post("/api/match-requests")
      .send(payload({ requesterName: "O'Brien M. A. Sayem" }));

    expect(res.status).toBe(201);
  });

  /* ─────────────────────────── length and shape limits ───────────────────── */

  it("refuses an over-long name instead of storing a wall of text", async () => {
    const res = await request(app)
      .post("/api/match-requests")
      .send(payload({ requesterName: "A".repeat(LIMITS.MAX_NAME + 1) }));

    expect(res.status).toBe(400);
    expect(res.body.message).toContain(`cannot exceed ${LIMITS.MAX_NAME}`);
    expect(await countStored()).toBe(0);
  });

  it("refuses a one-character name", async () => {
    const res = await request(app).post("/api/match-requests").send(payload({ requesterName: "x" }));
    expect(res.status).toBe(400);
  });

  it("refuses an invalid email and a missing name", async () => {
    const badEmail = await request(app).post("/api/match-requests").send(payload({ requesterEmail: "nope" }));
    expect(badEmail.status).toBe(400);

    const noName = await request(app).post("/api/match-requests").send(payload({ requesterName: "" }));
    expect(noName.status).toBe(400);

    expect(await countStored()).toBe(0);
  });

  it("refuses a non-object-id club and a non-date value", async () => {
    const badClub = await request(app).post("/api/match-requests").send(payload({ club: "not-an-id" }));
    expect(badClub.status).toBe(400);

    const badDate = await request(app)
      .post("/api/match-requests")
      .send(payload({ preferredDate: "not-a-date" }));
    expect(badDate.status).toBe(400);

    const sillyDate = await request(app)
      .post("/api/match-requests")
      .send(payload({ preferredDate: "2099-01-01T00:00:00.000Z" }));
    expect(sillyDate.status).toBe(400);

    expect(await countStored()).toBe(0);
  });

  it("refuses letters in the phone field but accepts normal formatting", async () => {
    const bad = await request(app).post("/api/match-requests").send(payload({ requesterPhone: "call me" }));
    expect(bad.status).toBe(400);

    const good = await request(app)
      .post("/api/match-requests")
      .send(payload({ requesterPhone: "01712-345678" }));
    expect(good.status).toBe(201);
  });

  /* ──────────────────── mass assignment / field smuggling ────────────────── */

  it("ignores smuggled status and adminNotes from a public caller", async () => {
    const res = await request(app)
      .post("/api/match-requests")
      .send(payload({ status: "APPROVED", adminNotes: "approved by me", _id: new mongoose.Types.ObjectId() }));

    expect(res.status).toBe(201);
    const stored = await MatchRequest.findById(res.body.data.request._id);
    expect(stored.status).toBe("PENDING");
    expect(stored.adminNotes).toBeUndefined();
  });

  /* ─────────────────────────── message field rules ───────────────────────── */

  it("allows a link in the message but refuses markup and over-long text", async () => {
    const withLink = await request(app)
      .post("/api/match-requests")
      .send(payload({ message: "Our squad page is https://dhakaxi.example/squad — 11v11 please." }));
    expect(withLink.status).toBe(201);

    const withMarkup = await request(app)
      .post("/api/match-requests")
      .send(payload({ message: "<img src=x onerror=alert(1)>" }));
    expect(withMarkup.status).toBe(400);

    const tooLong = await request(app)
      .post("/api/match-requests")
      .send(payload({ message: "z".repeat(LIMITS.MAX_MESSAGE + 1) }));
    expect(tooLong.status).toBe(400);
  });

  it("treats empty optional fields as absent", async () => {
    const res = await request(app)
      .post("/api/match-requests")
      .send(payload({ requesterPhone: "", preferredVenue: "", message: "", preferredDate: "" }));

    expect(res.status).toBe(201);
    const stored = await MatchRequest.findById(res.body.data.request._id);
    expect(stored.requesterPhone).toBeUndefined();
    expect(stored.preferredVenue).toBeUndefined();
    expect(stored.message).toBeUndefined();
    expect(stored.preferredDate).toBeUndefined();
  });

  /* ───────────────────────────── the model backstop ──────────────────────── */

  it("the schema itself refuses an over-long name, even without the route", async () => {
    await expect(
      MatchRequest.create({
        club: club._id,
        requesterName: "A".repeat(LIMITS.MAX_NAME + 1),
        requesterEmail: VALID_EMAIL,
        teamName: "Dhaka XI",
      })
    ).rejects.toThrow(new RegExp(`cannot exceed ${LIMITS.MAX_NAME}`));
  });

  /* ───────────────────── admin search: escaping and paging ───────────────── */

  describe("admin listing", () => {
    it("treats a search term containing regex metacharacters as literal text", async () => {
      await MatchRequest.create([
        { club: club._id, requesterName: "Tigers", requesterEmail: VALID_EMAIL, teamName: "Tigers FC" },
        { club: club._id, requesterName: "TigXrs", requesterEmail: VALID_EMAIL, teamName: "TigXrs FC" },
      ]);

      // Unescaped, "Tig.rs" is a pattern that matches both rows.
      const res = await request(app).get("/api/match-requests").query({ search: "Tig.rs" });
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);

      const literal = await request(app).get("/api/match-requests").query({ search: "Tigers" });
      expect(literal.body.total).toBe(1);
      expect(literal.body.data[0].requesterName).toBe("Tigers");
    });

    it("does not error on a hostile regex-shaped search", async () => {
      await MatchRequest.create({
        club: club._id,
        requesterName: "Rakib",
        requesterEmail: VALID_EMAIL,
        teamName: "Dhaka XI",
      });

      // A lookahead would make Mongo raise "Regular expression is invalid";
      // a nested quantifier would pin the CPU on a large collection.
      for (const search of ["(?=)", "(a+)+$", "[", "\\"]) {
        const res = await request(app).get("/api/match-requests").query({ search });
        expect([200]).toContain(res.status);
      }
    });

    it("clamps `limit` so the whole collection cannot be requested at once", async () => {
      const bulk = Array.from({ length: 150 }, (_, i) => ({
        club: club._id,
        requesterName: `Requester ${i}`,
        requesterEmail: VALID_EMAIL,
        teamName: `Team ${i}`,
      }));
      await MatchRequest.insertMany(bulk);

      const res = await request(app).get("/api/match-requests").query({ limit: 100000 });
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(100);
      expect(res.body.totalPages).toBe(2);
    });

    it("clamps a zero or negative page to the first page", async () => {
      await MatchRequest.create({
        club: club._id,
        requesterName: "Rakib",
        requesterEmail: VALID_EMAIL,
        teamName: "Dhaka XI",
      });

      const res = await request(app).get("/api/match-requests").query({ page: 0 });
      expect(res.status).toBe(200);
      expect(res.body.currentPage).toBe(1);
      expect(res.body.data.length).toBe(1);
    });
  });

  /* ─────────────────────── admin status update validation ────────────────── */

  it("refuses an unknown status from the admin route", async () => {
    const created = await MatchRequest.create({
      club: club._id,
      requesterName: "Rakib Hasan",
      requesterEmail: VALID_EMAIL,
      teamName: "Dhaka XI",
    });

    const bad = await request(app).patch(`/api/match-requests/${created._id}`).send({ status: "DELETED" });
    expect(bad.status).toBe(400);

    const good = await request(app)
      .patch(`/api/match-requests/${created._id}`)
      .send({ status: "APPROVED", adminNotes: "  booked the ground  " });
    expect(good.status).toBe(200);
    expect(good.body.data.request.status).toBe("APPROVED");
    expect(good.body.data.request.adminNotes).toBe("booked the ground");
  });

  /* ────────────── the real route: the validator is actually wired ─────────── */

  describe("the real route", () => {
    it("refuses a link in the name field", async () => {
      const res = await request(wiredApp)
        .post("/api/match-requests")
        .send(payload({ requesterName: "http://evil.example/claim" }));

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("must not contain a link or URL");
      expect(await countStored()).toBe(0);
    });

    it("still accepts a legitimate request", async () => {
      const res = await request(wiredApp).post("/api/match-requests").send(payload());
      expect(res.status).toBe(201);
    });
  });

  /* ────────────────── control: the validator is the mechanism ─────────────── */

  it("control — without the validator the same payload is accepted", async () => {
    const res = await request(unguardedApp)
      .post("/api/match-requests")
      .send(payload({ requesterName: "https://evil.example/claim" }));

    // This is exactly the pre-fix behaviour the route must never regress to.
    expect(res.status).toBe(201);
    expect(res.body.data.request.requesterName).toBe("https://evil.example/claim");
  });
});
