/**
 * Fractional indexing: returns a position between two neighbours so a moved
 * item can be saved without renumbering the rest of the list.
 */
export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return 1
  if (before === undefined) return after! - 1
  if (after === undefined) return before + 1
  return (before + after) / 2
}
