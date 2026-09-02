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
