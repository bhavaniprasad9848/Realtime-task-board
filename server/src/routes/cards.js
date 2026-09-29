const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const Card = require('../models/Card');
const HttpError = require('../utils/HttpError');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/auth');
const { loadBoardForUser } = require('../utils/boardAccess');
const { broadcast, logActivity } = require('../utils/realtime');
const { GAP, positionBetween, needsRebalance } = require('../utils/positions');
const { serializeCard } = require('../utils/serialize');

const router = express.Router();
router.use(requireAuth);

const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'invalid id');

const createSchema = z.object({
  columnId: objectId,
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional(),
});

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(2000).optional(),
    dueDate: z.iso.datetime().nullable().optional(),
    assignee: objectId.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');

// The client says where the card landed by naming its new neighbours.
const moveSchema = z.object({
  columnId: objectId,
  beforeId: objectId.nullable().optional(), // card directly above the drop spot
  afterId: objectId.nullable().optional(), // card directly below the drop spot
});

async function loadCard(cardId, user) {
  const card = await Card.findById(cardId);
  if (!card) throw new HttpError(404, 'Card not found');
  const board = await loadBoardForUser(card.board, user);
  return { card, board };
}

const columnTitle = (board, columnId) => board.columns.id(columnId)?.title ?? 'a column';

// Create a card at the bottom of a column
router.post('/boards/:boardId/cards', validate(createSchema), async (req, res) => {
  const board = await loadBoardForUser(req.params.boardId, req.user);
  if (!board.columns.id(req.body.columnId)) throw new HttpError(400, 'Column not on this board');

  const last = await Card.findOne({ board: board._id, columnId: req.body.columnId }).sort({ position: -1 });
  const card = await Card.create({
    ...req.body,
    board: board._id,
    position: last ? last.position + GAP : GAP,
    createdBy: req.user._id,
  });

  const data = serializeCard(card);
  broadcast(req, board._id, 'card:upserted', data);
  await logActivity(req, board._id, `created "${card.title}" in ${columnTitle(board, card.columnId)}`);
  res.status(201).json({ card: data });
});

// Edit title / description / due date / assignee
router.patch('/cards/:cardId', validate(updateSchema), async (req, res) => {
  const { card, board } = await loadCard(req.params.cardId, req.user);
  if (req.body.assignee && !board.hasMember(req.body.assignee)) {
    throw new HttpError(400, 'Assignee must be a board member');
  }
  Object.assign(card, req.body);
  await card.save();
  const data = serializeCard(card);
  broadcast(req, board._id, 'card:upserted', data);
  res.json({ card: data });
});

// Move a card (drag and drop) within or across columns
router.post('/cards/:cardId/move', validate(moveSchema), async (req, res) => {
  const { card, board } = await loadCard(req.params.cardId, req.user);
  const { columnId, beforeId, afterId } = req.body;
  if (!board.columns.id(columnId)) throw new HttpError(400, 'Column not on this board');

  const neighbour = async (id) => {
    if (!id) return null;
    const n = await Card.findOne({ _id: id, board: board._id, columnId });
    if (!n) throw new HttpError(409, 'Board changed while you were dragging; please retry');
    return n.position;
  };
  const before = await neighbour(beforeId);
  const after = await neighbour(afterId);

  const fromColumn = card.columnId.toString();
  card.columnId = columnId;
  card.position = positionBetween(before, after);
  await card.save();

  // Rare case: positions got too close to split. Re-number the whole column evenly.
  if (needsRebalance(before, after)) {
    const cards = await Card.find({ board: board._id, columnId }).sort({ position: 1, updatedAt: 1 });
    await Promise.all(cards.map((c, i) => Card.updateOne({ _id: c._id }, { position: (i + 1) * GAP })));
    const fresh = await Card.find({ board: board._id, columnId }).sort({ position: 1 });
    // Everyone, including the sender, needs the new numbers.
    req.app.get('io')?.to(`board:${board._id}`).emit('cards:rebalanced', fresh.map(serializeCard));
    const moved = fresh.find((c) => c._id.equals(card._id));
    return res.json({ card: serializeCard(moved) });
  }

  const data = serializeCard(card);
  broadcast(req, board._id, 'card:upserted', data);
  if (fromColumn !== columnId) {
    await logActivity(req, board._id, `moved "${card.title}" to ${columnTitle(board, columnId)}`);
  }
  res.json({ card: data });
});

router.delete('/cards/:cardId', async (req, res) => {
  const { card, board } = await loadCard(req.params.cardId, req.user);
  await card.deleteOne();
  broadcast(req, board._id, 'card:deleted', { id: card._id.toString() });
  await logActivity(req, board._id, `deleted "${card.title}"`);
  res.status(204).end();
});

module.exports = router;
