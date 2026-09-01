const Gallery = require("../model/Gallery");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");

exports.createGallery = catchAsync(async (req, res, next) => {
  const gallery = await Gallery.create({
    ...req.body,
    uploadedBy: req.user.id,
  });

  res.status(201).json({
    success: true,
    data: { gallery },
  });
});

exports.getAllGalleries = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.club) filter.club = req.query.club;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.isPublished !== undefined) {
    filter.isPublished = req.query.isPublished === "true";
  }
  if (req.query.search) {
    filter.title = { $regex: req.query.search, $options: "i" };
  }

  const total = await Gallery.countDocuments(filter);
  const galleries = await Gallery.find(filter)
    .populate("club", "name slug")
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    results: galleries.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: { galleries },
  });
});

exports.getGallery = catchAsync(async (req, res, next) => {
  const gallery = await Gallery.findById(req.params.id)
    .populate("club", "name slug logo")
    .populate("media.uploadedBy", "name photo");

  if (!gallery) {
    return next(new AppError("Gallery not found.", 404));
  }

  res.status(200).json({
    success: true,
    data: { gallery },
  });
});

exports.updateGallery = catchAsync(async (req, res, next) => {
  const gallery = await Gallery.findById(req.params.id);

  if (!gallery) {
    return next(new AppError("Gallery not found.", 404));
  }

  const updated = await Gallery.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: { gallery: updated },
  });
});

exports.deleteGallery = catchAsync(async (req, res, next) => {
  const gallery = await Gallery.findByIdAndDelete(req.params.id);

  if (!gallery) {
    return next(new AppError("Gallery not found.", 404));
  }

  res.status(200).json({
    success: true,
    message: "Gallery deleted successfully.",
  });
});

exports.addMedia = catchAsync(async (req, res, next) => {
  const gallery = await Gallery.findById(req.params.id);

  if (!gallery) {
    return next(new AppError("Gallery not found.", 404));
  }

  gallery.media.push({
    ...req.body,
    uploadedBy: req.user.id,
  });
  await gallery.save();

  res.status(200).json({
    success: true,
    data: { gallery },
  });
});

exports.removeMedia = catchAsync(async (req, res, next) => {
  const gallery = await Gallery.findById(req.params.id);

  if (!gallery) {
    return next(new AppError("Gallery not found.", 404));
  }

  gallery.media = gallery.media.filter(
    (item) => item._id.toString() !== req.params.mediaId
  );
  await gallery.save();

  res.status(200).json({
    success: true,
    data: { gallery },
  });
});
