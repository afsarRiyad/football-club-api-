const express = require("express");
const router = express.Router();
const trainingController = require("../controller/trainingController");
const { protect } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");
const validate = require("../../../middleware/validate");
const {
  createTrainingSchema,
  updateTrainingSchema,
  attendanceSchema,
} = require("../validation/trainingValidation");

// Public routes
router.get("/", trainingController.getAllTrainings);
router.get("/:id", trainingController.getTraining);

// Protected routes
router.use(protect);

router.post(
  "/",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH"),
  validate(createTrainingSchema),
  trainingController.createTraining
);

router.patch(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH"),
  validate(updateTrainingSchema),
  trainingController.updateTraining
);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER"),
  trainingController.deleteTraining
);

router.post(
  "/:id/attendance",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH"),
  validate(attendanceSchema),
  trainingController.markAttendance
);

module.exports = router;
