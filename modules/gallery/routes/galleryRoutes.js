const express = require("express");
const router = express.Router();
const galleryController = require("../controller/galleryController");
const { protect } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");
const validate = require("../../../middleware/validate");
const {
  createGallerySchema,
  updateGallerySchema,
  addMediaSchema,
} = require("../validation/galleryValidation");

// Public routes
router.get("/", galleryController.getAllGalleries);
router.get("/:id", galleryController.getGallery);

// Protected routes
router.use(protect);

router.post(
  "/",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(createGallerySchema),
  galleryController.createGallery
);

router.patch(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(updateGallerySchema),
  galleryController.updateGallery
);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  galleryController.deleteGallery
);

// Media management
router.post(
  "/:id/media",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(addMediaSchema),
  galleryController.addMedia
);

router.delete(
  "/:id/media/:mediaId",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  galleryController.removeMedia
);

module.exports = router;
