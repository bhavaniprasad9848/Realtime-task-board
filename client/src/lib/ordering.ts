import type { Card } from '../types'

const GAP = 1024

/** Same fractional-index rule the server uses, so the optimistic position matches. */
export function positionBetween(before: number | null, after: number | null): number {
  if (before == null && after == null) return GAP
  if (before == null) return after! - GAP
  if (after == null) return before + GAP
  return (before + after) / 2
}

/** Group cards into { columnId: [cardId, ...] } sorted by position. */
export function groupByColumn(cards: Record<string, Card>, columnIds: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = Object.fromEntries(columnIds.map((id) => [id, []]))
  const sorted = Object.values(cards).sort((a, b) => a.position - b.position)
  for (const card of sorted) groups[card.columnId]?.push(card.id)
  return groups
}
