const Activity = require('../models/Activity');
const { serializeActivity } = require('./serialize');

const roomFor = (boardId) => `board:${boardId}`;

/**
 * Send an event to everyone viewing a board.
 * The client that made the change sends its socket id in the "x-socket-id" header;
 * we skip it because it has already updated its own screen (optimistic update).
 */
function broadcast(req, boardId, event, payload) {
  const io = req.app.get('io');
  if (!io) return;
  const senderSocketId = req.headers['x-socket-id'];
  let target = io.to(roomFor(boardId));
  if (senderSocketId) target = target.except(senderSocketId);
  target.emit(event, payload);
}

/** Save an activity-log entry and push it to everyone on the board (including the sender). */
async function logActivity(req, boardId, message) {
  const activity = await Activity.create({
    board: boardId,
    user: req.user._id,
    userName: req.user.name,
    message,
  });
  const io = req.app.get('io');
  if (io) io.to(roomFor(boardId)).emit('activity:new', serializeActivity(activity));
  return activity;
}

module.exports = { roomFor, broadcast, logActivity };
