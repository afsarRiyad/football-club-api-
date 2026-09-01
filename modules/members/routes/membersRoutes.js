const express = require("express");
const router = express.Router();
const membersController = require("../controller/membersController");
const { protect } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");
const validate = require("../../../middleware/validate");
const {
  createMemberSchema,
  updateMemberSchema,
  upgradeMembershipSchema,
} = require("../validation/membersValidation");

// All member routes require authentication
router.use(protect);

router.get("/", authorize("SUPER_ADMIN", "CLUB_ADMIN"), membersController.getAllMembers);
router.get("/:id", membersController.getMember);

router.post(
  "/",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(createMemberSchema),
  membersController.createMember
);

router.patch(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(updateMemberSchema),
  membersController.updateMember
);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  membersController.deleteMember
);

router.patch(
  "/:id/upgrade",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(upgradeMembershipSchema),
  membersController.upgradeMembership
);

module.exports = router;
