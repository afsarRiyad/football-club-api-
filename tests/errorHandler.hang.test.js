/**
 * Regression test for middleware/errorHandler.js
 *
 * Reproduces the production bug: with NODE_ENV unset (Render runs
 * `node server.js` with no NODE_ENV), the OLD handler matched neither
 * the "development" nor the "production" branch and never sent a
 * response — every 401 / validation / failed-login request hung until
 * the client timed out. That is exactly the "admin formation spins for
 * minutes, then data eventually shows" symptom.
 *
 * Run: node tests/errorHandler.hang.test.js
 * (also picked up by `npm test` via testMatch **//tests//*.test.js)
 */

process.env.NODE_ENV = ""; // Simulate Render: NODE_ENV is NOT set

const request = require("supertest");
const express = require("express");

describe("errorHandler responds even when NODE_ENV is unset", () => {
  const OLD_ENV = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = OLD_ENV;
  });

  function buildApp() {
    // Fresh require so the module picks up the current NODE_ENV
    jest.resetModules();
    process.env.NODE_ENV = "";
    const errorHandler = require("../middleware/errorHandler");
    const AppError = require("../utils/AppError");

    const app = express();
    app.use(express.json());

    // Route that mimics auth middleware: 401 via AppError (previously hung)
    app.get("/test/401", (req, res, next) => {
      next(new AppError("You are not logged in.", 401));
    });

    // Route that mimics failed login: generic Error, non-operational, 500
    app.post("/test/500", (req, res, next) => {
      next(new Error("boom"));
    });

    app.use(errorHandler);
    return app;
  }

  test("401 AppError returns JSON immediately (no hang)", async () => {
    const res = await request(buildApp()).get("/test/401");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("You are not logged in.");
  });

  test("unexpected 500 error returns JSON immediately (no hang)", async () => {
    const res = await request(buildApp()).post("/test/500").send({});
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  test("CastError is mapped to a 400 response", async () => {
    jest.resetModules();
    const errorHandler = require("../middleware/errorHandler");
    const app = express();
    app.get("/test/cast", (req, res, next) => {
      const err = new Error("cast");
      err.name = "CastError";
      err.path = "_id";
      err.value = "not-an-id";
      next(err);
    });
    app.use(errorHandler);

    const res = await request(app).get("/test/cast");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
