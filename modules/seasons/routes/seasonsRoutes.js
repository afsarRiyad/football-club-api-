const express = require("express");
const router = express.Router();
const seasonsController = require("../controller/seasonsController");
const { protect } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");
const validate = require("../../../middleware/validate");
const {
  createSeasonSchema,
  updateSeasonSchema,
} = require("../validation/seasonsValidation");

// Public routes
router.get("/", seasonsController.getAllSeasons);
router.get("/:id", seasonsController.getSeason);

// Protected routes
router.use(protect);

router.post(
  "/",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(createSeasonSchema),
  seasonsController.createSeason
);

router.patch(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(updateSeasonSchema),
  seasonsController.updateSeason
);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  seasonsController.deleteSeason
);

module.exports = router;
