const express = require("express");
const router = express.Router();
const matchRequestController = require("../controller/matchRequestController");
const { protect } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");

// Public route — allow external teams to submit match requests
router.post("/", matchRequestController.createMatchRequest);

// Protected routes — admin operations
router.use(protect);

router.get(
  "/",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  matchRequestController.getAllMatchRequests
);

router.get(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  matchRequestController.getMatchRequest
);

router.patch(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  matchRequestController.updateMatchRequest
);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  matchRequestController.deleteMatchRequest
);

module.exports = router;
