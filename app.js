const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");

const errorHandler = require("./middleware/errorHandler");
const ensureDB = require("./middleware/dbCheck");
// Rate limiting removed from global — only applied to auth routes
const { applySecurity } = require("./middleware/security");
const { auditMiddleware } = require("./middleware/auditLog");
const { setupSwagger } = require("./config/swagger");

// Route imports
const authRoutes = require("./modules/auth/routes/authRoutes");
const usersRoutes = require("./modules/users/routes/usersRoutes");
const clubRoutes = require("./modules/club/routes/clubRoutes");
const playersRoutes = require("./modules/players/routes/playersRoutes");
const teamsRoutes = require("./modules/teams/routes/teamsRoutes");
const matchesRoutes = require("./modules/matches/routes/matchesRoutes");
const competitionsRoutes = require("./modules/competitions/routes/competitionsRoutes");
const seasonsRoutes = require("./modules/seasons/routes/seasonsRoutes");
const newsRoutes = require("./modules/news/routes/newsRoutes");
const galleryRoutes = require("./modules/gallery/routes/galleryRoutes");
const academyRoutes = require("./modules/academy/routes/academyRoutes");
const trainingRoutes = require("./modules/training/routes/trainingRoutes");
const membersRoutes = require("./modules/members/routes/membersRoutes");
const statisticsRoutes = require("./modules/statistics/routes/statisticsRoutes");
const uploadRoutes = require("./modules/uploads/routes/uploadRoutes");
const tournamentRoutes = require("./modules/tournaments/routes/tournamentRoutes");
const matchFormationRoutes = require("./modules/matches/routes/matchFormationRoutes");
const matchRequestRoutes = require("./modules/matchRequests/routes/matchRequestRoutes");

const app = express();

// ─── Security Middleware ─────────────────────────────────────────────
applySecurity(app);

// ─── Global Middleware ───────────────────────────────────────────────
// CORS — support comma-separated list of origins
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000,http://localhost:3001")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Body parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// Development logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Rate limiting — only on auth routes (login, register, etc.)

// Audit logging middleware
app.use("/api", auditMiddleware);

// Swagger API documentation
setupSwagger(app);

// ─── Routes ──────────────────────────────────────────────────────────

// DB reconnect check — ensures MongoDB is alive on Render free tier cold starts
app.use("/api", ensureDB);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "FClub Backend is running 🏟️",
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/clubs", clubRoutes);
app.use("/api/players", playersRoutes);
app.use("/api/teams", teamsRoutes);
app.use("/api/matches", matchesRoutes);
app.use("/api/competitions", competitionsRoutes);
app.use("/api/seasons", seasonsRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/academy", academyRoutes);
app.use("/api/training", trainingRoutes);
app.use("/api/members", membersRoutes);
app.use("/api/statistics", statisticsRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/match-formations", matchFormationRoutes);
app.use("/api/match-requests", matchRequestRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────
app.all("*", (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// ─── Global Error Handler ────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
