const Team = require("../model/Team");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");

exports.createTeam = catchAsync(async (req, res, next) => {
  const team = await Team.create(req.body);

  res.status(201).json({
    success: true,
    data: { team },
  });
});

exports.getAllTeams = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.club) filter.club = req.query.club;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === "true";
  }
  if (req.query.search) {
    filter.name = { $regex: req.query.search, $options: "i" };
  }

  const total = await Team.countDocuments(filter);
  const teams = await Team.find(filter)
    .populate("club", "name slug")
    .populate("manager", "name email")
    .populate("coach", "name email")
    .populate("players", "firstName lastName number position")
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    results: teams.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: teams,
  });
});

exports.getTeam = catchAsync(async (req, res, next) => {
  const team = await Team.findById(req.params.id)
    .populate("club", "name slug logo")
    .populate("manager", "name email")
    .populate("coach", "name email")
    .populate("players", "firstName lastName number position photo status")
    .populate("captain", "firstName lastName number");

  if (!team) {
    return next(new AppError("Team not found.", 404));
  }

  res.status(200).json({
    success: true,
    data: { team },
  });
});

exports.updateTeam = catchAsync(async (req, res, next) => {
  const team = await Team.findById(req.params.id);

  if (!team) {
    return next(new AppError("Team not found.", 404));
  }

  const updatedTeam = await Team.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: { team: updatedTeam },
  });
});

exports.deleteTeam = catchAsync(async (req, res, next) => {
  const team = await Team.findByIdAndDelete(req.params.id);

  if (!team) {
    return next(new AppError("Team not found.", 404));
  }

  res.status(200).json({
    success: true,
    message: "Team deleted successfully.",
  });
});

exports.addPlayerToTeam = catchAsync(async (req, res, next) => {
  const team = await Team.findById(req.params.id);

  if (!team) {
    return next(new AppError("Team not found.", 404));
  }

  const { playerId } = req.body;
  if (!playerId) {
    return next(new AppError("Player ID is required.", 400));
  }

  if (team.players.includes(playerId)) {
    return next(new AppError("Player is already in this team.", 400));
  }

  team.players.push(playerId);
  await team.save();

  res.status(200).json({
    success: true,
    data: { team },
  });
});

exports.removePlayerFromTeam = catchAsync(async (req, res, next) => {
  const team = await Team.findById(req.params.id);

  if (!team) {
    return next(new AppError("Team not found.", 404));
  }

  team.players = team.players.filter(
    (p) => p.toString() !== req.params.playerId
  );
  await team.save();

  res.status(200).json({
    success: true,
    data: { team },
  });
});
