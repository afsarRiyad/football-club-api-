const request = require("supertest");
const createTestApp = require("./mocks/app");

describe("Auth Endpoints", () => {
  let app;
  
  beforeAll(() => {
    app = createTestApp();
  });
  
  const testUser = {
    name: "Test User",
    email: `test${Date.now()}@example.com`,
    password: "password123",
  };

  describe("POST /api/auth/register", () => {
    it("should register a new user", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send(testUser);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.data.user.name).toBe(testUser.name);
      expect(res.body.data.user.email).toBe(testUser.email);
      expect(res.body.data.user.password).toBeUndefined(); // Password should not be returned
    }, 10000);

    it("should not register with duplicate email", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send(testUser);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    }, 10000);

    it("should not register without required fields", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "Test" });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    }, 10000);
  });
});
