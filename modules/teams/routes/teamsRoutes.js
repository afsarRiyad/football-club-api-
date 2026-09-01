const express = require("express");
const router = express.Router();
const teamsController = require("../controller/teamsController");
const { protect } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");
const validate = require("../../../middleware/validate");
const {
  createTeamSchema,
  updateTeamSchema,
  addPlayerSchema,
} = require("../validation/teamsValidation");

// Public routes
router.get("/", teamsController.getAllTeams);
router.get("/:id", teamsController.getTeam);

// Protected routes
router.use(protect);

router.post(
  "/",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(createTeamSchema),
  teamsController.createTeam
);

router.patch(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER"),
  validate(updateTeamSchema),
  teamsController.updateTeam
);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  teamsController.deleteTeam
);

// Squad management
router.post(
  "/:id/players",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER"),
  validate(addPlayerSchema),
  teamsController.addPlayerToTeam
);

router.delete(
  "/:id/players/:playerId",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER"),
  teamsController.removePlayerFromTeam
);

module.exports = router;
