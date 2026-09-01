const Competition = require("../model/Competition");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");

exports.createCompetition = catchAsync(async (req, res, next) => {
  const competition = await Competition.create(req.body);

  res.status(201).json({
    success: true,
    data: { competition },
  });
});

exports.getAllCompetitions = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.club) filter.club = req.query.club;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.season) filter.season = req.query.season;
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === "true";
  }
  if (req.query.search) {
    filter.name = { $regex: req.query.search, $options: "i" };
  }

  const total = await Competition.countDocuments(filter);
  const competitions = await Competition.find(filter)
    .populate("club", "name slug")
    .populate("season", "name year")
    .populate("teams", "name slug logo")
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    results: competitions.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: { competitions },
  });
});

exports.getCompetition = catchAsync(async (req, res, next) => {
  const competition = await Competition.findById(req.params.id)
    .populate("club", "name slug logo")
    .populate("season", "name year")
    .populate("teams", "name slug logo");

  if (!competition) {
    return next(new AppError("Competition not found.", 404));
  }

  res.status(200).json({
    success: true,
    data: { competition },
  });
});

exports.updateCompetition = catchAsync(async (req, res, next) => {
  const competition = await Competition.findById(req.params.id);

  if (!competition) {
    return next(new AppError("Competition not found.", 404));
  }

  const updated = await Competition.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: { competition: updated },
  });
});

exports.deleteCompetition = catchAsync(async (req, res, next) => {
  const competition = await Competition.findByIdAndDelete(req.params.id);

  if (!competition) {
    return next(new AppError("Competition not found.", 404));
  }

  res.status(200).json({
    success: true,
    message: "Competition deleted successfully.",
  });
});

exports.addTeamToCompetition = catchAsync(async (req, res, next) => {
  const competition = await Competition.findById(req.params.id);

  if (!competition) {
    return next(new AppError("Competition not found.", 404));
  }

  const { teamId } = req.body;
  if (competition.teams.includes(teamId)) {
    return next(new AppError("Team is already in this competition.", 400));
  }

  competition.teams.push(teamId);
  await competition.save();

  res.status(200).json({
    success: true,
    data: { competition },
  });
});

exports.removeTeamFromCompetition = catchAsync(async (req, res, next) => {
  const competition = await Competition.findById(req.params.id);

  if (!competition) {
    return next(new AppError("Competition not found.", 404));
  }

  competition.teams = competition.teams.filter(
    (t) => t.toString() !== req.params.teamId
  );
  await competition.save();

  res.status(200).json({
    success: true,
    data: { competition },
  });
});
