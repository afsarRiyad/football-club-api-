const express = require("express");
const router = express.Router();
const usersController = require("../controller/usersController");
const { protect } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");
const validate = require("../../../middleware/validate");
const {
  updateUserSchema,
  updateUserRoleSchema,
} = require("../validation/usersValidation");

// All user management routes require authentication
router.use(protect);

router.get("/", authorize("SUPER_ADMIN", "CLUB_ADMIN"), usersController.getAllUsers);

router.get("/:id", usersController.getUser);

router.patch(
  "/:id",
  validate(updateUserSchema),
  usersController.updateUser
);

router.patch(
  "/:id/role",
  authorize("SUPER_ADMIN"),
  validate(updateUserRoleSchema),
  usersController.updateUserRole
);

router.patch("/:id/deactivate", usersController.deactivateUser);
router.patch("/:id/activate", usersController.activateUser);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN"),
  usersController.deleteUser
);

module.exports = router;
