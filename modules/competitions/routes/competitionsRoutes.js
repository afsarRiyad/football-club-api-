const express = require("express");
const router = express.Router();
const competitionsController = require("../controller/competitionsController");
const tournamentController = require("../../tournaments/controller/tournamentController");
const { protect } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");
const validate = require("../../../middleware/validate");
const {
  createCompetitionSchema,
  updateCompetitionSchema,
  addTeamSchema,
} = require("../validation/competitionsValidation");

// Public routes
router.get("/", competitionsController.getAllCompetitions);
router.get("/:id", competitionsController.getCompetition);

// Protected routes
router.use(protect);

router.post(
  "/",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(createCompetitionSchema),
  competitionsController.createCompetition
);

router.patch(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(updateCompetitionSchema),
  competitionsController.updateCompetition
);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  competitionsController.deleteCompetition
);

router.post(
  "/:id/teams",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(addTeamSchema),
  competitionsController.addTeamToCompetition
);

router.delete(
  "/:id/teams/:teamId",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  competitionsController.removeTeamFromCompetition
);

// ─── Tournament operations (admin UI calls these on /competitions) ───
router.get(
  "/:id/bracket",
  tournamentController.getBracket
);

router.post(
  "/:id/generate-bracket",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  tournamentController.generateBracket
);

router.post(
  "/:id/matches/:matchId/result",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "SCORER"),
  tournamentController.recordMatchResult
);

router.patch(
  "/:id/matches/:matchId",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER"),
  tournamentController.updateTournamentMatch
);

module.exports = router;
