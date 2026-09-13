/**
 * Unit test: on-demand revalidation ping.
 *
 * The middleware is the API's half of the "admin save shows up immediately"
 * story. Its whole contract is that it is SAFE: a write must never fail, block
 * or even care about whether the ping succeeded, and with no configuration it
 * must do nothing at all. These tests pin that down, because the failure mode
 * (a write that 500s because the public site is asleep) would be far worse than
 * the 60s cache it is optimising away.
 *
 *   node tests/revalidate.site.test.js
 *   (also picked up by `npm test` via the standard tests glob)
 */

const http = require("http");
const request = require("supertest");
const express = require("express");

const revalidateSite = require("../middleware/revalidateSite");

const SITE = "https://www.nayadiganta.club";
const SECRET = "shared-test-secret";
const DEBOUNCE_MS = 10;

/** A minimal app with the middleware mounted exactly as app.js mounts it. */
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api", revalidateSite);
  app.use("/api/auth", express.Router().post("/login", (req, res) => res.json({ ok: true })));
  app.post("/api/news", (req, res) => res.status(201).json({ ok: true }));
  app.patch("/api/matches/:id/live", (req, res) => res.json({ ok: true }));
  app.post("/api/matches", (req, res) => res.status(422).json({ ok: false }));
  app.get("/api/news", (req, res) => res.json({ ok: true }));
  app.get("/api/health", (req, res) => res.json({ ok: true }));
  return app;
};

/** Let the debounce timer fire and the async ping settle. */
const settle = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));

const setEnabled = () => {
  process.env.PUBLIC_SITE_URL = SITE;
  process.env.REVALIDATE_SECRET = SECRET;
  process.env.REVALIDATE_DEBOUNCE_MS = String(DEBOUNCE_MS);
};

const setDisabled = () => {
  delete process.env.PUBLIC_SITE_URL;
  delete process.env.REVALIDATE_SECRET;
  delete process.env.REVALIDATE_DEBOUNCE_MS;
};

describe("on-demand revalidation", () => {
  let app;
  let fetchMock;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    revalidateSite.__reset();
    // Keep the original in case another test file relies on it.
    global.__realFetch = global.__realFetch || global.fetch;
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;
  });

  afterAll(() => {
    global.fetch = global.__realFetch;
    setDisabled();
  });

  it("stays completely off when PUBLIC_SITE_URL / REVALIDATE_SECRET are unset", async () => {
    setDisabled();

    const res = await request(app).post("/api/news").send({ title: "x" });
    await settle();

    expect(res.status).toBe(201);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not require BOTH values — one alone is still off", async () => {
    setDisabled();
    process.env.PUBLIC_SITE_URL = SITE;

    await request(app).post("/api/news").send({ title: "x" });
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pings the site after a successful write, with the shared secret", async () => {
    setEnabled();

    const res = await request(app).post("/api/news").send({ title: "Goalkeeper Farewell" });
    await settle();

    expect(res.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${SITE}/api/revalidate`);
    expect(options.method).toBe("POST");
    expect(options.headers["x-revalidate-secret"]).toBe(SECRET);
    expect(JSON.parse(options.body).reason).toBe("POST /api/news");
  });

  it("normalises a trailing slash and a comma-separated site list", async () => {
    setEnabled();
    process.env.PUBLIC_SITE_URL = " http://localhost:3000/,https://www.nayadiganta.club ";

    await request(app).post("/api/news").send({ title: "x" });
    await settle();

    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:3000/api/revalidate");
  });

  it("ignores reads", async () => {
    setEnabled();

    await request(app).get("/api/news");
    await request(app).get("/api/health");
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores failed writes", async () => {
    setEnabled();

    const res = await request(app).post("/api/matches").send({});
    await settle();

    expect(res.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores auth routes", async () => {
    setEnabled();

    await request(app).post("/api/auth/login").send({ email: "a@b.c" });
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("coalesces a burst of writes (a live match) into one ping", async () => {
    setEnabled();
    /* A wider window than the other cases: 12 real HTTP requests over supertest
       are not dispatched in one tick, and the point of this test is that they
       collapse into a single ping, not exactly when the timer fires. */
    process.env.REVALIDATE_DEBOUNCE_MS = "250";

    await Promise.all(
      Array.from({ length: 12 }, () => request(app).patch("/api/matches/abc/live").send({}))
    );
    await settle(400);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never fails the write when the site is unreachable", async () => {
    setEnabled();
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const res = await request(app).post("/api/news").send({ title: "x" });
    await settle();

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });

  it("never fails the write when the site rejects the secret (401)", async () => {
    setEnabled();
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    const res = await request(app).post("/api/news").send({ title: "x" });
    await settle();

    expect(res.status).toBe(201);
  });

  it("honours REVALIDATE_DEBOUNCE_MS=0 without turning into a ping storm", async () => {
    setEnabled();
    process.env.REVALIDATE_DEBOUNCE_MS = "0";

    await Promise.all([
      request(app).post("/api/news").send({ title: "a" }),
      request(app).post("/api/news").send({ title: "b" }),
    ]);
    await settle();

    /* With no debounce, whether two responses land in the same tick is up to
       the event loop, so the guarantee is bounded and one-directional: at
       least one ping fires and no write can cause more than one. */
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("pings again for a write that arrives while a ping is in flight", async () => {
    setEnabled();

    // Hold the first ping open so the second write lands mid-flight.
    let release;
    fetchMock.mockImplementationOnce(
      () => new Promise((resolve) => { release = () => resolve({ ok: true, status: 200 }); })
    );

    await request(app).post("/api/news").send({ title: "first" });
    await settle(); // first ping is now in flight

    await request(app).post("/api/news").send({ title: "second" });
    release();
    await settle(120);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /*
   * The wire format itself, with the real `fetch` and a real socket. Every other
   * case here stubs fetch, so without this one a renamed header or a wrong path
   * would pass the suite and silently do nothing in production — the exact
   * failure mode this feature cannot afford.
   */
  it("sends a request the site's /api/revalidate route accepts (real fetch, real socket)", async () => {
    const received = [];
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        received.push({ method: req.method, url: req.url, secret: req.headers["x-revalidate-secret"], body });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ revalidated: true }));
      });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

    try {
      setEnabled();
      process.env.PUBLIC_SITE_URL = `http://127.0.0.1:${server.address().port}`;
      process.env.REVALIDATE_DEBOUNCE_MS = "0";
      global.fetch = global.__realFetch; // this case exercises the real client

      await request(app).post("/api/news").send({ title: "wire" });
      for (let i = 0; i < 50 && received.length === 0; i += 1) await settle(20);

      expect(received).toHaveLength(1);
      expect(received[0].method).toBe("POST");
      expect(received[0].url).toBe("/api/revalidate");
      expect(received[0].secret).toBe(SECRET);
      expect(JSON.parse(received[0].body)).toEqual({ reason: "POST /api/news" });
    } finally {
      global.fetch = fetchMock;
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
