const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const User = require("../modules/auth/model/User");

const protect = async (req, res, next) => {
  try {
    // 1. Get token from cookie or Authorization header
    let token;
    if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.jwt) {
      // Legacy support for old jwt cookie
      token = req.cookies.jwt;
    }

    if (!token) {
      return next(
        new AppError("You are not logged in. Please log in to get access.", 401)
      );
    }

    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(
        new AppError("The user belonging to this token no longer exists.", 401)
      );
    }

    // 4. Check if user is active
    if (!user.isActive) {
      return next(
        new AppError("This user account has been deactivated.", 401)
      );
    }

    // 5. Attach user to req
    req.user = user;
    next();
  } catch (error) {
    return next(new AppError("Invalid or expired token. Please log in again.", 401));
  }
};

/*  Same token handling as `protect`, but never rejects: a missing, malformed or
    expired token just leaves `req.user` unset and the request continues as an
    anonymous one.

    This exists because a public GET can legitimately widen its result set for a
    signed-in admin — the news list is the case that matters. `GET /news` is
    mounted before `protect`, so `req.user` was ALWAYS undefined there and the
    `isAdmin` branch in getAllNews could never run: drafts were hidden from the
    admin UI too, making a freshly created (unpublished) article look like it had
    never saved. */
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user && user.isActive !== false) {
      req.user = user;
    }
  } catch {
    /* Treat an invalid token as anonymous rather than blocking a public read. */
  }

  return next();
};

module.exports = { protect, optionalAuth };
