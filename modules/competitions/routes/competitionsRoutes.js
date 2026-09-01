const express = require("express");
const router = express.Router();
const competitionsController = require("../controller/competitionsController");
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

module.exports = router;
