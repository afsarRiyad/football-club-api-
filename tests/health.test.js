const request = require("supertest");
const createTestApp = require("./mocks/app");

describe("Health Check", () => {
  let app;
  
  beforeAll(() => {
    app = createTestApp();
  });
  
  it("GET /api/health should return 200", async () => {
    const res = await request(app).get("/api/health");

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("FClub");
    expect(res.body.timestamp).toBeDefined();
  });

  it("GET /api/nonexistent should return 404", async () => {
    const res = await request(app).get("/api/nonexistent");

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
