const express = require("express");
const router = express.Router();
const playersController = require("../controller/playersController");
const { protect } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");
const validate = require("../../../middleware/validate");
const {
  createPlayerSchema,
  updatePlayerSchema,
} = require("../validation/playersValidation");

// Public routes
router.get("/", playersController.getAllPlayers);
router.get("/:id", playersController.getPlayer);

// Protected routes
router.use(protect);

router.post(
  "/",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER"),
  validate(createPlayerSchema),
  playersController.createPlayer
);

router.patch(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER"),
  validate(updatePlayerSchema),
  playersController.updatePlayer
);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  playersController.deletePlayer
);

module.exports = router;
