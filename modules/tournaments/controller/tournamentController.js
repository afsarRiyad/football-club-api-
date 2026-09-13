const mongoose = require("mongoose");
const Tournament = require("../model/Tournament");
const AppError = require("../../../utils/AppError");
const catchAsync = require("../../../utils/catchAsync");

// ─── Helpers ────────────────────────────────────────────────────────

/** Canonical knockout order, group stage excluded (it is not a knockout round). */
const KNOCKOUT_ROUND_ORDER = [
  "ROUND_OF_32",
  "ROUND_OF_16",
  "QUARTER_FINAL",
  "SEMI_FINAL",
  "FINAL",
];

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

/* ─── Bracket entries ───
   A slot in the draw is either one of the club's Team documents or a name typed
   in by hand (a guest side that has no Team record). Both carry a name + logo
   snapshot, which is also what keeps a played match readable after its team is
   removed from the tournament. */
function bracketEntries(tournament) {
  const real = (tournament.teams || [])
    .filter(Boolean)
    .map((team) => ({ id: team._id || team, name: team.name || "", logo: team.logo || "" }));

  const manual = (tournament.manualTeams || [])
    .filter((name) => typeof name === "string" && name.trim())
    .map((name) => ({ id: null, name: name.trim(), logo: "" }));

  return [...real, ...manual];
}

/** A slot array includes a null entry when the field is padded with byes. */
const hasEntry = (entry) => Boolean(entry && (entry.id || entry.name));

/** Spread one entry onto a match under the given side (home/away). */
function slotFields(entry, side) {
  const e = hasEntry(entry) ? entry : null;
  return {
    [`${side}Team`]: e?.id || null,
    [`${side}TeamName`]: e?.name || "",
    [`${side}TeamLogo`]: e?.logo || "",
  };
}

/** Read a match slot back as an entry, so a winner can be promoted. */
function entryOf(match, side) {
  return {
    id: match[`${side}Team`] || null,
    name: match[`${side}TeamName`] || "",
    logo: match[`${side}TeamLogo`] || "",
  };
}

/** A value stored in tournament.groups: a bracket entry, or a bare team id (older documents). */
function entryFromGroupValue(value) {
  if (value && typeof value === "object") {
    return { id: value.id || value._id || null, name: value.name || "", logo: value.logo || "" };
  }
  return { id: value || null, name: "", logo: "" };
}

/** Identity of an entry: the team id when there is one, otherwise its name. */
const keyOf = (entry) => String((entry && (entry.id || entry.name)) || "");

/**
 * Generate a single-elimination bracket
 * @param {object[]} entries - Bracket entries, padded to a power of 2
 * @param {Date} startDate - First match date
 * @param {string} venue - Default venue
 * @param {number} matchIntervalDays - Days between rounds
 * @returns {object[]} Array of match objects ready to insert
 */
function generateBracket(entries, startDate, venue, matchIntervalDays = 7) {
  const teamCount = entries.length;
  const rounds = getRoundOrder(teamCount);
  const totalRounds = rounds.length;
  const matches = [];

  // Shuffle entries for random seeding
  const shuffled = [...entries].sort(() => Math.random() - 0.5);

  // Round 1: seed the draw
  for (let i = 0; i < teamCount; i += 2) {
    const matchDate = new Date(startDate);
    matchDate.setDate(matchDate.getDate() + Math.floor(i / 2) * 1); // Stagger by 1 day
    const home = shuffled[i];
    const away = shuffled[i + 1];

    matches.push({
      round: rounds[0],
      position: i / 2,
      ...slotFields(home, "home"),
      ...slotFields(away, "away"),
      matchDate,
      venue: venue || "",
      status: hasEntry(home) && hasEntry(away) ? "SCHEDULED" : "BYE",
    });
  }

  /* Subsequent rounds: empty slots waiting for winners.
     A round r match count is teamCount / 2^(r+1) — the extra `+ 1` was missing,
     so round 1 of a 4-team bracket created 2 semi-finals AND a 4-team bracket
     produced two finals. */
  for (let r = 1; r < totalRounds; r++) {
    const prevRoundMatchCount = teamCount / Math.pow(2, r + 1);
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

  /* Every match needs its real _id BEFORE the linking below, which reads
     `nextMatch._id`. These are still plain objects here — Mongoose only assigns
     an _id when the array is cast onto the document, which happens after this
     function returns — so without this `nextMatchId` was silently undefined and
     no winner could ever advance. */
  matches.forEach((match) => {
    match._id = new mongoose.Types.ObjectId();
  });

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
function generateGroupStage(entries, startDate, venue, matchIntervalDays = 7, numGroups = null) {
  const teamCount = entries.length;
  const shuffled = [...entries].sort(() => Math.random() - 0.5);

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
    // Round-robin: each side plays every other side once
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
          ...slotFields(groupTeams[i], "home"),
          ...slotFields(groupTeams[j], "away"),
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

  // Subsequent knockout rounds — same 2^(r+1) count as the single-knockout path.
  for (let r = 1; r < knockoutRounds.length; r++) {
    const prevCount = knockoutTeams / Math.pow(2, r + 1);
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

  /* Real _ids before linking — see the note in generateBracket(). */
  knockoutMatches.forEach((match) => {
    match._id = new mongoose.Types.ObjectId();
  });

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

  const side =
    completedMatch.winner === "HOME" ? "home" : completedMatch.winner === "AWAY" ? "away" : null;
  if (!side) return;

  /* Promote the whole entry — id plus the name/logo snapshot. Passing only the
     ObjectId left a typed-in side (no Team document) or a team removed from the
     tournament with nothing to show in the next round. */
  const winnerEntry = entryOf(completedMatch, side);
  if (!hasEntry(winnerEntry)) return;

  Object.assign(nextMatch, slotFields(winnerEntry, completedMatch.nextMatchPosition === 0 ? "home" : "away"));

  // If both sides are now known, the match can be played.
  const bothReady =
    (nextMatch.homeTeam || nextMatch.homeTeamName) && (nextMatch.awayTeam || nextMatch.awayTeamName);
  if (bothReady) {
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
  /* Teams are populated because the bracket snapshots their name and logo. */
  const tournament = await Tournament.findById(req.params.id).populate("teams", "name logo");

  if (!tournament) {
    return next(new AppError("Tournament not found.", 404));
  }

  /* Real teams + hand-typed sides, in one list of entries. */
  const entries = bracketEntries(tournament);

  if (entries.length < 2) {
    return next(new AppError("At least 2 teams are required to generate a bracket.", 400));
  }

  const startDate = req.body.startDate
    ? new Date(req.body.startDate)
    : tournament.startDate || new Date();
  const venue = req.body.venue || tournament.venue || "";
  const matchIntervalDays = req.body.matchIntervalDays || tournament.matchIntervalDays || 7;

  // Check if format is GROUP_AND_KNOCKOUT
  if (tournament.format === "GROUP_AND_KNOCKOUT" || req.body.format === "GROUP_AND_KNOCKOUT") {
    const numGroups = req.body.numGroups || Math.ceil(entries.length / 4);
    const result = generateGroupStage(
      entries,
      startDate,
      venue,
      matchIntervalDays,
      numGroups
    );
    tournament.matches = result.matches;
    tournament.groups = result.groups;
    tournament.currentRound = "GROUP_STAGE";
  } else {
    /* Single knockout: pad with byes to the next power of two. The padding goes
       on a COPY — the old code pushed nulls straight into tournament.teams, which
       left the roster with empty entries pinned to the document. */
    let teamCount = entries.length;
    if (teamCount & (teamCount - 1)) {
      let nextPow = 1;
      while (nextPow < teamCount) nextPow *= 2;
      teamCount = nextPow;
    }
    while (entries.length < teamCount) entries.push(null);

    tournament.teamCount = teamCount;

    tournament.matches = generateBracket(entries, startDate, venue, matchIntervalDays);
  }

  // Handle BYE matches: auto-advance a side with no opponent
  for (const match of tournament.matches) {
    const home = match.homeTeam || match.homeTeamName;
    const away = match.awayTeam || match.awayTeamName;

    if (home && !away) {
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

  /* Either a real team (teamId) or a name typed in by hand (name) — a guest
     side that only exists for this tournament, exactly like a one-off opponent
     on a match. A typed name never creates a Team document. */
  const { teamId, name } = req.body;

  if (!teamId && !(typeof name === "string" && name.trim())) {
    return next(new AppError("Provide a team, or a name to add as a guest side.", 400));
  }

  if (teamId) {
    if (tournament.teams.some((t) => t && t.toString() === teamId.toString())) {
      return next(new AppError("Team is already in this tournament.", 400));
    }
    tournament.teams.push(teamId);
  } else {
    const trimmed = name.trim();
    if (tournament.manualTeams.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      return next(new AppError("A side with that name is already in this tournament.", 400));
    }
    tournament.manualTeams.push(trimmed);
  }

  await tournament.save();

  res.status(200).json({ success: true, data: { tournament } });
});

exports.removeTeam = catchAsync(async (req, res, next) => {
  const tournament = await Tournament.findById(req.params.id);

  if (!tournament) {
    return next(new AppError("Tournament not found.", 404));
  }

  /* A hand-typed side is removed by its name (the route param is the identifier
     the admin has for both kinds of entry). */
  const manualIndex = (tournament.manualTeams || []).findIndex((n) => n === req.params.teamId);
  if (manualIndex !== -1) {
    tournament.manualTeams.splice(manualIndex, 1);
    await tournament.save();
    return res.status(200).json({ success: true, data: { tournament } });
  }

  const removingTeam = tournament.teams.find((t) => t && t.toString() === req.params.teamId);
  if (!removingTeam) {
    return next(new AppError("That team is not in this tournament.", 404));
  }

  /* Removing a side is allowed while the tournament is being set up, or once
     every match it played is finished.

     It is deliberately NOT allowed while one of its matches is still to be
     played: the fixture list would end up with a slot nobody can fill. And it
     never erases history — each match carries its own name/logo snapshot, so a
     result keeps showing the name it was played under even after the team is
     gone from the roster. */
  const settled = ["DRAFT", "REGISTRATION"].includes(tournament.status);
  const hasUnplayed = tournament.matches.some(
    (m) =>
      (m.homeTeam?.toString() === req.params.teamId || m.awayTeam?.toString() === req.params.teamId) &&
      !["COMPLETED", "BYE"].includes(m.status)
  );

  if (!settled && hasUnplayed) {
    return next(
      new AppError(
        "This team still has matches to play in this tournament. Finish or cancel them before removing it.",
        400
      )
    );
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

  /* Goal scorers and assists are entered in the same dialog as the score, so the
     whole result arrives in one request. Omitting `events` leaves what is stored
     alone; sending an empty array clears it. */
  if (Array.isArray(req.body.events)) {
    match.events = req.body.events.map((event) => ({
      type: event.type,
      minute: event.minute,
      side: event.side === "AWAY" ? "AWAY" : "HOME",
      player: event.player || undefined,
      assist: event.assist || undefined,
      playerName: (event.playerName || "").trim(),
      assistName: (event.assistName || "").trim(),
      description: (event.description || "").trim(),
    }));
  }

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
      /* Calculate group standings and pick qualifiers.

         A row is keyed by the team id when the side is a real Team document and
         by its name otherwise, so a group containing hand-typed sides still
         ranks — and a team removed from the roster keeps its row, because the
         key falls back to the snapshot name on the match. */
      const standings = {};
      for (const [label, groupValues] of Object.entries(tournament.groups)) {
        standings[label] = {};
        for (const value of groupValues || []) {
          const entry = entryFromGroupValue(value);
          const key = keyOf(entry);
          if (!key) continue;
          standings[label][key] = { entry, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
        }
      }

      for (const gm of groupMatches) {
        if (gm.status !== "COMPLETED") continue;
        const group = gm.group;
        if (!group || !standings[group]) continue;
        const hid = keyOf(entryOf(gm, "home"));
        const aid = keyOf(entryOf(gm, "away"));
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

      /* Top 2 of each group, kept in separate lists so a group winner is drawn
         against another group's runner-up — two teams that already met in the
         group cannot be paired again in the first knockout round. */
      const winners = [];
      const runnersUp = [];
      for (const label of Object.keys(standings).sort()) {
        const sorted = Object.values(standings[label])
          .map(s => ({ ...s, gd: s.gf - s.ga }))
          .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
        if (sorted[0]?.entry) winners.push(sorted[0].entry);
        if (sorted[1]?.entry) runnersUp.push(sorted[1].entry);
      }
      const pairs = winners.map((winner, i) => [
        winner,
        runnersUp.length > 0 ? runnersUp[(i + 1) % runnersUp.length] : null,
      ]);

      /* Only the FIRST knockout round is seeded here. Taking every PENDING
         knockout match and sorting by position mixed the rounds together — a
         semi-final, the final and quarter-final #1 all share position 0 — so
         qualifiers used to be written into the wrong slots. */
      const knockoutMatches = tournament.matches.filter(m => m.round !== "GROUP_STAGE");
      const roundNames = [...new Set(knockoutMatches.map(m => m.round))].sort(
        (a, b) => KNOCKOUT_ROUND_ORDER.indexOf(a) - KNOCKOUT_ROUND_ORDER.indexOf(b)
      );
      const firstRoundName = roundNames[0];
      const firstKnockoutRound = knockoutMatches
        .filter(m => m.round === firstRoundName)
        .sort((a, b) => a.position - b.position);

      pairs.slice(0, firstKnockoutRound.length).forEach(([home, away], i) => {
        Object.assign(
          firstKnockoutRound[i],
          slotFields(home, "home"),
          slotFields(away, "away")
        );
        firstKnockoutRound[i].status = hasEntry(home) && hasEntry(away) ? "SCHEDULED" : "PENDING";
      });

      tournament.currentRound = firstRoundName || "QUARTER_FINAL";
    }
  }

  // Check if tournament is complete
  const finalMatch = tournament.matches.find((m) => m.round === "FINAL");
  if (finalMatch && finalMatch.status === "COMPLETED") {
    tournament.status = "COMPLETED";
    const champion = entryOf(finalMatch, finalMatch.winner === "AWAY" ? "away" : "home");
    tournament.champion = champion.id || undefined;
    tournament.championName = champion.name || "";
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

exports.updateTournamentMatch = catchAsync(async (req, res, next) => {
  const tournament = await Tournament.findById(req.params.id);

  if (!tournament) {
    return next(new AppError("Tournament not found.", 404));
  }

  const match = tournament.matches.id(req.params.matchId);
  if (!match) {
    return next(new AppError("Match not found in this tournament.", 404));
  }

  // Whitelist updatable fields — never pass raw req.body to the subdoc
  const allowed = ["matchDate", "venue", "status"];
  for (const key of allowed) {
    if (req.body[key] !== undefined) match[key] = req.body[key];
  }

  await tournament.save();

  res.status(200).json({ success: true, data: { tournament } });
});

exports.getBracket = catchAsync(async (req, res, next) => {
  const tournament = await Tournament.findById(req.params.id)
    .populate("matches.homeTeam", "name slug logo")
    .populate("matches.awayTeam", "name slug logo")
    /* `teams` and `club` are populated so this payload is a SUPERSET of
       GET /tournaments/:id. The admin bracket page fetches both and keeps the
       last one to land; when this response omitted `teams`, it wiped the roster
       off the tournament and the page threw on `tournament.teams.length`.
       Anything a sibling endpoint returns must be included here. */
    .populate("teams", "name slug logo")
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
        slug: tournament.slug,
        format: tournament.format,
        teamCount: tournament.teamCount,
        status: tournament.status,
        currentRound: tournament.currentRound,
        champion: tournament.champion,
        teams: tournament.teams || [],
        manualTeams: tournament.manualTeams || [],
        championName: tournament.championName || "",
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        venue: tournament.venue,
        description: tournament.description,
        matchIntervalDays: tournament.matchIntervalDays,
        groups: tournament.groups || {},
      },
      bracket,
    },
  });
});
