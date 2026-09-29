const Board = require('../models/Board');
const HttpError = require('./HttpError');

/**
 * Load a board and make sure the user is a member.
 * Returns 404 (not 403) for non-members so we don't reveal which board ids exist.
 */
async function loadBoardForUser(boardId, user) {
  const board = await Board.findById(boardId);
  if (!board || !board.hasMember(user._id)) throw new HttpError(404, 'Board not found');
  return board;
}

module.exports = { loadBoardForUser };
