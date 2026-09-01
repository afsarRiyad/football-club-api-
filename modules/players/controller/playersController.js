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

// ─── Bulk Import Players ────────────────────────────────────────────
exports.bulkImportPlayers = catchAsync(async (req, res, next) => {
  const { players: playersData } = req.body;

  if (!Array.isArray(playersData) || playersData.length === 0) {
    return next(new AppError("Please provide an array of players.", 400));
  }

  if (playersData.length > 50) {
    return next(new AppError("Cannot import more than 50 players at once.", 400));
  }

  const results = {
    created: [],
    errors: [],
  };

  for (let i = 0; i < playersData.length; i++) {
    try {
      const player = await Player.create(playersData[i]);
      results.created.push({
        index: i,
        player: {
          id: player._id,
          name: `${player.firstName} ${player.lastName}`,
          number: player.number,
        },
      });
    } catch (error) {
      results.errors.push({
        index: i,
        data: playersData[i],
        error: error.message,
      });
    }
  }

  res.status(201).json({
    success: true,
    results: {
      total: playersData.length,
      created: results.created.length,
      failed: results.errors.length,
    },
    data: results,
  });
});

// ─── Transfer Player Between Clubs ──────────────────────────────────
exports.transferPlayer = catchAsync(async (req, res, next) => {
  const { toClubId, newNumber, transferNotes } = req.body;

  if (!toClubId) {
    return next(new AppError("Target club ID is required.", 400));
  }

  const player = await Player.findById(req.params.id);
  if (!player) {
    return next(new AppError("Player not found.", 404));
  }

  const fromClubId = player.club.toString();
  if (fromClubId === toClubId) {
    return next(new AppError("Player is already at this club.", 400));
  }

  // Check if number is available at new club
  if (newNumber) {
    const numberTaken = await Player.findOne({
      club: toClubId,
      number: newNumber,
      _id: { $ne: player._id },
    });
    if (numberTaken) {
      return next(new AppError(`Number ${newNumber} is already taken at the target club.`, 400));
    }
  }

  // Remove from any teams at old club
  const Team = require("../../teams/model/Team");
  await Team.updateMany(
    { club: fromClubId, players: player._id },
    { $pull: { players: player._id } }
  );

  // Update player
  player.club = toClubId;
  if (newNumber) player.number = newNumber;
  player.status = "ACTIVE";
  player.joinDate = new Date();
  await player.save();

  res.status(200).json({
    success: true,
    message: `Player transferred successfully.${transferNotes ? " Notes: " + transferNotes : ""}`,
    data: { player },
  });
});

// ─── Link Player to User Account ────────────────────────────────────
exports.linkToUser = catchAsync(async (req, res, next) => {
  const { userId } = req.body;

  if (!userId) {
    return next(new AppError("User ID is required.", 400));
  }

  const User = require("../../auth/model/User");

  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError("User not found.", 404));
  }

  const player = await Player.findById(req.params.id);
  if (!player) {
    return next(new AppError("Player not found.", 404));
  }

  // Check if this user is already linked to another player
  const existingLink = await Player.findOne({ user: userId, _id: { $ne: player._id } });
  if (existingLink) {
    return next(new AppError("This user is already linked to another player.", 400));
  }

  player.user = userId;
  await player.save();

  res.status(200).json({
    success: true,
    message: "Player linked to user account successfully.",
    data: { player },
  });
});

// ─── Unlink Player from User Account ────────────────────────────────
exports.unlinkFromUser = catchAsync(async (req, res, next) => {
  const player = await Player.findById(req.params.id);
  if (!player) {
    return next(new AppError("Player not found.", 404));
  }

  if (!player.user) {
    return next(new AppError("Player is not linked to any user account.", 400));
  }

  player.user = undefined;
  await player.save();

  res.status(200).json({
    success: true,
    message: "Player unlinked from user account.",
    data: { player },
  });
});
