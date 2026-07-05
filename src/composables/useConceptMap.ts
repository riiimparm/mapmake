import { computed, reactive, watch } from 'vue'
import type { Area, ConceptMapState, Item, Link } from '../types'
import { createEmptyState } from '../types'
import { loadState, saveState } from '../lib/storage'
import { HistoryStack } from '../lib/history'

const SAVE_DEBOUNCE_MS = 150

const state = reactive<ConceptMapState>(loadState() ?? createEmptyState())
const history = new HistoryStack()

let saveTimer: ReturnType<typeof setTimeout> | undefined
watch(
  state,
  () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => saveState(toPlainState()), SAVE_DEBOUNCE_MS)
  },
  { deep: true },
)

function toPlainState(): ConceptMapState {
  return {
    items: state.items.map((i) => ({ ...i })),
    links: state.links.map((l) => ({ ...l })),
    areas: state.areas.map((a) => ({ ...a })),
  }
}

function withHistory<T>(fn: () => T): T {
  history.push(toPlainState())
  return fn()
}

function replaceState(next: ConceptMapState): void {
  state.items.splice(0, state.items.length, ...next.items)
  state.links.splice(0, state.links.length, ...next.links)
  state.areas.splice(0, state.areas.length, ...next.areas)
}

function genId(): string {
  return crypto.randomUUID()
}

function now(): number {
  return Date.now()
}

function createItem(text: string, x: number, y: number, parentId?: string): Item {
  return withHistory(() => {
    const item: Item = { id: genId(), text, x, y, parentId, createdAt: now(), updatedAt: now() }
    state.items.push(item)
    if (parentId) {
      const link: Link = {
        id: genId(),
        sourceId: parentId,
        targetId: item.id,
        createdAt: now(),
        updatedAt: now(),
      }
      state.links.push(link)
    }
    return item
  })
}

function updateItemText(id: string, text: string): void {
  withHistory(() => {
    const item = state.items.find((i) => i.id === id)
    if (!item) return
    item.text = text
    item.updatedAt = now()
  })
}

function moveItem(id: string, x: number, y: number): void {
  withHistory(() => {
    const item = state.items.find((i) => i.id === id)
    if (!item) return
    item.x = x
    item.y = y
    item.updatedAt = now()
  })
}

/** Drag support: mutate position live without pushing history on every tick,
 * then call commitDrag once on drag end with the snapshot captured at drag start. */
function beginDragSnapshot(): ConceptMapState {
  return toPlainState()
}

function setItemPositionLive(id: string, x: number, y: number): void {
  const item = state.items.find((i) => i.id === id)
  if (!item) return
  item.x = x
  item.y = y
  item.updatedAt = now()
}

function commitDrag(before: ConceptMapState): void {
  history.push(before)
}

function getChildren(parentId: string): Item[] {
  return state.items.filter((i) => i.parentId === parentId)
}

function hasChildren(id: string): boolean {
  return state.items.some((i) => i.parentId === id)
}

function collectDescendantIds(id: string): Set<string> {
  const ids = new Set<string>([id])
  let added = true
  while (added) {
    added = false
    for (const item of state.items) {
      if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) {
        ids.add(item.id)
        added = true
      }
    }
  }
  return ids
}

function deleteItem(id: string): void {
  withHistory(() => {
    const toRemove = collectDescendantIds(id)
    state.items = state.items.filter((i) => !toRemove.has(i.id))
    state.links = state.links.filter((l) => !toRemove.has(l.sourceId) && !toRemove.has(l.targetId))
  })
}

function createLink(sourceId: string, targetId: string, label?: string): Link | null {
  if (sourceId === targetId) return null
  const exists = state.links.some(
    (l) =>
      (l.sourceId === sourceId && l.targetId === targetId) ||
      (l.sourceId === targetId && l.targetId === sourceId),
  )
  if (exists) return null
  return withHistory(() => {
    const link: Link = { id: genId(), sourceId, targetId, label, createdAt: now(), updatedAt: now() }
    state.links.push(link)
    return link
  })
}

function updateLinkLabel(id: string, label: string): void {
  withHistory(() => {
    const link = state.links.find((l) => l.id === id)
    if (!link) return
    link.label = label
    link.updatedAt = now()
  })
}

function deleteLink(id: string): void {
  withHistory(() => {
    state.links = state.links.filter((l) => l.id !== id)
  })
}

function createArea(label: string, x: number, y: number, width: number, height: number): Area {
  return withHistory(() => {
    const area: Area = { id: genId(), label, x, y, width, height, createdAt: now(), updatedAt: now() }
    state.areas.push(area)
    return area
  })
}

function updateAreaLabel(id: string, label: string): void {
  withHistory(() => {
    const area = state.areas.find((a) => a.id === id)
    if (!area) return
    area.label = label
    area.updatedAt = now()
  })
}

function deleteArea(id: string): void {
  withHistory(() => {
    state.areas = state.areas.filter((a) => a.id !== id)
  })
}

function setAreaPositionLive(id: string, x: number, y: number): void {
  const area = state.areas.find((a) => a.id === id)
  if (!area) return
  area.x = x
  area.y = y
  area.updatedAt = now()
}

function setAreaSizeLive(id: string, width: number, height: number): void {
  const area = state.areas.find((a) => a.id === id)
  if (!area) return
  area.width = width
  area.height = height
  area.updatedAt = now()
}

function getItemsInArea(area: Area): Item[] {
  return state.items.filter(
    (i) => i.x >= area.x && i.x <= area.x + area.width && i.y >= area.y && i.y <= area.y + area.height,
  )
}

function importState(next: ConceptMapState): void {
  withHistory(() => {
    replaceState(next)
  })
}

const canUndo = computed(() => history.canUndo())
const canRedo = computed(() => history.canRedo())

function undo(): void {
  const previous = history.undo(toPlainState())
  if (previous) replaceState(previous)
}

function redo(): void {
  const next = history.redo(toPlainState())
  if (next) replaceState(next)
}

export function useConceptMap() {
  return {
    state,
    canUndo,
    canRedo,
    createItem,
    updateItemText,
    moveItem,
    beginDragSnapshot,
    setItemPositionLive,
    commitDrag,
    deleteItem,
    getChildren,
    hasChildren,
    createLink,
    updateLinkLabel,
    deleteLink,
    createArea,
    updateAreaLabel,
    deleteArea,
    setAreaPositionLive,
    setAreaSizeLive,
    getItemsInArea,
    importState,
    exportState: toPlainState,
    undo,
    redo,
  }
}
