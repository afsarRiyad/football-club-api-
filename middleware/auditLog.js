const mongoose = require("mongoose");

// ─── Audit Log Schema ─────────────────────────────────────────────
const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    action: {
      type: String,
      required: true,
      enum: [
        "CREATE",
        "UPDATE",
        "DELETE",
        "LOGIN",
        "LOGOUT",
        "REGISTER",
        "PASSWORD_CHANGE",
        "PASSWORD_RESET",
        "ROLE_CHANGE",
        "FILE_UPLOAD",
        "FILE_DELETE",
        "PLAYER_TRANSFER",
        "BULK_IMPORT",
      ],
    },
    resource: {
      type: String, // e.g., "Player", "Match", "User"
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    changes: {
      before: { type: mongoose.Schema.Types.Mixed },
      after: { type: mongoose.Schema.Types.Mixed },
    },
    ip: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    requestId: {
      type: String,
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILURE"],
      default: "SUCCESS",
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

/**
 * Create an audit log entry.
 * @param {object} data
 * @param {string} data.action - The action performed
 * @param {string} [data.resource] - Resource type (e.g., "Player")
 * @param {ObjectId} [data.resourceId] - Resource ID
 * @param {object} [data.changes] - { before, after } for updates
 * @param {object} [data.req] - Express request object (for IP, user agent)
 * @param {ObjectId} [data.userId] - User who performed the action
 * @param {string} [data.status] - "SUCCESS" or "FAILURE"
 * @param {string} [data.errorMessage] - Error message if failed
 */
const logAudit = async (data) => {
  try {
    const entry = {
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId,
      changes: data.changes,
      status: data.status || "SUCCESS",
      errorMessage: data.errorMessage,
    };

    // Extract from request if provided
    if (data.req) {
      entry.user = data.userId || data.req.user?.id;
      entry.ip = data.req.ip || data.req.connection?.remoteAddress;
      entry.userAgent = data.req.headers?.["user-agent"];
      entry.requestId = data.req.requestId;
    } else if (data.userId) {
      entry.user = data.userId;
    }

    await AuditLog.create(entry);
  } catch (error) {
    // Don't let audit logging failures break the application
    console.error("Audit log error:", error.message);
  }
};

/**
 * Middleware that logs the action after the response is sent.
 * Attach audit data to `req.audit` before calling next().
 *
 * Usage:
 *   req.audit = { action: "CREATE", resource: "Player", resourceId: player._id };
 *   next();
 */
const auditMiddleware = (req, res, next) => {
  // Store original json method
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    // Log after response is sent
    if (req.audit) {
      logAudit({
        ...req.audit,
        req,
        status: res.statusCode < 400 ? "SUCCESS" : "FAILURE",
      });
    }

    return originalJson(body);
  };

  next();
};

module.exports = { AuditLog, logAudit, auditMiddleware };
