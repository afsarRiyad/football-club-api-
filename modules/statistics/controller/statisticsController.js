const Statistic = require("../model/Statistic");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");

exports.createStatistic = catchAsync(async (req, res, next) => {
  const statistic = await Statistic.create(req.body);

  res.status(201).json({
    success: true,
    data: { statistic },
  });
});

exports.getAllStatistics = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.club) filter.club = req.query.club;
  if (req.query.player) filter.player = req.query.player;
  if (req.query.team) filter.team = req.query.team;
  if (req.query.season) filter.season = req.query.season;
  if (req.query.competition) filter.competition = req.query.competition;
  if (req.query.type) filter.type = req.query.type;

  const total = await Statistic.countDocuments(filter);
  const statistics = await Statistic.find(filter)
    .populate("player", "firstName lastName number position")
    .populate("team", "name slug")
    .populate("season", "name year")
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    results: statistics.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: statistics,
  });
});

exports.getStatistic = catchAsync(async (req, res, next) => {
  const statistic = await Statistic.findById(req.params.id)
    .populate("player", "firstName lastName number position")
    .populate("team", "name slug")
    .populate("season", "name year")
    .populate("competition", "name type");

  if (!statistic) {
    return next(new AppError("Statistic not found.", 404));
  }

  res.status(200).json({
    success: true,
    data: { statistic },
  });
});

exports.updateStatistic = catchAsync(async (req, res, next) => {
  const statistic = await Statistic.findById(req.params.id);

  if (!statistic) {
    return next(new AppError("Statistic not found.", 404));
  }

  const updated = await Statistic.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: { statistic: updated },
  });
});

exports.deleteStatistic = catchAsync(async (req, res, next) => {
  const statistic = await Statistic.findByIdAndDelete(req.params.id);

  if (!statistic) {
    return next(new AppError("Statistic not found.", 404));
  }

  res.status(200).json({
    success: true,
    message: "Statistic deleted successfully.",
  });
});

// Get top scorers for a season/competition
exports.getTopScorers = catchAsync(async (req, res, next) => {
  const filter = { type: "PLAYER_SEASON", goals: { $gt: 0 } };
  if (req.query.season) filter.season = req.query.season;
  if (req.query.competition) filter.competition = req.query.competition;
  if (req.query.club) filter.club = req.query.club;

  const topScorers = await Statistic.find(filter)
    .populate("player", "firstName lastName number position photo")
    .populate("team", "name slug")
    .sort("-goals")
    .limit(parseInt(req.query.limit, 10) || 20);

  res.status(200).json({
    success: true,
    results: topScorers.length,
    data: topScorers,
  });
});

// Get team standings
exports.getTeamStandings = catchAsync(async (req, res, next) => {
  const filter = { type: "TEAM_SEASON" };
  if (req.query.season) filter.season = req.query.season;
  if (req.query.competition) filter.competition = req.query.competition;
  if (req.query.club) filter.club = req.query.club;

  const standings = await Statistic.find(filter)
    .populate("team", "name slug logo")
    .sort("-points -goalDifference")
    .limit(parseInt(req.query.limit, 10) || 50);

  // Calculate goal difference
  const standingsWithGD = standings.map((s) => ({
    ...s.toObject(),
    goalDifference: s.goalsFor - s.goalsAgainst,
  }));

  res.status(200).json({
    success: true,
    results: standingsWithGD.length,
    data: standingsWithGD,
  });
});
