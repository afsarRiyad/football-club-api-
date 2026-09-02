const Academy = require("../model/Academy");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");

exports.createAcademy = catchAsync(async (req, res, next) => {
  const academy = await Academy.create(req.body);

  res.status(201).json({
    success: true,
    data: { academy },
  });
});

exports.getAllAcademies = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.club) filter.club = req.query.club;
  if (req.query.ageGroup) filter.ageGroup = req.query.ageGroup;
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === "true";
  }

  const total = await Academy.countDocuments(filter);
  const academies = await Academy.find(filter)
    .populate("club", "name slug")
    .populate("headCoach", "name email")
    .populate("players", "firstName lastName number position dateOfBirth")
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    results: academies.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: academies,
  });
});

exports.getAcademy = catchAsync(async (req, res, next) => {
  const academy = await Academy.findById(req.params.id)
    .populate("club", "name slug logo")
    .populate("headCoach", "name email photo")
    .populate("players", "firstName lastName number position photo dateOfBirth");

  if (!academy) {
    return next(new AppError("Academy not found.", 404));
  }

  res.status(200).json({
    success: true,
    data: { academy },
  });
});

exports.updateAcademy = catchAsync(async (req, res, next) => {
  const academy = await Academy.findById(req.params.id);

  if (!academy) {
    return next(new AppError("Academy not found.", 404));
  }

  const updated = await Academy.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: { academy: updated },
  });
});

exports.deleteAcademy = catchAsync(async (req, res, next) => {
  const academy = await Academy.findByIdAndDelete(req.params.id);

  if (!academy) {
    return next(new AppError("Academy not found.", 404));
  }

  res.status(200).json({
    success: true,
    message: "Academy deleted successfully.",
  });
});

exports.addPlayerToAcademy = catchAsync(async (req, res, next) => {
  const academy = await Academy.findById(req.params.id);

  if (!academy) {
    return next(new AppError("Academy not found.", 404));
  }

  const { playerId } = req.body;
  if (!playerId) {
    return next(new AppError("Player ID is required.", 400));
  }

  if (academy.players.includes(playerId)) {
    return next(new AppError("Player is already in this academy.", 400));
  }

  academy.players.push(playerId);
  await academy.save();

  res.status(200).json({
    success: true,
    data: { academy },
  });
});

exports.removePlayerFromAcademy = catchAsync(async (req, res, next) => {
  const academy = await Academy.findById(req.params.id);

  if (!academy) {
    return next(new AppError("Academy not found.", 404));
  }

  academy.players = academy.players.filter(
    (p) => p.toString() !== req.params.playerId
  );
  await academy.save();

  res.status(200).json({
    success: true,
    data: { academy },
  });
});
