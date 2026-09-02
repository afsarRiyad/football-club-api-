const express = require("express");
const router = express.Router();
const matchesController = require("../controller/matchesController");
const { protect } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");
const validate = require("../../../middleware/validate");
const {
  createMatchSchema,
  updateMatchSchema,
  addEventSchema,
} = require("../validation/matchesValidation");

// Public routes
router.get("/", matchesController.getAllMatches);
router.get("/:id", matchesController.getMatch);

// Protected routes
router.use(protect);

router.post(
  "/",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER"),
  validate(createMatchSchema),
  matchesController.createMatch
);

router.patch(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "SCORER"),
  // Temporarily disable validation for updates to allow partial updates
  // validate(updateMatchSchema),
  matchesController.updateMatch
);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  matchesController.deleteMatch
);

// Match events
router.post(
  "/:id/events",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "SCORER"),
  validate(addEventSchema),
  matchesController.addMatchEvent
);

router.delete(
  "/:id/events/:eventIndex",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "SCORER"),
  matchesController.removeMatchEvent
);

module.exports = router;
