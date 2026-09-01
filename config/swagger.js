const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "FClub Backend API",
      version: "1.0.0",
      description:
        "Football Club Management Platform — Backend API with 15 modules, real-time match updates, and file uploads.",
      contact: {
        name: "FClub API Support",
        url: "https://github.com/afsarRiyad/football-club-api-",
      },
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "jwt",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            role: {
              type: "string",
              enum: ["SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH", "SCORER", "PLAYER", "MEMBER"],
            },
            photo: { type: "string" },
            isActive: { type: "boolean" },
          },
        },
        Club: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string" },
            slug: { type: "string" },
            founded: { type: "number" },
            logo: { type: "string" },
            stadium: {
              type: "object",
              properties: {
                name: { type: "string" },
                capacity: { type: "number" },
              },
            },
          },
        },
        Player: {
          type: "object",
          properties: {
            _id: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            number: { type: "number" },
            position: { type: "string", enum: ["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"] },
            club: { type: "string" },
            status: { type: "string" },
          },
        },
        Match: {
          type: "object",
          properties: {
            _id: { type: "string" },
            homeTeam: { type: "string" },
            awayTeam: { type: "string" },
            matchDate: { type: "string", format: "date-time" },
            status: { type: "string", enum: ["SCHEDULED", "LIVE", "HT", "FT", "POSTPONED", "CANCELLED"] },
            score: {
              type: "object",
              properties: { home: { type: "number" }, away: { type: "number" } },
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
          },
        },
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { type: "object" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  },
  apis: ["./modules/*/routes/*.js"], // Path to route files with JSDoc comments
};

const swaggerSpec = swaggerJsdoc(options);

/**
 * Setup Swagger UI on the Express app.
 * @param {import("express").Express} app
 */
const setupSwagger = (app) => {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "FClub API Documentation",
    })
  );

  // Serve raw JSON spec
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  console.log("📚 Swagger docs available at /api-docs");
};

module.exports = { setupSwagger, swaggerSpec };
