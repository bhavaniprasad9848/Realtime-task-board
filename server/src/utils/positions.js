const GAP = 1024;
const MIN_GAP = 1e-6;

/**
 * Fractional indexing: return a position that sorts between `before` and `after`.
 * Either neighbour may be null (dropping at the top / bottom / into an empty column).
 */
function positionBetween(before, after) {
  if (before == null && after == null) return GAP;
  if (before == null) return after - GAP;
  if (after == null) return before + GAP;
  return (before + after) / 2;
}

/** True when two neighbours are so close that floating point can no longer split them. */
function needsRebalance(before, after) {
  return before != null && after != null && Math.abs(after - before) < MIN_GAP;
}

module.exports = { GAP, positionBetween, needsRebalance };
