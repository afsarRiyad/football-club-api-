const express = require("express");
const router = express.Router();
const tournamentController = require("../controller/tournamentController");
const { protect } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");
const validate = require("../../../middleware/validate");
const {
  createTournamentSchema,
  updateTournamentSchema,
  recordResultSchema,
} = require("../validation/tournamentValidation");

// Public routes
router.get("/", tournamentController.getAllTournaments);
router.get("/:id", tournamentController.getTournament);
router.get("/:id/bracket", tournamentController.getBracket);

// Protected routes
router.use(protect);

router.post(
  "/",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(createTournamentSchema),
  tournamentController.createTournament
);

router.patch(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(updateTournamentSchema),
  tournamentController.updateTournament
);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  tournamentController.deleteTournament
);

// Bracket operations
router.post(
  "/:id/generate-bracket",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  tournamentController.generateBracket
);

router.post(
  "/:id/teams",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  tournamentController.addTeam
);

router.delete(
  "/:id/teams/:teamId",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  tournamentController.removeTeam
);

router.post(
  "/:id/matches/:matchId/result",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "SCORER"),
  validate(recordResultSchema),
  tournamentController.recordMatchResult
);

module.exports = router;
