/**
 * Integration test: who can see a draft article.
 *
 * Regression test for a real bug: `GET /news` is mounted BEFORE `router.use(protect)`,
 * so `req.user` was always undefined on that route. The `isAdmin` branch in
 * getAllNews could therefore never run, and drafts were filtered out for
 * everyone — including the admin that had just written them. Creating an
 * article (which defaults to isPublished:false) made it disappear from the admin
 * list as well as the site, so the save looked like it had failed.
 *
 *   node tests/news.drafts.integration.test.js
 *   (also picked up by `npm test` via the standard tests glob)
 */
/* tests/setup.js replaces the whole auth middleware with just `protect`.
   This test is about the REAL `optionalAuth`, so keep the actual module and
   only neutralise `protect` (the protected routes on the same router would
   otherwise 401 and are not under test). */
jest.mock("../middleware/auth", () => {
  const actual = jest.requireActual("../middleware/auth");
  return { ...actual, protect: (req, res, next) => next() };
});

const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Club = require("../modules/club/model/Club");
const News = require("../modules/news/model/News");
const newsRoutes = require("../modules/news/routes/newsRoutes");
const errorHandler = require("../middleware/errorHandler");

/* getAllNews populates `author`, but tests/setup.js replaces the User module with
   a mock, so no "User" model is registered. Register a stub so the populate has
   something to resolve — req.user itself comes from the mock. */
if (!mongoose.models.User) {
  mongoose.model("User", new mongoose.Schema({ name: String, photo: String }));
}

jest.setTimeout(120000);

describe("News drafts visibility (integration)", () => {
  let mongo;
  let app;
  let club;
  let authorId;
  let adminToken;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
    await mongoose.connect(mongo.getUri());

    app = express();
    app.use(express.json());
    app.use("/api/news", newsRoutes);
    app.use(errorHandler);

    /* optionalAuth looks the token's user up through the mocked User model. */
    global.mockUsers.set("admin-test-1", {
      _id: "admin-test-1",
      name: "Test Admin",
      role: "SUPER_ADMIN",
      isActive: true,
    });
    adminToken = jwt.sign({ id: "admin-test-1" }, process.env.JWT_SECRET);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all([News.deleteMany({}), Club.deleteMany({})]);

    club = await Club.create({ name: "Nayadiganta Sporting Club" });
    authorId = new mongoose.Types.ObjectId();

    await News.create([
      { club: club._id, author: authorId, title: "Old win", content: "x", isPublished: true },
      { club: club._id, author: authorId, title: "Goalkeeper Farewell", content: "x", isPublished: true },
      { club: club._id, author: authorId, title: "sadfs", content: "x", isPublished: false },
    ]);
  });

  const list = (token, query = {}) => {
    const req = request(app).get("/api/news");
    if (token) req.set("Authorization", `Bearer ${token}`);
    return req.query(query);
  };

  it("hides drafts from an anonymous visitor", async () => {
    const res = await list(null);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.every((a) => a.isPublished === true)).toBe(true);
  });

  it("shows drafts to the admin that owns them", async () => {
    const res = await list(adminToken);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.data.map((a) => a.title)).toContain("sadfs");
  });

  it("can filter to drafts only when authenticated", async () => {
    const res = await list(adminToken, { isPublished: "false" });

    expect(res.body.total).toBe(1);
    expect(res.body.data[0].title).toBe("sadfs");
  });

  it("treats a bad token as anonymous instead of rejecting the public read", async () => {
    const res = await list("not-a-real-token");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });
});
