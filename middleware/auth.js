const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");

const protect = async (req, res, next) => {
  try {
    // 1. Get token from cookie or Authorization header
    let token;
    if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(
        new AppError("You are not logged in. Please log in to get access.", 401)
      );
    }

    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Attach user to req (user lookup will be added when User model exists)
    req.user = decoded;
    next();
  } catch (error) {
    return next(new AppError("Invalid or expired token. Please log in again.", 401));
  }
};

module.exports = { protect };
