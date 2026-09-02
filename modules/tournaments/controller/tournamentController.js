const mongoose = require("mongoose");
const Tournament = require("../model/Tournament");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Get round order from first to last
 */
function getRoundOrder(teamCount) {
  const rounds = [];
  if (teamCount > 16) rounds.push("ROUND_OF_32");
  if (teamCount > 8) rounds.push("ROUND_OF_16");
  if (teamCount > 4) rounds.push("QUARTER_FINAL");
  if (teamCount > 2) rounds.push("SEMI_FINAL");
  rounds.push("FINAL");
  return rounds;
}

/**
 * Generate a single-elimination bracket
 * @param {string[]} teamIds - Array of team ObjectIds (must be power of 2)
 * @param {Date} startDate - First match date
 * @param {string} venue - Default venue
 * @param {number} matchIntervalDays - Days between rounds
 * @returns {object[]} Array of match objects ready to insert
 */
function generateBracket(teamIds, startDate, venue, matchIntervalDays = 7) {
  const teamCount = teamIds.length;
  const rounds = getRoundOrder(teamCount);
  const totalRounds = rounds.length;
  const matches = [];

  // Shuffle teams for random seeding
  const shuffled = [...teamIds].sort(() => Math.random() - 0.5);

  // Round 1: seed teams
  let currentRoundMatches = [];
  for (let i = 0; i < teamCount; i += 2) {
    const matchDate = new Date(startDate);
    matchDate.setDate(matchDate.getDate() + Math.floor(i / 2) * 1); // Stagger by 1 day

    currentRoundMatches.push({
      round: rounds[0],
      position: i / 2,
      homeTeam: shuffled[i],
      awayTeam: shuffled[i + 1] || null,
      matchDate,
      venue: venue || "",
      status: shuffled[i + 1] ? "SCHEDULED" : "BYE",
    });
  }

  matches.push(...currentRoundMatches);

  // Subsequent rounds: empty slots waiting for winners
  for (let r = 1; r < totalRounds; r++) {
    const prevRoundMatchCount = teamCount / Math.pow(2, r);
    for (let i = 0; i < prevRoundMatchCount; i++) {
      const matchDate = new Date(startDate);
      matchDate.setDate(matchDate.getDate() + (r * matchIntervalDays));

      matches.push({
        round: rounds[r],
        position: i,
        homeTeam: null,
        awayTeam: null,
        matchDate,
        venue: venue || "",
        status: "PENDING",
      });
    }
  }

  // Link matches: each round r match feeds into round r+1
  for (let r = 0; r < totalRounds - 1; r++) {
    const roundMatches = matches.filter((m) => m.round === rounds[r]);
    const nextRoundMatches = matches.filter((m) => m.round === rounds[r + 1]);

    roundMatches.forEach((match, i) => {
      const nextMatch = nextRoundMatches[Math.floor(i / 2)];
      if (nextMatch) {
        match.nextMatchId = nextMatch._id;
        match.nextMatchPosition = i % 2; // 0 = home slot, 1 = away slot
      }
    });
  }

  return matches;
}

/**
 * Generate group stage matches (round-robin within each group)
 * Then generate knockout bracket from group qualifiers
 */
function generateGroupStage(teamIds, startDate, venue, matchIntervalDays = 7, numGroups = null) {
  const teamCount = teamIds.length;
  const shuffled = [...teamIds].sort(() => Math.random() - 0.5);

  // Determine number of groups (default: 4 teams per group)
  if (!numGroups) {
    numGroups = Math.ceil(teamCount / 4);
  }
  const teamsPerGroup = Math.ceil(teamCount / numGroups);

  // Create groups
  const groupLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const groups = {};
  for (let i = 0; i < numGroups; i++) {
    groups[groupLabels[i]] = [];
  }
  // Distribute teams into groups (snake draft)
  for (let i = 0; i < shuffled.length; i++) {
    const groupIdx = i % numGroups;
    groups[groupLabels[groupIdx]].push(shuffled[i]);
  }

  const matches = [];
  let positionCounter = 0;
  let matchDay = 0;

  // For each group, generate round-robin matches
  for (const [groupLabel, groupTeams] of Object.entries(groups)) {
    // Round-robin: each team plays every other team once
    for (let i = 0; i < groupTeams.length; i++) {
      for (let j = i + 1; j < groupTeams.length; j++) {
        const matchDate = new Date(startDate);
        matchDate.setDate(matchDate.getDate() + matchDay);
        // Stagger matches across days
        const matchdayOffset = Math.floor(positionCounter / numGroups) * matchIntervalDays;
        matchDate.setDate(matchDate.getDate() + matchdayOffset);

        matches.push({
          round: "GROUP_STAGE",
          position: positionCounter++,
          homeTeam: groupTeams[i],
          awayTeam: groupTeams[j],
          matchDate,
          venue: venue || "",
          status: "SCHEDULED",
          group: groupLabel,
        });
      }
    }
  }

  // Calculate how many advance from groups (top 2 from each group)
  const qualifiersPerGroup = 2;
  const totalQualifiers = numGroups * qualifiersPerGroup;

  // Ensure totalQualifiers is power of 2 for knockout
  let knockoutTeams = totalQualifiers;
  if (knockoutTeams & (knockoutTeams - 1)) {
    // Not power of 2, round down to nearest power of 2
    let pow = 1;
    while (pow * 2 <= knockoutTeams) pow *= 2;
    knockoutTeams = pow;
  }

  // Generate knockout bracket (starts after group stage)
  const groupMatchCount = matches.length;
  const knockoutStartDate = new Date(startDate);
  knockoutStartDate.setDate(knockoutStartDate.getDate() + groupMatchCount * matchIntervalDays);

  const knockoutRounds = getRoundOrder(knockoutTeams);
  const knockoutMatches = [];

  // First knockout round: empty slots (filled when group stage ends)
  for (let i = 0; i < knockoutTeams / 2; i++) {
    const matchDate = new Date(knockoutStartDate);
    knockoutMatches.push({
      round: knockoutRounds[0],
      position: i,
      homeTeam: null,
      awayTeam: null,
      matchDate,
      venue: venue || "",
      status: "PENDING",
    });
  }

  // Subsequent knockout rounds
  for (let r = 1; r < knockoutRounds.length; r++) {
    const prevCount = knockoutTeams / Math.pow(2, r);
    for (let i = 0; i < prevCount; i++) {
      const matchDate = new Date(knockoutStartDate);
      matchDate.setDate(matchDate.getDate() + r * matchIntervalDays);
      knockoutMatches.push({
        round: knockoutRounds[r],
        position: i,
        homeTeam: null,
        awayTeam: null,
        matchDate,
        venue: venue || "",
        status: "PENDING",
      });
    }
  }

  // Link knockout matches
  for (let r = 0; r < knockoutRounds.length - 1; r++) {
    const roundMatches = knockoutMatches.filter(m => m.round === knockoutRounds[r]);
    const nextRoundMatches = knockoutMatches.filter(m => m.round === knockoutRounds[r + 1]);
    roundMatches.forEach((match, i) => {
      const nextMatch = nextRoundMatches[Math.floor(i / 2)];
      if (nextMatch) {
        match.nextMatchId = nextMatch._id;
        match.nextMatchPosition = i % 2;
      }
    });
  }

  return { matches: [...matches, ...knockoutMatches], groups, knockoutRounds, qualifiersPerGroup };
}

/**
 * Advance winner to next match after a match is completed
 */
async function advanceWinner(tournament, completedMatch) {
  if (!completedMatch.nextMatchId) return; // This was the final

  const nextMatch = tournament.matches.id(completedMatch.nextMatchId);
  if (!nextMatch) return;

  const winnerTeam =
    completedMatch.winner === "HOME"
      ? completedMatch.homeTeam
      : completedMatch.winner === "AWAY"
      ? completedMatch.awayTeam
      : null;

  if (!winnerTeam) return;

  if (completedMatch.nextMatchPosition === 0) {
    nextMatch.homeTeam = winnerTeam;
  } else {
    nextMatch.awayTeam = winnerTeam;
  }

  // If both teams are now set, schedule the match
  if (nextMatch.homeTeam && nextMatch.awayTeam) {
    nextMatch.status = "SCHEDULED";
  }
}

// ─── CRUD ───────────────────────────────────────────────────────────

exports.createTournament = catchAsync(async (req, res, next) => {
  const tournament = await Tournament.create({
    ...req.body,
    club: req.body.club || req.user.club,
  });

  res.status(201).json({ success: true, data: { tournament } });
});

exports.getAllTournaments = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.club) filter.club = req.query.club;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    filter.name = { $regex: req.query.search, $options: "i" };
  }

  const total = await Tournament.countDocuments(filter);
  const tournaments = await Tournament.find(filter)
    .populate("club", "name slug")
    .populate("teams", "name slug logo")
    .populate("champion", "name slug")
    .populate("matches.homeTeam", "name slug logo")
    .populate("matches.awayTeam", "name slug logo")
    .sort("-createdAt")
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    success: true,
    results: tournaments.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    data: tournaments,
  });
});

exports.getTournament = catchAsync(async (req, res, next) => {
  const tournament = await Tournament.findById(req.params.id)
    .populate("club", "name slug logo")
    .populate("teams", "name slug logo")
    .populate("champion", "name slug logo")
    .populate("matches.homeTeam", "name slug logo")
    .populate("matches.awayTeam", "name slug logo");

  // Populate group team references
  if (tournament && tournament.groups) {
    for (const [label, teamIds] of Object.entries(tournament.groups)) {
      tournament.groups[label] = await Promise.all(
        teamIds.map(async (tid) => {
          if (typeof tid === "object" && tid.name) return tid;
          const Team = mongoose.model("Team");
          return Team.findById(tid).select("name slug logo").lean();
        })
      );
    }
  }

  if (!tournament) {
    return next(new AppError("Tournament not found.", 404));
  }

  res.status(200).json({ success: true, data: { tournament } });
});

exports.updateTournament = catchAsync(async (req, res, next) => {
  const tournament = await Tournament.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!tournament) {
    return next(new AppError("Tournament not found.", 404));
  }

  res.status(200).json({ success: true, data: { tournament } });
});

exports.deleteTournament = catchAsync(async (req, res, next) => {
  const tournament = await Tournament.findByIdAndDelete(req.params.id);

  if (!tournament) {
    return next(new AppError("Tournament not found.", 404));
  }

  res.status(200).json({ success: true, message: "Tournament deleted successfully." });
});

// ─── Bracket Operations ─────────────────────────────────────────────

exports.generateBracket = catchAsync(async (req, res, next) => {
  const tournament = await Tournament.findById(req.params.id);

  if (!tournament) {
    return next(new AppError("Tournament not found.", 404));
  }

  if (tournament.teams.length < 2) {
    return next(new AppError("At least 2 teams are required to generate a bracket.", 400));
  }

  const startDate = req.body.startDate
    ? new Date(req.body.startDate)
    : tournament.startDate || new Date();
  const venue = req.body.venue || tournament.venue || "";
  const matchIntervalDays = req.body.matchIntervalDays || tournament.matchIntervalDays || 7;

  // Check if format is GROUP_AND_KNOCKOUT
  if (tournament.format === "GROUP_AND_KNOCKOUT" || req.body.format === "GROUP_AND_KNOCKOUT") {
    const numGroups = req.body.numGroups || Math.ceil(tournament.teams.length / 4);
    const result = generateGroupStage(
      tournament.teams,
      startDate,
      venue,
      matchIntervalDays,
      numGroups
    );
    tournament.matches = result.matches;
    tournament.groups = result.groups;
    tournament.currentRound = "GROUP_STAGE";
  } else {
    // Single knockout: must be power of 2 (or pad to next power of 2)
    let teamCount = tournament.teams.length;
    if (teamCount & (teamCount - 1)) {
      let nextPow = 1;
      while (nextPow < teamCount) nextPow *= 2;
      while (tournament.teams.length < nextPow) {
        tournament.teams.push(null);
      }
      teamCount = nextPow;
    }
    tournament.teamCount = teamCount;

    tournament.matches = generateBracket(
      tournament.teams,
      startDate,
      venue,
      matchIntervalDays
    );
  }

  // Handle BYE matches: auto-advance teams with no opponent
  for (const match of tournament.matches) {
    if (match.awayTeam === null && match.homeTeam !== null) {
      match.status = "BYE";
      match.winner = "HOME";

      // Advance to next match
      await advanceWinner(tournament, match);
    }
  }

  tournament.status = "REGISTRATION";
  tournament.currentRound = tournament.matches[0]?.round;

  await tournament.save();

  res.status(200).json({
    success: true,
    data: { tournament },
  });
});

exports.addTeam = catchAsync(async (req, res, next) => {
  const tournament = await Tournament.findById(req.params.id);

  if (!tournament) {
    return next(new AppError("Tournament not found.", 404));
  }

  if (tournament.status !== "DRAFT" && tournament.status !== "REGISTRATION") {
    return next(new AppError("Cannot add teams after tournament has started.", 400));
  }

  const { teamId } = req.body;
  if (tournament.teams.includes(teamId)) {
    return next(new AppError("Team is already in this tournament.", 400));
  }

  tournament.teams.push(teamId);
  await tournament.save();

  res.status(200).json({ success: true, data: { tournament } });
});

exports.removeTeam = catchAsync(async (req, res, next) => {
  const tournament = await Tournament.findById(req.params.id);

  if (!tournament) {
    return next(new AppError("Tournament not found.", 404));
  }

  if (tournament.status !== "DRAFT" && tournament.status !== "REGISTRATION") {
    return next(new AppError("Cannot remove teams after tournament has started.", 400));
  }

  tournament.teams = tournament.teams.filter(
    (t) => t && t.toString() !== req.params.teamId
  );
  await tournament.save();

  res.status(200).json({ success: true, data: { tournament } });
});

exports.recordMatchResult = catchAsync(async (req, res, next) => {
  const tournament = await Tournament.findById(req.params.id);

  if (!tournament) {
    return next(new AppError("Tournament not found.", 404));
  }

  const match = tournament.matches.id(req.params.matchId);
  if (!match) {
    return next(new AppError("Match not found in this tournament.", 404));
  }

  const { homeScore, awayScore } = req.body;
  match.homeScore = homeScore;
  match.awayScore = awayScore;
  match.status = "COMPLETED";

  // Determine winner (no draws in knockout)
  if (homeScore > awayScore) {
    match.winner = "HOME";
  } else if (awayScore > homeScore) {
    match.winner = "AWAY";
  } else {
    // Draw → use penalties or just pick home for now
    match.winner = "HOME";
  }

  // For group stage: allow draws (winner stays null on draw)
  if (match.round === "GROUP_STAGE") {
    if (homeScore > awayScore) {
      match.winner = "HOME";
    } else if (awayScore > homeScore) {
      match.winner = "AWAY";
    }
    // Draw is valid in group stage — no winner set
  } else {
    // Knockout: no draws
    if (homeScore > awayScore) {
      match.winner = "HOME";
    } else if (awayScore > homeScore) {
      match.winner = "AWAY";
    } else {
      match.winner = "HOME"; // Default to home on draw
    }
  }

  // For knockout rounds, advance winner
  if (match.round !== "GROUP_STAGE") {
    await advanceWinner(tournament, match);
  }

  // Check if all group stage matches are done → seed knockout bracket
  if (tournament.format === "GROUP_AND_KNOCKOUT" && match.round === "GROUP_STAGE") {
    const groupMatches = tournament.matches.filter(m => m.round === "GROUP_STAGE");
    const allGroupDone = groupMatches.every(m => m.status === "COMPLETED");

    if (allGroupDone && tournament.groups) {
      // Calculate group standings and pick qualifiers
      const standings = {};
      for (const [label, teamIds] of Object.entries(tournament.groups)) {
        standings[label] = {};
        for (const tid of teamIds) {
          const key = tid.toString();
          standings[label][key] = { team: tid, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
        }
      }

      for (const gm of groupMatches) {
        if (gm.status !== "COMPLETED") continue;
        const group = gm.group;
        if (!group || !standings[group]) continue;
        const hid = gm.homeTeam?.toString();
        const aid = gm.awayTeam?.toString();
        if (!hid || !aid || !standings[group][hid] || !standings[group][aid]) continue;

        const hs = gm.homeScore ?? 0;
        const as = gm.awayScore ?? 0;
        standings[group][hid].played++;
        standings[group][aid].played++;
        standings[group][hid].gf += hs;
        standings[group][hid].ga += as;
        standings[group][aid].gf += as;
        standings[group][aid].ga += hs;

        if (hs > as) {
          standings[group][hid].won++;
          standings[group][hid].points += 3;
          standings[group][aid].lost++;
        } else if (as > hs) {
          standings[group][aid].won++;
          standings[group][aid].points += 3;
          standings[group][hid].lost++;
        } else {
          standings[group][hid].drawn++;
          standings[group][aid].drawn++;
          standings[group][hid].points += 1;
          standings[group][aid].points += 1;
        }
      }

      // Pick top 2 from each group
      const qualifiers = [];
      for (const [label, groupStandings] of Object.entries(standings)) {
        const sorted = Object.values(groupStandings)
          .map(s => ({ ...s, gd: s.gf - s.ga }))
          .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
        qualifiers.push(sorted[0]?.team);
        if (sorted[1]) qualifiers.push(sorted[1]?.team);
      }

      // Fill knockout bracket first round with qualifiers
      const knockoutMatches = tournament.matches.filter(m => m.round !== "GROUP_STAGE");
      const firstKnockoutRound = knockoutMatches
        .filter(m => m.status === "PENDING")
        .sort((a, b) => a.position - b.position);

      for (let i = 0; i < firstKnockoutRound.length && i * 2 < qualifiers.length; i++) {
        firstKnockoutRound[i].homeTeam = qualifiers[i * 2];
        firstKnockoutRound[i].awayTeam = qualifiers[i * 2 + 1];
        firstKnockoutRound[i].status = "SCHEDULED";
      }

      tournament.currentRound = firstKnockoutRound[0]?.round || "QUARTER_FINAL";
    }
  }

  // Check if tournament is complete
  const finalMatch = tournament.matches.find((m) => m.round === "FINAL");
  if (finalMatch && finalMatch.status === "COMPLETED") {
    tournament.status = "COMPLETED";
    tournament.champion =
      finalMatch.winner === "HOME" ? finalMatch.homeTeam : finalMatch.awayTeam;
  }

  // Update current round
  const pendingMatches = tournament.matches.filter(
    (m) => m.status === "SCHEDULED" || m.status === "LIVE"
  );
  if (pendingMatches.length > 0) {
    tournament.currentRound = pendingMatches[0].round;
  }

  await tournament.save();

  res.status(200).json({ success: true, data: { tournament } });
});

exports.getBracket = catchAsync(async (req, res, next) => {
  const tournament = await Tournament.findById(req.params.id)
    .populate("matches.homeTeam", "name slug logo")
    .populate("matches.awayTeam", "name slug logo")
    .populate("champion", "name slug logo");

  if (!tournament) {
    return next(new AppError("Tournament not found.", 404));
  }

  // Populate group team references
  if (tournament.groups) {
    const Team = mongoose.model("Team");
    for (const [label, teamIds] of Object.entries(tournament.groups)) {
      tournament.groups[label] = await Promise.all(
        teamIds.map(async (tid) => {
          if (typeof tid === "object" && tid.name) return tid;
          return Team.findById(tid).select("name slug logo").lean();
        })
      );
    }
  }

  // Group matches by round
  const bracket = {};
  for (const match of tournament.matches) {
    if (!bracket[match.round]) bracket[match.round] = [];
    bracket[match.round].push(match);
  }

  // Sort each round by position
  Object.keys(bracket).forEach((round) => {
    bracket[round].sort((a, b) => a.position - b.position);
  });

  res.status(200).json({
    success: true,
    data: {
      tournament: {
        _id: tournament._id,
        name: tournament.name,
        format: tournament.format,
        teamCount: tournament.teamCount,
        status: tournament.status,
        currentRound: tournament.currentRound,
        champion: tournament.champion,
        groups: tournament.groups || {},
      },
      bracket,
    },
  });
});
