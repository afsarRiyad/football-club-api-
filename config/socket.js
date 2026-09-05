const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

// Store active match rooms: { matchId: Set<socketId> }
const matchRooms = new Map();
// Store active formation rooms: { matchId: Set<socketId> }
const formationRooms = new Map();

let io;

/**
 * Initialize Socket.io on the HTTP server.
 * @param {import("http").Server} server
 * @returns {Server} Socket.io server instance
 */
const initSocket = (server) => {
  const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000,http://localhost:3001")
    .split(",")
    .map((o) => o.trim());

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ─── Auth Middleware ─────────────────────────────────────────────
  io.use((socket, next) => {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.query.token;

    if (!token) {
      // Allow anonymous connections for public match viewing
      socket.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      socket.user = null;
      next(); // Still allow connection, just no auth
    }
  });

  // ─── Connection Handler ──────────────────────────────────────────
  io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // ── Join a match room ──
    socket.on("match:join", (matchId) => {
      if (!matchId) return;

      socket.join(`match:${matchId}`);
      socket.currentMatch = matchId;

      // Track room membership
      if (!matchRooms.has(matchId)) {
        matchRooms.set(matchId, new Set());
      }
      matchRooms.get(matchId).add(socket.id);

      const roomSize = matchRooms.get(matchId).size;
      console.log(`⚽ Match ${matchId}: ${roomSize} viewer(s)`);

      // Notify room of updated viewer count
      io.to(`match:${matchId}`).emit("match:viewerCount", roomSize);

      // Send current viewer count to joining client
      socket.emit("match:joined", { matchId, viewers: roomSize });
    });

    // ── Leave a match room ──
    socket.on("match:leave", (matchId) => {
      if (!matchId) return;

      socket.leave(`match:${matchId}`);

      if (matchRooms.has(matchId)) {
        matchRooms.get(matchId).delete(socket.id);
        const roomSize = matchRooms.get(matchId).size;

        if (roomSize === 0) {
          matchRooms.delete(matchId);
        } else {
          io.to(`match:${matchId}`).emit("match:viewerCount", roomSize);
        }
      }

      socket.currentMatch = null;
    });

    // ── Admin: Send score update ──
    socket.on("match:updateScore", (data) => {
      if (!socket.user || !["SUPER_ADMIN", "CLUB_ADMIN", "SCORER"].includes(socket.user.role)) {
        return socket.emit("error", { message: "Unauthorized" });
      }

      const { matchId, homeScore, awayScore } = data;
      if (!matchId || homeScore === undefined || awayScore === undefined) return;

      io.to(`match:${matchId}`).emit("match:scoreUpdate", {
        matchId,
        score: { home: homeScore, away: awayScore },
        timestamp: new Date().toISOString(),
      });
    });

    // ── Admin: Send match event ──
    socket.on("match:addEvent", (data) => {
      if (!socket.user || !["SUPER_ADMIN", "CLUB_ADMIN", "SCORER"].includes(socket.user.role)) {
        return socket.emit("error", { message: "Unauthorized" });
      }

      const { matchId, event } = data;
      if (!matchId || !event) return;

      io.to(`match:${matchId}`).emit("match:newEvent", {
        matchId,
        event,
        timestamp: new Date().toISOString(),
      });
    });

    // ── Admin: Match status change ──
    socket.on("match:updateStatus", (data) => {
      if (!socket.user || !["SUPER_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER"].includes(socket.user.role)) {
        return socket.emit("error", { message: "Unauthorized" });
      }

      const { matchId, status } = data;
      if (!matchId || !status) return;

      io.to(`match:${matchId}`).emit("match:statusChange", {
        matchId,
        status,
        timestamp: new Date().toISOString(),
      });
    });

    // ── Join a formation room (for live lineup sync) ──
    socket.on("formation:join", (matchId) => {
      if (!matchId) return;

      socket.join(`formation:${matchId}`);
      socket.currentFormationMatch = matchId;

      if (!formationRooms.has(matchId)) {
        formationRooms.set(matchId, new Set());
      }
      formationRooms.get(matchId).add(socket.id);

      console.log(`📋 Formation ${matchId}: ${formationRooms.get(matchId).size} viewer(s)`);
    });

    // ── Leave formation room ──
    socket.on("formation:leave", (matchId) => {
      if (!matchId) return;

      socket.leave(`formation:${matchId}`);

      if (formationRooms.has(matchId)) {
        formationRooms.get(matchId).delete(socket.id);
        if (formationRooms.get(matchId).size === 0) {
          formationRooms.delete(matchId);
        }
      }

      socket.currentFormationMatch = null;
    });

    // ── Chat in match room (optional) ──
    socket.on("match:chat", (data) => {
      if (!socket.currentMatch) return;

      const { message } = data;
      if (!message || typeof message !== "string") return;

      io.to(`match:${socket.currentMatch}`).emit("match:chatMessage", {
        matchId: socket.currentMatch,
        user: socket.user
          ? { id: socket.user.id, role: socket.user.role }
          : { id: "anonymous", role: "GUEST" },
        message: message.slice(0, 500), // Limit message length
        timestamp: new Date().toISOString(),
      });
    });

    // ── Disconnect ──
    socket.on("disconnect", () => {
      // Clean up match room tracking
      if (socket.currentMatch && matchRooms.has(socket.currentMatch)) {
        matchRooms.get(socket.currentMatch).delete(socket.id);
        const roomSize = matchRooms.get(socket.currentMatch).size;

        if (roomSize === 0) {
          matchRooms.delete(socket.currentMatch);
        } else {
          io.to(`match:${socket.currentMatch}`).emit(
            "match:viewerCount",
            roomSize
          );
        }
      }

      // Clean up formation room tracking
      if (socket.currentFormationMatch && formationRooms.has(socket.currentFormationMatch)) {
        formationRooms.get(socket.currentFormationMatch).delete(socket.id);
        if (formationRooms.get(socket.currentFormationMatch).size === 0) {
          formationRooms.delete(socket.currentFormationMatch);
        }
      }

      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

/**
 * Get the Socket.io server instance.
 * @returns {Server}
 */
const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized. Call initSocket() first.");
  }
  return io;
};

/**
 * Emit an event to a specific match room from controllers.
 * @param {string} matchId
 * @param {string} event
 * @param {object} data
 */
const emitToMatch = (matchId, event, data) => {
  if (!io) return;
  io.to(`match:${matchId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Get the number of viewers in a match room.
 * @param {string} matchId
 * @returns {number}
 */
const getMatchViewerCount = (matchId) => {
  return matchRooms.has(matchId) ? matchRooms.get(matchId).size : 0;
};

/**
 * Emit an event to a specific formation room from controllers.
 * @param {string} matchId
 * @param {string} event
 * @param {object} data
 */
const emitToFormation = (matchId, event, data) => {
  if (!io) return;
  io.to(`formation:${matchId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  initSocket,
  getIO,
  emitToMatch,
  emitToFormation,
  getMatchViewerCount,
};
