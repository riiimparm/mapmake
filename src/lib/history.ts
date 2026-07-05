import type { ConceptMapState } from '../types'

const MAX_HISTORY = 100

export class HistoryStack {
  private past: ConceptMapState[] = []
  private future: ConceptMapState[] = []

  push(state: ConceptMapState): void {
    this.past.push(structuredClone(state))
    if (this.past.length > MAX_HISTORY) this.past.shift()
    this.future = []
  }

  undo(current: ConceptMapState): ConceptMapState | null {
    const previous = this.past.pop()
    if (!previous) return null
    this.future.push(structuredClone(current))
    return previous
  }

  redo(current: ConceptMapState): ConceptMapState | null {
    const next = this.future.pop()
    if (!next) return null
    this.past.push(structuredClone(current))
    return next
  }

  canUndo(): boolean {
    return this.past.length > 0
  }

  canRedo(): boolean {
    return this.future.length > 0
  }

  clear(): void {
    this.past = []
    this.future = []
  }
}
