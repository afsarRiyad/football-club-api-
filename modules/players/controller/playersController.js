const Player = require("../model/Player");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");

exports.createPlayer = catchAsync(async (req, res, next) => {
  const player = await Player.create(req.body);

  res.status(201).json({
    success: true,
    data: { player },
  });
});

exports.getAllPlayers = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.club) filter.club = req.query.club;
  if (req.query.position) filter.position = req.query.position;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === "true";
  }
  if (req.query.search) {
    filter.$or = [
      { firstName: { $regex: req.query.search, $options: "i" } },
      { lastName: { $regex: req.query.search, $options: "i" } },
    ];
  }

  const total = await Player.countDocuments(filter);
  const players = await Player.find(filter)
    .populate("user", "name email")
    .populate("club", "name slug")
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    results: players.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: { players },
  });
});

exports.getPlayer = catchAsync(async (req, res, next) => {
  const player = await Player.findById(req.params.id)
    .populate("user", "name email photo")
    .populate("club", "name slug logo");

  if (!player) {
    return next(new AppError("Player not found.", 404));
  }

  res.status(200).json({
    success: true,
    data: { player },
  });
});

exports.updatePlayer = catchAsync(async (req, res, next) => {
  const player = await Player.findById(req.params.id);

  if (!player) {
    return next(new AppError("Player not found.", 404));
  }

  const updatedPlayer = await Player.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: { player: updatedPlayer },
  });
});

exports.deletePlayer = catchAsync(async (req, res, next) => {
  const player = await Player.findByIdAndDelete(req.params.id);

  if (!player) {
    return next(new AppError("Player not found.", 404));
  }

  res.status(200).json({
    success: true,
    message: "Player deleted successfully.",
  });
});

exports.getPlayersByClub = catchAsync(async (req, res, next) => {
  const players = await Player.find({
    club: req.params.clubId,
    isActive: true,
  })
    .populate("user", "name email photo")
    .sort("lastName firstName");

  res.status(200).json({
    success: true,
    results: players.length,
    data: { players },
  });
});
