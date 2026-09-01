const Club = require("../model/Club");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");

exports.createClub = catchAsync(async (req, res, next) => {
  const club = await Club.create({
    ...req.body,
    admin: req.user.id,
  });

  res.status(201).json({
    success: true,
    data: { club },
  });
});

exports.getAllClubs = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  // Build filter
  const filter = {};
  if (req.query.search) {
    filter.name = { $regex: req.query.search, $options: "i" };
  }
  if (req.query.country) {
    filter["location.country"] = req.query.country;
  }

  const total = await Club.countDocuments(filter);
  const clubs = await Club.find(filter)
    .populate("admin", "name email")
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    results: clubs.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: { clubs },
  });
});

exports.getClub = catchAsync(async (req, res, next) => {
  const club = await Club.findById(req.params.id)
    .populate("admin", "name email");

  if (!club) {
    return next(new AppError("Club not found.", 404));
  }

  res.status(200).json({
    success: true,
    data: { club },
  });
});

exports.getClubBySlug = catchAsync(async (req, res, next) => {
  const club = await Club.findOne({ slug: req.params.slug })
    .populate("admin", "name email");

  if (!club) {
    return next(new AppError("Club not found.", 404));
  }

  res.status(200).json({
    success: true,
    data: { club },
  });
});

exports.updateClub = catchAsync(async (req, res, next) => {
  const club = await Club.findById(req.params.id);

  if (!club) {
    return next(new AppError("Club not found.", 404));
  }

  // Only admin or super admin can update
  if (club.admin.toString() !== req.user.id && req.user.role !== "SUPER_ADMIN") {
    return next(new AppError("You do not have permission to update this club.", 403));
  }

  const updatedClub = await Club.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: { club: updatedClub },
  });
});

exports.deleteClub = catchAsync(async (req, res, next) => {
  const club = await Club.findById(req.params.id);

  if (!club) {
    return next(new AppError("Club not found.", 404));
  }

  if (club.admin.toString() !== req.user.id && req.user.role !== "SUPER_ADMIN") {
    return next(new AppError("You do not have permission to delete this club.", 403));
  }

  await Club.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: "Club deleted successfully.",
  });
});
