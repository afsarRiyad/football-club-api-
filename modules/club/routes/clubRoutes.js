const express = require("express");
const router = express.Router();
const clubController = require("../controller/clubController");
const { protect } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");
const validate = require("../../../middleware/validate");
const {
  createClubSchema,
  updateClubSchema,
  clubIdParam,
} = require("../validation/clubValidation");

// Public routes
router.get("/", clubController.getAllClubs);
router.get("/:id", clubController.getClub);

// Protected routes
router.use(protect);

router.post(
  "/",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(createClubSchema),
  clubController.createClub
);

router.patch(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(updateClubSchema),
  clubController.updateClub
);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  clubController.deleteClub
);

module.exports = router;
