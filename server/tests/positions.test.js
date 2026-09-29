const { GAP, positionBetween, needsRebalance } = require('../src/utils/positions');

describe('fractional positions', () => {
  test('empty column starts at GAP', () => {
    expect(positionBetween(null, null)).toBe(GAP);
  });

  test('dropping at the bottom goes after the last card', () => {
    expect(positionBetween(2048, null)).toBe(2048 + GAP);
  });

  test('dropping at the top goes before the first card', () => {
    expect(positionBetween(null, 1024)).toBe(1024 - GAP);
  });

  test('dropping between two cards takes the midpoint', () => {
    expect(positionBetween(1024, 2048)).toBe(1536);
  });

  test('flags neighbours that are too close to split', () => {
    expect(needsRebalance(1, 1 + 1e-9)).toBe(true);
    expect(needsRebalance(1, 2)).toBe(false);
    expect(needsRebalance(null, 2)).toBe(false);
  });
});
