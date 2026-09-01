const express = require("express");
const router = express.Router();
const statisticsController = require("../controller/statisticsController");
const { protect } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");
const validate = require("../../../middleware/validate");
const {
  createStatisticSchema,
  updateStatisticSchema,
} = require("../validation/statisticsValidation");

// Public analytics routes
router.get("/top-scorers", statisticsController.getTopScorers);
router.get("/standings", statisticsController.getTeamStandings);

// Protected routes
router.use(protect);

router.get(
  "/",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH"),
  statisticsController.getAllStatistics
);

router.get(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH"),
  statisticsController.getStatistic
);

router.post(
  "/",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH"),
  validate(createStatisticSchema),
  statisticsController.createStatistic
);

router.patch(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH"),
  validate(updateStatisticSchema),
  statisticsController.updateStatistic
);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  statisticsController.deleteStatistic
);

module.exports = router;
