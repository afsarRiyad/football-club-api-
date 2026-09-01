const express = require("express");
const router = express.Router();
const newsController = require("../controller/newsController");
const { protect } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");
const validate = require("../../../middleware/validate");
const {
  createNewsSchema,
  updateNewsSchema,
} = require("../validation/newsValidation");

// Public routes (read published)
router.get("/", newsController.getAllNews);
router.get("/:id", newsController.getNews);

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

module.exports = router;
