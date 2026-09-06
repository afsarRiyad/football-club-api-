const Statistic = require("../model/Statistic");
const Player = require("../../players/model/Player");
const Team = require("../../teams/model/Team");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");

/**
 * Guard so a Statistic can never reference a player that doesn't exist (or that
 * belongs to a different club). This is the root protection against the dangling
 * `player` refs left behind when a player is deleted — they surface as null after
 * populate and break stats/lineup pages.
 *
 * Players without a club (unassigned pool players) are allowed.
 */
const assertPlayerReference = async (playerId, clubId) => {
  if (!playerId) return;
  const player = await Player.findById(playerId).select("club").lean();
  if (!player) {
    throw new AppError("Cannot save statistics for a player that does not exist.", 400);
  }
  if (clubId && player.club && player.club.toString() !== String(clubId)) {
    throw new AppError("Player does not belong to the specified club.", 400);
  }
};

/**
 * Same guard for `team` — a statistic can never reference a team that doesn't
 * exist or that belongs to a different club (teams with no club are allowed).
 */
const assertTeamReference = async (teamId, clubId) => {
  if (!teamId) return;
  const team = await Team.findById(teamId).select("club").lean();
  if (!team) {
    throw new AppError("Cannot save statistics for a team that does not exist.", 400);
  }
  if (clubId && team.club && team.club.toString() !== String(clubId)) {
    throw new AppError("Team does not belong to the specified club.", 400);
  }
};

exports.createStatistic = catchAsync(async (req, res, next) => {
  await assertPlayerReference(req.body.player, req.body.club);
  await assertTeamReference(req.body.team, req.body.club);

  const statistic = await Statistic.create(req.body);

  res.status(201).json({
    success: true,
    data: { statistic },
  });
});

exports.getAllStatistics = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.club) filter.club = req.query.club;
  if (req.query.player) filter.player = req.query.player;
  if (req.query.team) filter.team = req.query.team;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.season) filter.season = req.query.season;
  if (req.query.competition) filter.competition = req.query.competition;

  const total = await Statistic.countDocuments(filter);
  const statistics = await Statistic.find(filter)
    .populate("player", "firstName lastName number position photo")
    .populate("team", "name slug")
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
    .populate("player", "firstName lastName number position photo")
    .populate("team", "name slug");

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

  // Guard the effective refs (either being changed or already stored).
  const effectivePlayer = req.body.player !== undefined ? req.body.player : statistic.player;
  await assertPlayerReference(effectivePlayer, statistic.club);
  const effectiveTeam = req.body.team !== undefined ? req.body.team : statistic.team;
  await assertTeamReference(effectiveTeam, statistic.club);

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

// Get top scorers — aggregate GOALS type records per player
exports.getTopScorers = catchAsync(async (req, res, next) => {
  const filter = { type: "GOALS", value: { $gt: 0 } };
  if (req.query.season) filter.season = req.query.season;
  if (req.query.competition) filter.competition = req.query.competition;
  if (req.query.club) filter.club = req.query.club;

  const topScorers = await Statistic.aggregate([
    { $match: filter },
    {
      $group: {
        _id: "$player",
        goals: { $sum: "$value" },
      },
    },
    { $sort: { goals: -1 } },
    { $limit: parseInt(req.query.limit, 10) || 20 },
    {
      $lookup: {
        from: "players",
        localField: "_id",
        foreignField: "_id",
        as: "player",
      },
    },
    { $unwind: "$player" },
    {
      $project: {
        _id: 0,
        player: {
          _id: "$player._id",
          firstName: "$player.firstName",
          lastName: "$player.lastName",
          number: "$player.number",
          position: "$player.position",
          photo: "$player.photo",
        },
        goals: 1,
      },
    },
  ]);

  res.status(200).json({
    success: true,
    results: topScorers.length,
    data: topScorers,
  });
});

// Get team standings — aggregate match results
exports.getTeamStandings = catchAsync(async (req, res, next) => {
  const Match = require("../../matches/model/Match");

  const filter = { status: "FT" };
  if (req.query.season) filter.season = req.query.season;
  if (req.query.competition) filter.competition = req.query.competition;

  const matches = await Match.find(filter)
    .populate("homeTeam", "name slug logo")
    .populate("awayTeam", "name slug logo");

  // Build standings from match results
  const standingsMap = {};

  for (const match of matches) {
    const home = match.homeTeam;
    const away = match.awayTeam;
    if (!home || !away) continue;

    const homeId = home._id.toString();
    const awayId = away._id.toString();

    if (!standingsMap[homeId]) {
      standingsMap[homeId] = {
        team: home,
        played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
      };
    }
    if (!standingsMap[awayId]) {
      standingsMap[awayId] = {
        team: away,
        played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
      };
    }

    const homeStats = standingsMap[homeId];
    const awayStats = standingsMap[awayId];

    homeStats.played++;
    awayStats.played++;
    homeStats.goalsFor += match.homeScore;
    homeStats.goalsAgainst += match.awayScore;
    awayStats.goalsFor += match.awayScore;
    awayStats.goalsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      homeStats.won++;
      homeStats.points += 3;
      awayStats.lost++;
    } else if (match.homeScore < match.awayScore) {
      awayStats.won++;
      awayStats.points += 3;
      homeStats.lost++;
    } else {
      homeStats.drawn++;
      awayStats.drawn++;
      homeStats.points += 1;
      awayStats.points += 1;
    }
  }

  const standings = Object.values(standingsMap)
    .map((s) => ({
      ...s,
      goalDifference: s.goalsFor - s.goalsAgainst,
    }))
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);

  res.status(200).json({
    success: true,
    results: standings.length,
    data: standings,
  });
});
