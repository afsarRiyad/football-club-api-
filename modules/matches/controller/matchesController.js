const Match = require("../model/Match");
const Team = require("../../teams/model/Team");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");
const { emitToMatch, getMatchViewerCount } = require("../../../config/socket");
const { resolveMatchSides, resolveMatchesSides } = require("../../../utils/matchSides");

/**
 * Copy the name and logo of each side onto the match being saved.
 *
 * A fixture is history: it has to keep reading correctly after the team behind it
 * is renamed, removed from a tournament, or deleted. The snapshot is what survives
 * that, and the display virtuals prefer the live Team while it exists, so ordinary
 * renames still show through. A hand-typed opponent (awayTeam null + awayTeamName)
 * is passed through untouched — it has no Team to look up.
 *
 * @param {object} data - the validated match payload
 * @returns {Promise<object>} the same payload with snapshot fields filled in
 */
async function withTeamSnapshots(data) {
  const ids = [data.homeTeam, data.awayTeam]
    .filter((v) => typeof v === "string" && /^[a-f\d]{24}$/i.test(v));
  if (ids.length === 0) return data;

  const teams = await Team.find({ _id: { $in: ids } }).select("name logo").lean();
  const byId = new Map(teams.map((t) => [String(t._id), t]));
  const out = { ...data };

  const home = byId.get(String(data.homeTeam));
  if (home) {
    out.homeTeamName = home.name || "";
    out.homeTeamLogo = home.logo || "";
  }

  const away = byId.get(String(data.awayTeam));
  if (away) {
    out.awayTeamName = away.name || "";
    out.awayTeamLogo = away.logo || "";
  } else if (data.awayTeam === null && (data.awayTeamName || "").trim()) {
    // Side switched from a real team to a typed-in opponent: drop the old logo so
    // a stale crest cannot outlive the team it belonged to.
    out.awayTeamLogo = "";
  }

  return out;
}

exports.createMatch = catchAsync(async (req, res, next) => {
  const match = await Match.create(await withTeamSnapshots(req.body));

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
  /* Accepts one status or a comma-separated list ("FT,LIVE"), so the homepage
     can ask for finished matches without also pulling in every future fixture. */
  if (req.query.status) {
    const statuses = String(req.query.status)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
  }

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
    /* A result whose team has since been deleted still carries that team's name. */
    data: resolveMatchesSides(matches),
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
    data: { match: resolveMatchSides(match) },
  });
});

exports.updateMatch = catchAsync(async (req, res, next) => {
  const match = await Match.findById(req.params.id);

  if (!match) {
    return next(new AppError("Match not found.", 404));
  }

  /* Snapshots are refreshed whenever a side is (re)assigned, so a match moved to
     a different team carries the right name. Editing the score alone must not
     rewrite them — the stored snapshot is deliberately kept for a deleted team. */
  const changes = (req.body.homeTeam || req.body.awayTeam)
    ? await withTeamSnapshots(req.body)
    : req.body;

  const updatedMatch = await Match.findByIdAndUpdate(req.params.id, changes, {
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

  /* Statistics edited in the admin arrive as a plain PATCH. Without an event
     the match page kept showing the numbers it was server-rendered with until
     the page cache expired; this lets open viewers update immediately. */
  if (req.body.stats) {
    emitToMatch(req.params.id, "match:statsUpdate", {
      matchId: req.params.id,
      stats: updatedMatch.stats,
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
    ...resolveMatchSides(m),
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
