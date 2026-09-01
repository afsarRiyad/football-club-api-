const express = require("express");
const router = express.Router();
const {
  upload,
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  deleteFromCloudinary,
} = require("../../../middleware/upload");
const { protect } = require("../../../middleware/auth");
const { authorize } = require("../../../middleware/rbac");
const catchAsync = require("../../../utils/catchAsync");
const AppError = require("../../../utils/AppError");

// Helper to throw from catchAsync context
const throwIf = (condition, msg, status = 400) => {
  if (condition) throw new AppError(msg, status);
};

// ─── Single File Upload ─────────────────────────────────────────────
// Accepts: images (JPEG, PNG, GIF, WebP, SVG) and videos (MP4, MPEG, MOV, WebM)
router.post(
  "/",
  protect,
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH"),
  upload.single("file"),
  uploadToCloudinary,
  catchAsync(async (req, res) => {
    res.status(200).json({
      success: true,
      data: { file: req.uploadedFile },
    });
  })
);

// ─── Multiple File Upload ───────────────────────────────────────────
// Max 10 files at once
router.post(
  "/multiple",
  protect,
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER"),
  upload.array("files", 10),
  uploadMultipleToCloudinary,
  catchAsync(async (req, res) => {
    res.status(200).json({
      success: true,
      results: req.uploadedFiles.length,
      data: { files: req.uploadedFiles },
    });
  })
);

// ─── Avatar Upload ──────────────────────────────────────────────────
// Profile photo — single image, max 5MB
router.post(
  "/avatar",
  protect,
  upload.single("avatar"),
  uploadToCloudinary,
  catchAsync(async (req, res) => {
    throwIf(!req.uploadedFile, "Please upload an image.", 400);

    // Update user's photo field
    const User = require("../../auth/model/User");
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { photo: req.uploadedFile.url },
      { new: true }
    );

    res.status(200).json({
      success: true,
      data: {
        url: req.uploadedFile.url,
        user,
      },
    });
  })
);

// ─── Club Logo Upload ───────────────────────────────────────────────
router.post(
  "/club-logo/:clubId",
  protect,
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  upload.single("logo"),
  uploadToCloudinary,
  catchAsync(async (req, res) => {
    const Club = require("../../club/model/Club");

    const club = await Club.findById(req.params.clubId);
    throwIf(!club, "Club not found.", 404);

    club.logo = req.uploadedFile.url;
    await club.save();

    res.status(200).json({
      success: true,
      data: { url: req.uploadedFile.url, club },
    });
  })
);

// ─── Club Cover Image Upload ────────────────────────────────────────
router.post(
  "/club-cover/:clubId",
  protect,
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  upload.single("cover"),
  uploadToCloudinary,
  catchAsync(async (req, res) => {
    const Club = require("../../club/model/Club");

    const club = await Club.findById(req.params.clubId);
    throwIf(!club, "Club not found.", 404);

    club.coverImage = req.uploadedFile.url;
    await club.save();

    res.status(200).json({
      success: true,
      data: { url: req.uploadedFile.url, club },
    });
  })
);

// ─── Player Photo Upload ────────────────────────────────────────────
router.post(
  "/player-photo/:playerId",
  protect,
  authorize("SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER"),
  upload.single("photo"),
  uploadToCloudinary,
  catchAsync(async (req, res) => {
    const Player = require("../../players/model/Player");

    const player = await Player.findById(req.params.playerId);
    throwIf(!player, "Player not found.", 404);

    player.photo = req.uploadedFile.url;
    await player.save();

    res.status(200).json({
      success: true,
      data: { url: req.uploadedFile.url, player },
    });
  })
);

// ─── News Cover Upload ──────────────────────────────────────────────
router.post(
  "/news-cover/:newsId",
  protect,
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  upload.single("cover"),
  uploadToCloudinary,
  catchAsync(async (req, res) => {
    const News = require("../../news/model/News");

    const article = await News.findById(req.params.newsId);
    throwIf(!article, "Article not found.", 404);

    article.coverImage = req.uploadedFile.url;
    await article.save();

    res.status(200).json({
      success: true,
      data: { url: req.uploadedFile.url, article },
    });
  })
);

// ─── Delete File ────────────────────────────────────────────────────
router.delete(
  "/",
  protect,
  authorize("SUPER_ADMIN", "CLUB_ADMIN"),
  catchAsync(async (req, res, next) => {
    const { publicId, resourceType } = req.body;

    throwIf(!publicId, "publicId is required.", 400);

    const deleted = await deleteFromCloudinary(
      publicId,
      resourceType || "image"
    );

    throwIf(!deleted, "Failed to delete file.", 500);

    res.status(200).json({
      success: true,
      message: "File deleted successfully.",
    });
  })
);

module.exports = router;
