const { Server } = require('socket.io');
const Board = require('./models/Board');
const User = require('./models/User');
const { verifyToken } = require('./utils/tokens');
const { roomFor } = require('./utils/realtime');

/**
 * Presence: boardId -> Map(socketId -> { id, name })
 * Kept in memory, so it works for a single server instance.
 * (To scale to many instances, add the Socket.IO Redis adapter and store presence in Redis.)
 */
const presence = new Map();

function presenceList(boardId) {
  const sockets = presence.get(boardId);
  if (!sockets) return [];
  const unique = new Map();
  for (const u of sockets.values()) unique.set(u.id, u);
  return [...unique.values()];
}

function createSocketServer(httpServer, { corsOrigin }) {
  const io = new Server(httpServer, { cors: { origin: corsOrigin } });

  // Every socket must send a valid JWT: io(url, { auth: { token } })
  io.use(async (socket, next) => {
    try {
      const payload = verifyToken(socket.handshake.auth?.token);
      const user = await User.findById(payload.sub);
      if (!user) return next(new Error('unauthorized'));
      socket.data.user = { id: user._id.toString(), name: user.name };
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  const leave = (socket, boardId) => {
    socket.leave(roomFor(boardId));
    const sockets = presence.get(boardId);
    if (!sockets) return;
    sockets.delete(socket.id);
    if (sockets.size === 0) presence.delete(boardId);
    io.to(roomFor(boardId)).emit('presence', presenceList(boardId));
  };

  io.on('connection', (socket) => {
    socket.data.boards = new Set();

    socket.on('board:join', async (boardId, ack = () => {}) => {
      // Mark the intent to join *before* the async DB check, so a 'board:leave'
      // that arrives while we're still checking can cancel it (no ghost presence).
      socket.data.boards.add(boardId);
      try {
        const board = await Board.findById(boardId);
        const allowed = board && board.hasMember(socket.data.user.id);
        if (!allowed || !socket.data.boards.has(boardId) || socket.disconnected) {
          if (!allowed) socket.data.boards.delete(boardId);
          return ack({ ok: false, error: 'not found' });
        }

        socket.join(roomFor(boardId));
        if (!presence.has(boardId)) presence.set(boardId, new Map());
        presence.get(boardId).set(socket.id, socket.data.user);
        io.to(roomFor(boardId)).emit('presence', presenceList(boardId));
        return ack({ ok: true });
      } catch {
        socket.data.boards.delete(boardId);
        return ack({ ok: false, error: 'not found' });
      }
    });

    socket.on('board:leave', (boardId) => {
      socket.data.boards.delete(boardId);
      leave(socket, boardId);
    });

    socket.on('disconnect', () => {
      for (const boardId of socket.data.boards) leave(socket, boardId);
    });
  });

  return io;
}

module.exports = { createSocketServer };
