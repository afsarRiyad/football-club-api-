const Season = require("../model/Season");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");

exports.createSeason = catchAsync(async (req, res, next) => {
  const season = await Season.create(req.body);

  res.status(201).json({
    success: true,
    data: { season },
  });
});

exports.getAllSeasons = catchAsync(async (req, res, next) => {
  const filter = {};
  if (req.query.club) filter.club = req.query.club;
  if (req.query.year) filter.year = parseInt(req.query.year, 10);
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === "true";
  }

  const seasons = await Season.find(filter)
    .populate("club", "name slug")
    .sort("-year");

  res.status(200).json({
    success: true,
    results: seasons.length,
    data: { seasons },
  });
});

exports.getSeason = catchAsync(async (req, res, next) => {
  const season = await Season.findById(req.params.id)
    .populate("club", "name slug logo");

  if (!season) {
    return next(new AppError("Season not found.", 404));
  }

  res.status(200).json({
    success: true,
    data: { season },
  });
});

exports.updateSeason = catchAsync(async (req, res, next) => {
  const season = await Season.findById(req.params.id);

  if (!season) {
    return next(new AppError("Season not found.", 404));
  }

  const updated = await Season.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: { season: updated },
  });
});

exports.deleteSeason = catchAsync(async (req, res, next) => {
  const season = await Season.findByIdAndDelete(req.params.id);

  if (!season) {
    return next(new AppError("Season not found.", 404));
  }

  res.status(200).json({
    success: true,
    message: "Season deleted successfully.",
  });
});
