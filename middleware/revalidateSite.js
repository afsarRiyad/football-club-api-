/**
 * On-demand revalidation of the public site.
 *
 * WHY
 * ---
 * The public pages are statically rendered and regenerated on a timer
 * (CONTENT_REVALIDATE = 60s in the frontend). That keeps them fast and crawlable,
 * but it also means an article written at 16:27 can be invisible until 17:27 —
 * which reads as "my content is not showing" rather than "that's the cache".
 *
 * The API is the single place every write passes through, so it is the right
 * place to tell the site "your data changed". After any successful write this
 * posts to the frontend's /api/revalidate route, which purges its route cache and
 * data cache. The 60s window stays as the safety net for anything that misses.
 *
 * SAFE BY DEFAULT
 * ---------------
 * If PUBLIC_SITE_URL or REVALIDATE_SECRET is missing, this does nothing at all —
 * every write still works and the site falls back to its timer. It never throws,
 * never blocks a response, and coalesces bursts (a live match fires many PATCHes
 * per minute) into at most one ping per REVALIDATE_DEBOUNCE_MS.
 *
 * CONFIGURATION
 *   PUBLIC_SITE_URL     https://www.nayadiganta.club   (no trailing slash)
 *   REVALIDATE_SECRET   shared with the frontend's REVALIDATE_SECRET
 *   REVALIDATE_DEBOUNCE_MS  optional, default 1500
 */

const DEFAULT_DEBOUNCE_MS = 1500;
const REQUEST_TIMEOUT_MS = 3000;
const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

let warnedDisabled = false;
let lastFailureLoggedAt = 0;

let debounceTimer = null;
let inFlight = false;
let dirty = false;
let lastReason = "";

/** Read config at call time so tests (and dotenv) do not depend on load order. */
const config = () => {
  const site = String(process.env.PUBLIC_SITE_URL || "")
    .split(",")[0]
    .trim()
    .replace(/\/+$/, ""); // CORS-style list; the first entry wins
  const secret = process.env.REVALIDATE_SECRET || "";
  const debounceMs = Number(process.env.REVALIDATE_DEBOUNCE_MS);
  return {
    site,
    secret,
    debounceMs: Number.isFinite(debounceMs) && debounceMs >= 0 ? debounceMs : DEFAULT_DEBOUNCE_MS,
    enabled: Boolean(site && secret),
  };
};

const warnDisabled = () => {
  if (warnedDisabled) return;
  warnedDisabled = true;
  console.log(
    "ℹ️  On-demand revalidation is off (set PUBLIC_SITE_URL + REVALIDATE_SECRET to enable). " +
      "Public pages will refresh on their own timer instead."
  );
};

/** Send one revalidation request. Never throws, never keeps the process alive. */
const ping = async (reason) => {
  const { site, secret } = config();

  try {
    const res = await fetch(`${site}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-secret": secret,
      },
      body: JSON.stringify({ reason }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      // A 501 means the frontend has no secret configured — a deploy that is not
      // finished yet is not worth a log line per write, so it is reported once.
      const now = Date.now();
      if (now - lastFailureLoggedAt > 60000) {
        lastFailureLoggedAt = now;
        console.warn(`⚠️  Revalidation ping rejected by ${site} (HTTP ${res.status}) for ${reason}`);
      }
    }
  } catch (error) {
    const now = Date.now();
    if (now - lastFailureLoggedAt > 60000) {
      lastFailureLoggedAt = now;
      console.warn(`⚠️  Revalidation ping to ${site} failed: ${error.message}`);
    }
  }
};

const runPing = async () => {
  debounceTimer = null;
  if (inFlight) return;

  dirty = false;
  inFlight = true;
  try {
    await ping(lastReason);
  } finally {
    inFlight = false;
    // A write arrived while this ping was in flight, so the site is stale again.
    if (dirty) schedule(lastReason);
  }
};

function schedule(reason) {
  const { enabled, debounceMs } = config();
  if (!enabled) {
    warnDisabled();
    return;
  }

  lastReason = reason;
  dirty = true;
  if (debounceTimer || inFlight) return; // coalesce with what is already queued

  debounceTimer = setTimeout(runPing, debounceMs);
  /* Never hold the process open for a ping. */
  if (typeof debounceTimer.unref === "function") debounceTimer.unref();
}

/**
 * Express middleware — mount before the routes.
 * A successful write schedules a revalidation; reads are ignored.
 */
const revalidateSite = (req, res, next) => {
  if (!WRITE_METHODS.includes(req.method)) return next();
  // Login/logout/register change nothing the public site renders.
  if (req.originalUrl.startsWith("/api/auth")) return next();

  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      schedule(`${req.method} ${req.originalUrl}`);
    }
  });

  next();
};

module.exports = revalidateSite;
module.exports.revalidateSite = revalidateSite;
/* Exposed for tests: reset the coalescing state between cases. */
module.exports.__reset = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
  inFlight = false;
  dirty = false;
  lastReason = "";
  warnedDisabled = false;
  lastFailureLoggedAt = 0;
};
