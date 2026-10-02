import { closestCorners, getFirstCollision, KeyboardCode } from '@dnd-kit/core'
import type { DroppableContainer, KeyboardCoordinateGetter } from '@dnd-kit/core'

const directions: string[] = [
  KeyboardCode.Down,
  KeyboardCode.Right,
  KeyboardCode.Up,
  KeyboardCode.Left,
]

/**
 * Arrow-key movement for a board with several columns.
 *
 * dnd-kit's default sortable getter also targets the column containers, whose top
 * matches the first card's, so an arrow press often landed the card on its own
 * column and nothing moved. Here:
 * - Up/Down go to the nearest card above/below in the same column;
 * - Left/Right go to the nearest card in the neighbouring column, or to the column
 *   itself when it's empty.
 *
 * The dragged card's own slot stays a valid target, so it can be moved back to where
 * it started.
 */

// The tilted drag overlay's bounding box sits a few pixels off the card's real spot;
// this margin keeps the current spot from counting as "above" or "below" itself.
const SAME_SPOT_TOLERANCE = 10

export const boardKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  if (!directions.includes(event.code)) return undefined
  event.preventDefault()

  const { active, collisionRect, droppableRects, droppableContainers } = context
  if (!active || !collisionRect) return undefined

  const { top, left } = collisionRect
  const centerX = left + collisionRect.width / 2
  const right = left + collisionRect.width

  const candidates: DroppableContainer[] = []
  for (const entry of droppableContainers.getEnabled()) {
    const rect = droppableRects.get(entry.id)
    if (!rect) continue
    // Non-empty columns are reached through their cards
    const data = entry.data.current
    if (data?.type === 'column' && data.cardCount > 0) continue

    const sameColumn = rect.left <= centerX && centerX <= rect.left + rect.width
    const isCandidate =
      (event.code === KeyboardCode.Down && sameColumn && rect.top > top + SAME_SPOT_TOLERANCE) ||
      (event.code === KeyboardCode.Up && sameColumn && rect.top < top - SAME_SPOT_TOLERANCE) ||
      (event.code === KeyboardCode.Right && rect.left >= right) ||
      (event.code === KeyboardCode.Left && rect.left + rect.width <= left)
    if (isCandidate) candidates.push(entry)
  }

  const collisions = closestCorners({
    active,
    collisionRect,
    droppableRects,
    droppableContainers: candidates,
    pointerCoordinates: null,
  })
  const targetId = getFirstCollision(collisions, 'id')
  const target = targetId != null ? droppableRects.get(targetId) : undefined
  return target ? { x: target.left, y: target.top } : undefined
}
