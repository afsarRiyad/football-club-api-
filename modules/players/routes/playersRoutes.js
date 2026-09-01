const express = require("express");
const router = express.Router();
const playersController = require("../controller/playersController");
const { protect } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");
const validate = require("../../../middleware/validate");
const {
  createPlayerSchema,
  updatePlayerSchema,
  bulkImportSchema,
  transferPlayerSchema,
  linkToUserSchema,
} = require("../validation/playersValidation");

// Public routes
router.get("/", playersController.getAllPlayers);
router.get("/:id", playersController.getPlayer);

// Protected routes
router.use(protect);

// ─── CRUD ───────────────────────────────────────────────────────────
router.post(
  "/",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH"),
  validate(createPlayerSchema),
  playersController.createPlayer
);

router.patch(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH"),
  validate(updatePlayerSchema),
  playersController.updatePlayer
);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  playersController.deletePlayer
);

// ─── Bulk Import ────────────────────────────────────────────────────
router.post(
  "/bulk-import",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(bulkImportSchema),
  playersController.bulkImportPlayers
);

// ─── Transfer ───────────────────────────────────────────────────────
router.post(
  "/:id/transfer",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(transferPlayerSchema),
  playersController.transferPlayer
);

// ─── Link to User Account ───────────────────────────────────────────
router.post(
  "/:id/link-user",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(linkToUserSchema),
  playersController.linkToUser
);

router.delete(
  "/:id/unlink-user",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  playersController.unlinkFromUser
);

module.exports = router;
