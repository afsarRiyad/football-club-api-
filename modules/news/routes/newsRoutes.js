const express = require("express");
const router = express.Router();
const newsController = require("../controller/newsController");
const { protect, optionalAuth } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");
const validate = require("../../../middleware/validate");
const {
  createNewsSchema,
  updateNewsSchema,
} = require("../validation/newsValidation");

/* Public route. optionalAuth (not protect) so an anonymous visitor gets
   published articles only, while the admin — which sends its Bearer token —
   also gets drafts, which is the whole point of the `isAdmin` branch in
   getAllNews and of the isPublished filter it accepts. */
router.get("/", optionalAuth, newsController.getAllNews);
router.get("/:slug", newsController.getNews);

// Protected routes
router.use(protect);

router.post(
  "/",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(createNewsSchema),
  newsController.createNews
);

router.patch(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  validate(updateNewsSchema),
  newsController.updateNews
);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  newsController.deleteNews
);

router.patch("/:id/publish", authorize("SUPER_ADMIN", "CLUB_ADMIN"), newsController.publishNews);
router.patch("/:id/unpublish", authorize("SUPER_ADMIN", "CLUB_ADMIN"), newsController.unpublishNews);

/* Hero slot on the news page / homepage. One featured article at a time. */
router.patch("/:id/feature", authorize("SUPER_ADMIN", "CLUB_ADMIN"), newsController.featureNews);
router.patch("/:id/unfeature", authorize("SUPER_ADMIN", "CLUB_ADMIN"), newsController.unfeatureNews);

module.exports = router;
