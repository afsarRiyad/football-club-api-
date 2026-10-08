const express = require("express");
const router = express.Router();
const matchRequestController = require("../controller/matchRequestController");
const { protect } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");
const validate = require("../../../middleware/validate");
const { matchRequestLimiter } = require("../../../middleware/rateLimiter");
const {
  createMatchRequestSchema,
  updateMatchRequestSchema,
} = require("../validation/matchRequestValidation");

// Public route — allow external teams to submit match requests.
// Rate limited and validated: this is the only unauthenticated write that stores
// free text the admin reads, so a link in the name/team/venue fields (or a long
// stream of junk submissions) is refused at the edge.
router.post(
  "/",
  matchRequestLimiter,
  validate(createMatchRequestSchema),
  matchRequestController.createMatchRequest
);

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
  validate(updateMatchRequestSchema),
  matchRequestController.updateMatchRequest
);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  matchRequestController.deleteMatchRequest
);

module.exports = router;
