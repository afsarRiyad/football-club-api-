const Match = require("../model/Match");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");
const { emitToMatch, getMatchViewerCount } = require("../../../config/socket");

exports.createMatch = catchAsync(async (req, res, next) => {
  const match = await Match.create(req.body);

  res.status(201).json({
    success: true,
    data: { match },
  });
});

exports.getAllMatches = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.club) filter.club = req.query.club;
  if (req.query.competition) filter.competition = req.query.competition;
  if (req.query.season) filter.season = req.query.season;
  if (req.query.status) filter.status = req.query.status;

  // Date range filtering
  if (req.query.from || req.query.to) {
    filter.matchDate = {};
    if (req.query.from) filter.matchDate.$gte = new Date(req.query.from);
    if (req.query.to) filter.matchDate.$lte = new Date(req.query.to);
  }

  // Sort: accept -matchDate, matchDate, etc.
  let sort = "matchDate";
  if (req.query.sort) {
    sort = req.query.sort;
  }

  const total = await Match.countDocuments(filter);
  const matches = await Match.find(filter)
    .populate("homeTeam", "name slug logo")
    .populate("awayTeam", "name slug logo")
    .populate("competition", "name type")
    .populate("events.player", "firstName lastName number")
    .populate("events.assist", "firstName lastName number")
    .sort(sort)
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    results: matches.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: matches,
  });
});

exports.getMatch = catchAsync(async (req, res, next) => {
  const match = await Match.findById(req.params.id)
    .populate("homeTeam", "name slug logo")
    .populate("awayTeam", "name slug logo")
    .populate("competition", "name type")
    .populate("season", "name year")
    .populate("events.player", "firstName lastName number")
    .populate("events.assist", "firstName lastName number");

  if (!match) {
    return next(new AppError("Match not found.", 404));
  }

  res.status(200).json({
    success: true,
    data: { match },
  });
});

exports.updateMatch = catchAsync(async (req, res, next) => {
  const match = await Match.findById(req.params.id);

  if (!match) {
    return next(new AppError("Match not found.", 404));
  }

  const updatedMatch = await Match.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: false, // Disable schema validators to allow partial updates
  });

  // Emit real-time updates based on what changed
  if (req.body.score) {
    emitToMatch(req.params.id, "match:scoreUpdate", {
      matchId: req.params.id,
      score: updatedMatch.score,
    });
  }

  if (req.body.status) {
    emitToMatch(req.params.id, "match:statusChange", {
      matchId: req.params.id,
      status: updatedMatch.status,
    });
  }

  res.status(200).json({
    success: true,
    data: { match: updatedMatch },
  });
});

exports.deleteMatch = catchAsync(async (req, res, next) => {
  const match = await Match.findByIdAndDelete(req.params.id);

  if (!match) {
    return next(new AppError("Match not found.", 404));
  }

  res.status(200).json({
    success: true,
    message: "Match deleted successfully.",
  });
});

exports.addMatchEvent = catchAsync(async (req, res, next) => {
  const match = await Match.findById(req.params.id);

  if (!match) {
    return next(new AppError("Match not found.", 404));
  }

  match.events.push(req.body);
  await match.save();

  // Emit the new event to all viewers
  const newEvent = match.events[match.events.length - 1];
  emitToMatch(req.params.id, "match:newEvent", {
    matchId: req.params.id,
    event: newEvent,
    score: match.score,
  });

  res.status(200).json({
    success: true,
    data: { match },
  });
});

exports.removeMatchEvent = catchAsync(async (req, res, next) => {
  const match = await Match.findById(req.params.id);

  if (!match) {
    return next(new AppError("Match not found.", 404));
  }

  match.events = match.events.filter(
    (_, index) => index !== parseInt(req.params.eventIndex, 10)
  );
  await match.save();

  res.status(200).json({
    success: true,
    data: { match },
  });
});

// ─── Live Match Helpers ──────────────────────────────────────────────

exports.getLiveMatches = catchAsync(async (req, res, next) => {
  const matches = await Match.find({ status: { $in: ["LIVE", "HT"] } })
    .populate("homeTeam", "name slug logo")
    .populate("awayTeam", "name slug logo")
    .populate("competition", "name type")
    .sort("matchDate");

  // Attach viewer counts
  const matchesWithViewers = matches.map((m) => ({
    ...m.toObject(),
    viewers: getMatchViewerCount(m._id.toString()),
  }));

  res.status(200).json({
    success: true,
    results: matchesWithViewers.length,
    data: { matches: matchesWithViewers },
  });
});

exports.getMatchViewerCount = catchAsync(async (req, res, next) => {
  const viewers = getMatchViewerCount(req.params.id);

  res.status(200).json({
    success: true,
    data: { matchId: req.params.id, viewers },
  });
});
