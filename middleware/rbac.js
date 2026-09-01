const AppError = require("../utils/AppError");

// Role hierarchy for inheritance checks
const ROLE_HIERARCHY = {
  SUPER_ADMIN: ["CLUB_ADMIN", "TEAM_MANAGER", "COACH", "SCORER", "PLAYER", "MEMBER"],
  CLUB_ADMIN: ["TEAM_MANAGER", "COACH", "SCORER", "PLAYER", "MEMBER"],
  TEAM_MANAGER: ["COACH", "SCORER", "PLAYER", "MEMBER"],
  COACH: ["SCORER", "PLAYER", "MEMBER"],
  SCORER: ["PLAYER", "MEMBER"],
  PLAYER: ["MEMBER"],
  MEMBER: [],
};

/**
 * @param  {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return next(
        new AppError("You do not have permission to perform this action.", 403)
      );
    }

    const userRole = req.user.role;

    // Direct role match
    if (roles.includes(userRole)) {
      return next();
    }

    // Check hierarchy — does the user's role have access to any of the allowed roles?
    const inheritedRoles = ROLE_HIERARCHY[userRole] || [];
    const hasAccess = roles.some((role) => inheritedRoles.includes(role));

    if (!hasAccess) {
      return next(
        new AppError("You do not have permission to perform this action.", 403)
      );
    }

    next();
  };
};

module.exports = { authorize };
