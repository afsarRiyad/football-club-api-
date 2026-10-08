

/* Zero-width / bidi / soft-hyphen characters: invisible to a human, fatal to a
   `/https?:\/\//` test when they are sprinkled through the scheme. */
const INVISIBLE_CHARS = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

/* C0/C1 controls — newlines are handled separately because the message field
   legitimately contains them. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const HTML_TAG = /<\/?[a-zA-Z][^>]*>/;

/* `//host`, `http://`, `https://`, `mailto:` … A lone `/` (as in "and/or" or a
   written date) is intentionally *not* matched. */
const URL_SCHEME =
  /(?:[a-z][a-z0-9+.-]{1,20}:)?\/\/|(?:https?|ftps?|mailto|tel|sms|data|javascript|file|intent|blob|ws|wss|tg|whatsapp|viber|view-source):/i;

const WWW_PREFIX = /\bwww\./i;

/* A bare domain with a common TLD and no scheme: "bit.ly/x", "evil.com".
   Documentation-style suffixes and dotted initials ("F. C.", "M. A. Rahman")
   do not match because the dot must be followed by a known TLD. */
const BARE_DOMAIN =
  /\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:com|net|org|edu|gov|mil|int|info|biz|io|co|in|bd|uk|us|eu|de|fr|nl|ru|cn|pk|sa|ae|my|sg|au|ca|jp|kr|id|tr|ir|np|lk|xyz|top|club|site|online|shop|store|app|dev|live|link|me|tv|cc|tk|ml|ga|cf|gq|icu|work|space|website|fun|buzz|pro|tech|press|news|page|zone|cloud|host|info|ly|to|gg|cx|st|ws|su|ph|th|vn|eg|ng|ke|za)\b/i;

const EMAIL_LIKE = /@/;

/** Sufficient for names like "Md. Ibrahim (U-19)" — letters any script
 *  (English + Bengali), combining marks, digits, spaces and light punctuation. */
const NAME_CHARSET = /^[\p{L}\p{M}\p{N} .,'’()&-]+$/u;

/** Team names additionally allow "&", "/" and "+" ("Abahani / Krira Chakra"). */
const TEAM_CHARSET = /^[\p{L}\p{M}\p{N} .,'’()&/+!-]+$/u;

/** A venue: "Bhuiyarhat Chowrasta Ground 2, Kabirhat". */
const VENUE_CHARSET = /^[\p{L}\p{M}\p{N} .,'’()&/+:-]+$/u;

/** View used for DETECTION only — never for storage. */
function securityView(value) {
  return String(value)
    .normalize("NFKC")
    .replace(INVISIBLE_CHARS, "")
    .replace(CONTROL_CHARS, "");
}

/** Value actually stored for single-line fields. */
function sanitizePlainText(value) {
  return String(value)
    .replace(INVISIBLE_CHARS, "")
    .replace(CONTROL_CHARS, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same, but keeps line breaks (at most two in a row) for the message field. */
function sanitizeMultiline(value) {
  return String(value)
    .replace(INVISIBLE_CHARS, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * @returns {string|null} a message *fragment* describing why the text is not a
 * plain name/team/venue, or null when it is clean.
 */
function plainTextViolation(value) {
  const view = securityView(value);
  if (view.trim() === "") return null;
  if (HTML_TAG.test(view)) return "must not contain HTML";
  if (URL_SCHEME.test(view) || WWW_PREFIX.test(view) || BARE_DOMAIN.test(view)) {
    return "must not contain a link or URL";
  }
  if (EMAIL_LIKE.test(view)) return "must not contain an email address";
  return null;
}

/** Markup-only check, for free-text fields where a link is legitimate. */
function markupViolation(value) {
  return HTML_TAG.test(securityView(value)) ? "must not contain HTML" : null;
}

/** Escapes regex metacharacters so a query value can never become a pattern. */
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  NAME_CHARSET,
  TEAM_CHARSET,
  VENUE_CHARSET,
  securityView,
  sanitizePlainText,
  sanitizeMultiline,
  plainTextViolation,
  markupViolation,
  escapeRegex,
};
