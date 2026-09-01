const express = require("express");
const router = express.Router();
const academyController = require("../controller/academyController");
const { protect } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");
const validate = require("../../../middleware/validate");
const {
  createAcademySchema,
  updateAcademySchema,
  addPlayerSchema,
} = require("../validation/academyValidation");

// Public routes
router.get("/", academyController.getAllAcademies);
router.get("/:id", academyController.getAcademy);

// Protected routes
router.use(protect);

router.post(
  "/",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(createAcademySchema),
  academyController.createAcademy
);

router.patch(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(updateAcademySchema),
  academyController.updateAcademy
);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  academyController.deleteAcademy
);

router.post(
  "/:id/players",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "COACH"),
  validate(addPlayerSchema),
  academyController.addPlayerToAcademy
);

router.delete(
  "/:id/players/:playerId",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "COACH"),
  academyController.removePlayerFromAcademy
);

module.exports = router;
