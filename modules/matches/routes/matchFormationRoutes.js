const express = require("express");
const router = express.Router();
const matchFormationController = require("../controller/matchFormationController");
const { protect } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");

// Public routes — allow frontend to fetch formations (read-only)
router.get("/", matchFormationController.getAllMatchFormations);
router.get("/match/:matchId", matchFormationController.getMatchFormations);
router.get(
  "/match/:matchId/team/:teamId",
  matchFormationController.getMatchFormation
);

// Protected routes
router.use(protect);

router.post(
  "/",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH"),
  matchFormationController.upsertMatchFormation
);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER"),
  matchFormationController.deleteMatchFormation
);

module.exports = router;
