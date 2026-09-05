const MatchFormation = require("../model/MatchFormation");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");
const { emitToFormation } = require("../../../config/socket");

// Get all match formations (with filters)
exports.getAllMatchFormations = catchAsync(async (req, res, next) => {
  const filter = {};
  if (req.query.club) filter.club = req.query.club;
  if (req.query.match) filter.match = req.query.match;
  if (req.query.team) filter.team = req.query.team;

  const formations = await MatchFormation.find(filter)
    .populate("match", "matchDate kickoff venue status homeTeam awayTeam score")
    .populate({
      path: "match",
      populate: [
        { path: "homeTeam", select: "name slug logo" },
        { path: "awayTeam", select: "name slug logo" },
      ],
    })
    .populate("team", "name slug")
    .populate("startingXI.player", "firstName lastName number position photo")
    .populate("captain", "firstName lastName number")
    .populate("bench", "firstName lastName number position photo")
    .sort("-createdAt");

  res.status(200).json({
    success: true,
    results: formations.length,
    data: formations,
  });
});

// Get match formation by match ID and team ID
exports.getMatchFormation = catchAsync(async (req, res, next) => {
  const { matchId, teamId } = req.params;

  const formation = await MatchFormation.findOne({
    match: matchId,
    team: teamId,
  })
    .populate("match", "matchDate kickoff venue status homeTeam awayTeam score")
    .populate({
      path: "match",
      populate: [
        { path: "homeTeam", select: "name slug logo" },
        { path: "awayTeam", select: "name slug logo" },
      ],
    })
    .populate("team", "name slug")
    .populate("startingXI.player", "firstName lastName number position photo")
    .populate("captain", "firstName lastName number")
    .populate("bench", "firstName lastName number position photo");

  if (!formation) {
    return next(new AppError("Match formation not found.", 404));
  }

  res.status(200).json({
    success: true,
    data: { formation },
  });
});

// Get formations for a specific match (all teams)
exports.getMatchFormations = catchAsync(async (req, res, next) => {
  const { matchId } = req.params;

  const formations = await MatchFormation.find({ match: matchId })
    .populate("team", "name slug logo")
    .populate("startingXI.player", "firstName lastName number position photo")
    .populate("captain", "firstName lastName number")
    .populate("bench", "firstName lastName number position photo");

  res.status(200).json({
    success: true,
    results: formations.length,
    data: formations,
  });
});

// Create or update match formation (upsert)
exports.upsertMatchFormation = catchAsync(async (req, res, next) => {
  const { match, team, club, formation, playerCount, startingXI, captain, bench, notes } = req.body;

  if (!match || !team || !club) {
    return next(new AppError("match, team, and club are required.", 400));
  }

  const existing = await MatchFormation.findOne({ match, team });

  if (existing) {
    existing.formation = formation || existing.formation;
    if (playerCount) existing.playerCount = playerCount;
    existing.startingXI = startingXI || existing.startingXI;
    existing.captain = captain || existing.captain;
    existing.notes = notes !== undefined ? notes : existing.notes;
    // Force-set bench to handle old documents that don't have the field
    existing.set('bench', bench || []);
    existing.markModified('bench');
    await existing.save();

    const populated = await MatchFormation.findById(existing._id)
      .populate("match", "matchDate kickoff venue status homeTeam awayTeam score")
      .populate({
        path: "match",
        populate: [
          { path: "homeTeam", select: "name slug logo" },
          { path: "awayTeam", select: "name slug logo" },
        ],
      })
      .populate("team", "name slug")
      .populate("startingXI.player", "firstName lastName number position photo")
      .populate("captain", "firstName lastName number")
    .populate("bench", "firstName lastName number position photo");

    // Emit real-time update to formation room
    emitToFormation(match, "formation:update", {
      matchId: match,
      teamId: team,
      formation: populated,
    });

    return res.status(200).json({
      success: true,
      data: { formation: populated },
    });
  }

  const newFormation = await MatchFormation.create({
    match,
    team,
    club,
    formation,
    playerCount: playerCount || 11,
    startingXI,
    captain,
    bench: bench || [],
    notes,
  });

  const populated = await MatchFormation.findById(newFormation._id)
    .populate("match", "matchDate kickoff venue status homeTeam awayTeam score")
    .populate({
      path: "match",
      populate: [
        { path: "homeTeam", select: "name slug logo" },
        { path: "awayTeam", select: "name slug logo" },
      ],
    })
    .populate("team", "name slug")
    .populate("startingXI.player", "firstName lastName number position photo")
    .populate("captain", "firstName lastName number")
    .populate("bench", "firstName lastName number position photo");

  // Emit real-time update to formation room
  emitToFormation(match, "formation:update", {
    matchId: match,
    teamId: team,
    formation: populated,
  });

  res.status(201).json({
    success: true,
    data: { formation: populated },
  });
});

// Delete match formation
exports.deleteMatchFormation = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const formation = await MatchFormation.findByIdAndDelete(id);
  if (!formation) {
    return next(new AppError("Match formation not found.", 404));
  }

  // Emit real-time update to formation room
  emitToFormation(formation.match.toString(), "formation:deleted", {
    matchId: formation.match.toString(),
    teamId: formation.team.toString(),
  });

  res.status(200).json({
    success: true,
    message: "Match formation deleted successfully.",
  });
});
