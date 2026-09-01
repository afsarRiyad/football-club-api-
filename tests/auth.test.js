const request = require("supertest");
const app = require("../app");

describe("Auth Endpoints", () => {
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
      expect(res.body.token).toBeDefined();
      expect(res.body.data.user.name).toBe(testUser.name);
      expect(res.body.data.user.email).toBe(testUser.email);
      expect(res.body.data.user.password).toBeUndefined(); // Password should not be returned
    });

    it("should not register with duplicate email", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send(testUser);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should not register without required fields", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ name: "Test" });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login with valid credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testUser.email, password: testUser.password });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
    });

    it("should not login with wrong password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testUser.email, password: "wrongpassword" });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should not login without email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ password: "password123" });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/auth/me", () => {
    let token;

    beforeAll(async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testUser.email, password: testUser.password });
      token = res.body.token;
    });

    it("should get current user profile", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testUser.email);
    });

    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
