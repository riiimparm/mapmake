import type { Item } from '../types'

const CHILD_RADIUS = 160
const SIBLING_RADIUS = 120

interface Point {
  x: number
  y: number
}

function pointOnCircle(center: Point, radius: number, angle: number): Point {
  return {
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle),
  }
}

/** Place a new child around its parent, spreading existing children evenly and picking a free angle. */
export function placeChild(parent: Item, siblingCount: number): Point {
  const index = siblingCount
  const angleStep = (2 * Math.PI) / Math.max(index + 1, 6)
  const angle = -Math.PI / 2 + index * angleStep
  return pointOnCircle(parent, CHILD_RADIUS, angle)
}

/** Place a new sibling near a reference item, spreading around it so siblings don't stack. */
export function placeSibling(reference: Item, siblingCount: number): Point {
  const index = siblingCount
  const angleStep = (2 * Math.PI) / Math.max(index + 1, 6)
  const angle = index * angleStep
  return pointOnCircle(reference, SIBLING_RADIUS, angle)
}
