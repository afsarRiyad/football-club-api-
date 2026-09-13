/**
 * Integration test: the news hero slot ("Featured").
 *
 * The editor picks which story gets the big card on the news page and the
 * homepage instead of the newest one always winning. Two properties matter:
 *
 *  1. Only ONE article is featured at a time — otherwise both pages would pick
 *     arbitrarily between several flagged stories.
 *  2. The hero is always a PUBLISHED article. Featuring a draft must not leak it
 *     onto the site, because the public list is filtered to isPublished:true.
 *
 * Real in-memory MongoDB, real model and controllers (auth is not under test, so
 * the routes are mounted directly — same approach as the statistics test).
 */
const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Club = require("../modules/club/model/Club");
const News = require("../modules/news/model/News");
/* getAllNews populates these; the models have to be registered even though this
   test never writes to them. */
/* getAllNews populates these; the models have to be registered even though this
   test never writes to them. (`author` is a User ref, and tests/setup.js mocks
   that module out entirely, so register a stub with the populated fields.) */
if (!mongoose.models.User) {
  mongoose.model("User", new mongoose.Schema({ name: String, photo: String }));
}
require("../modules/players/model/Player");
require("../modules/competitions/model/Competition");
const newsController = require("../modules/news/controller/newsController");
const errorHandler = require("../middleware/errorHandler");

jest.setTimeout(120000);

describe("News hero slot (integration)", () => {
  let mongo;
  let app;
  let club;
  let authorId;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
    await mongoose.connect(mongo.getUri());

    app = express();
    app.use(express.json());
    app.get("/api/news", newsController.getAllNews);
    app.patch("/api/news/:id/feature", newsController.featureNews);
    app.patch("/api/news/:id/unfeature", newsController.unfeatureNews);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all([News.deleteMany({}), Club.deleteMany({})]);
    club = await Club.create({ name: "Nayadiganta Sporting Club" });
    authorId = new mongoose.Types.ObjectId();
  });

  const makeArticle = (title, extra = {}) =>
    News.create({
      club: club._id,
      author: authorId,
      title,
      content: "x",
      isPublished: true,
      ...extra,
    });

  const heroFromApi = async () => {
    const res = await request(app).get("/api/news").query({ isFeatured: "true", limit: 1 });
    return { status: res.status, article: res.body.data?.[0] ?? null, total: res.body.total };
  };

  it("features the chosen article and returns it as the hero", async () => {
    const old = await makeArticle("Older report");
    await makeArticle("Newest report");

    const res = await request(app).patch(`/api/news/${old._id}/feature`);
    expect(res.status).toBe(200);
    expect(res.body.data.article.isFeatured).toBe(true);

    const hero = await heroFromApi();
    expect(hero.article.title).toBe("Older report");
  });

  it("only ever has one featured article", async () => {
    const first = await makeArticle("First");
    const second = await makeArticle("Second");

    await request(app).patch(`/api/news/${first._id}/feature`);
    await request(app).patch(`/api/news/${second._id}/feature`);

    expect(await News.countDocuments({ isFeatured: true })).toBe(1);
    const hero = await heroFromApi();
    expect(hero.article.title).toBe("Second");
    expect((await News.findById(first._id)).isFeatured).toBe(false);
  });

  it("clears the hero on unfeature", async () => {
    const article = await makeArticle("Solo");
    await request(app).patch(`/api/news/${article._id}/feature`);
    await request(app).patch(`/api/news/${article._id}/unfeature`);

    expect(await News.countDocuments({ isFeatured: true })).toBe(0);
    expect((await heroFromApi()).total).toBe(0);
  });

  it("never puts a featured draft on the site", async () => {
    await makeArticle("Published story");
    const draft = await makeArticle("Unfinished story", { isPublished: false });

    await request(app).patch(`/api/news/${draft._id}/feature`);

    /* The flag is stored, but the public query still requires isPublished. */
    expect((await News.findById(draft._id)).isFeatured).toBe(true);
    const hero = await heroFromApi();
    expect(hero.total).toBe(0);
    expect(hero.article).toBeNull();
  });
});
