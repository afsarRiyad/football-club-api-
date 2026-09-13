/**
 * Readable home/away sides for a match, even after the team behind one is gone.
 *
 * `populate` returns null for a reference whose Team has been deleted, which used
 * to surface as "TBD" on a result that was actually played — the score was there
 * but the team's name had evaporated. Every match therefore keeps a name/logo
 * snapshot for each side, and this fills the populated slot back in from it.
 *
 * Two deliberate limits:
 *  - The live Team always wins, so renaming a team still shows through everywhere.
 *  - Only a side that actually *references* a Team is touched. A fixture against a
 *    typed-in opponent has no team reference at all, and is left alone so existing
 *    "is there a real opponent here?" checks keep behaving exactly as before.
 *
 * Callers keep reading `match.homeTeam.name`; the snapshot is presented in the same
 * shape ({ _id, name, logo }) so no consumer needs to know the difference.
 */

const SIDES = [
  { side: "homeTeam", name: "homeTeamName", logo: "homeTeamLogo", display: "homeTeamDisplayName" },
  { side: "awayTeam", name: "awayTeamName", logo: "awayTeamLogo", display: "awayTeamDisplayName" },
];

/**
 * @param {import("mongoose").Document|object} match - a match document (or plain object)
 * @returns {object} a plain object with both sides always readable
 */
function resolveMatchSides(match) {
  if (!match) return match;

  const plain = typeof match.toObject === "function"
    ? match.toObject({ virtuals: true })
    : { ...match };

  for (const { side, name, logo, display } of SIDES) {
    const live = plain[side];
    if (live && typeof live === "object" && live.name) continue;

    // The id the match was originally populated from. Absent when the side was
    // never a team reference, which is the case this helper must not touch.
    const rawId = typeof match.populated === "function" ? match.populated(side) : undefined;
    if (!rawId) continue;

    const snapshot = plain[name];
    if (!snapshot) continue;

    plain[side] = { _id: rawId, name: snapshot, logo: plain[logo] || "" };
    plain[display] = snapshot;
  }

  return plain;
}

/** Same, for an array of matches. */
function resolveMatchesSides(matches) {
  return (matches || []).map(resolveMatchSides);
}

module.exports = { resolveMatchSides, resolveMatchesSides };
