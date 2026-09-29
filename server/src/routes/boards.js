const express = require('express');
const { z } = require('zod');
const Board = require('../models/Board');
const Card = require('../models/Card');
const User = require('../models/User');
const Activity = require('../models/Activity');
const HttpError = require('../utils/HttpError');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/auth');
const { loadBoardForUser } = require('../utils/boardAccess');
const { broadcast, logActivity } = require('../utils/realtime');
const { GAP } = require('../utils/positions');
const { serializeBoard, serializeCard, serializeActivity } = require('../utils/serialize');

const router = express.Router();
router.use(requireAuth);

const DEFAULT_COLUMNS = ['To Do', 'In Progress', 'Done'];

const titleSchema = z.object({ title: z.string().trim().min(1).max(80) });
const memberSchema = z.object({ email: z.email().trim().toLowerCase() });

async function populated(board) {
  await board.populate('members', 'name email');
  return serializeBoard(board);
}

// List boards the current user belongs to
router.get('/', async (req, res) => {
  const boards = await Board.find({ members: req.user._id }).sort({ updatedAt: -1 });
  res.json({ boards: boards.map(serializeBoard) });
});

// Create a board with the three default columns
router.post('/', validate(titleSchema), async (req, res) => {
  const board = await Board.create({
    title: req.body.title,
    owner: req.user._id,
    members: [req.user._id],
    columns: DEFAULT_COLUMNS.map((title, i) => ({ title, position: (i + 1) * GAP })),
  });
  res.status(201).json({ board: await populated(board) });
});

// Get one board with all its cards
router.get('/:boardId', async (req, res) => {
  const board = await loadBoardForUser(req.params.boardId, req.user);
  const cards = await Card.find({ board: board._id }).sort({ position: 1 });
  res.json({ board: await populated(board), cards: cards.map(serializeCard) });
});

router.patch('/:boardId', validate(titleSchema), async (req, res) => {
  const board = await loadBoardForUser(req.params.boardId, req.user);
  board.title = req.body.title;
  await board.save();
  const data = await populated(board);
  broadcast(req, board._id, 'board:updated', data);
  res.json({ board: data });
});

router.delete('/:boardId', async (req, res) => {
  const board = await loadBoardForUser(req.params.boardId, req.user);
  if (board.owner.toString() !== req.user._id.toString()) {
    throw new HttpError(403, 'Only the board owner can delete it');
  }
  await Promise.all([
    Card.deleteMany({ board: board._id }),
    Activity.deleteMany({ board: board._id }),
    board.deleteOne(),
  ]);
  broadcast(req, board._id, 'board:deleted', { id: board._id.toString() });
  res.status(204).end();
});

// Invite a teammate by email (they must already have an account)
router.post('/:boardId/members', validate(memberSchema), async (req, res) => {
  const board = await loadBoardForUser(req.params.boardId, req.user);
  const invitee = await User.findOne({ email: req.body.email });
  if (!invitee) throw new HttpError(404, 'No user with that email');
  if (board.hasMember(invitee._id)) throw new HttpError(409, 'User is already a member');

  board.members.push(invitee._id);
  await board.save();
  const data = await populated(board);
  broadcast(req, board._id, 'board:updated', data);
  await logActivity(req, board._id, `added ${invitee.name} to the board`);
  res.status(201).json({ board: data });
});

// ---- Columns ----

router.post('/:boardId/columns', validate(titleSchema), async (req, res) => {
  const board = await loadBoardForUser(req.params.boardId, req.user);
  const last = Math.max(0, ...board.columns.map((c) => c.position));
  board.columns.push({ title: req.body.title, position: last + GAP });
  await board.save();
  const data = await populated(board);
  broadcast(req, board._id, 'board:updated', data);
  await logActivity(req, board._id, `added column "${req.body.title}"`);
  res.status(201).json({ board: data });
});

router.patch('/:boardId/columns/:columnId', validate(titleSchema), async (req, res) => {
  const board = await loadBoardForUser(req.params.boardId, req.user);
  const column = board.columns.id(req.params.columnId);
  if (!column) throw new HttpError(404, 'Column not found');
  column.title = req.body.title;
  await board.save();
  const data = await populated(board);
  broadcast(req, board._id, 'board:updated', data);
  res.json({ board: data });
});

router.delete('/:boardId/columns/:columnId', async (req, res) => {
  const board = await loadBoardForUser(req.params.boardId, req.user);
  const column = board.columns.id(req.params.columnId);
  if (!column) throw new HttpError(404, 'Column not found');
  const { title } = column;
  board.columns = board.columns.filter((c) => c._id.toString() !== req.params.columnId);
  await board.save();
  await Card.deleteMany({ board: board._id, columnId: req.params.columnId });
  const data = await populated(board);
  broadcast(req, board._id, 'board:updated', data);
  broadcast(req, board._id, 'column:deleted', { columnId: req.params.columnId });
  await logActivity(req, board._id, `deleted column "${title}"`);
  res.json({ board: data });
});

// ---- Activity log ----

router.get('/:boardId/activity', async (req, res) => {
  const board = await loadBoardForUser(req.params.boardId, req.user);
  const items = await Activity.find({ board: board._id }).sort({ createdAt: -1 }).limit(30);
  res.json({ activity: items.map(serializeActivity) });
});

module.exports = router;
