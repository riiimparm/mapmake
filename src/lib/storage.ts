import type { Area, ConceptMapState, Item, Link } from '../types'

const STORAGE_KEY = 'conceptmap:v1'

function isItem(value: unknown): value is Item {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.text === 'string' &&
    typeof v.x === 'number' &&
    typeof v.y === 'number' &&
    typeof v.createdAt === 'number' &&
    typeof v.updatedAt === 'number' &&
    (v.parentId === undefined || typeof v.parentId === 'string')
  )
}

function isLink(value: unknown): value is Link {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.sourceId === 'string' &&
    typeof v.targetId === 'string' &&
    typeof v.createdAt === 'number' &&
    typeof v.updatedAt === 'number' &&
    (v.label === undefined || typeof v.label === 'string')
  )
}

function isArea(value: unknown): value is Area {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.label === 'string' &&
    typeof v.x === 'number' &&
    typeof v.y === 'number' &&
    typeof v.width === 'number' &&
    typeof v.height === 'number' &&
    typeof v.createdAt === 'number' &&
    typeof v.updatedAt === 'number'
  )
}

export function isConceptMapState(value: unknown): value is ConceptMapState {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    Array.isArray(v.items) &&
    Array.isArray(v.links) &&
    Array.isArray(v.areas) &&
    v.items.every(isItem) &&
    v.links.every(isLink) &&
    v.areas.every(isArea)
  )
}

/** Older saved/exported states predate the `areas` field; treat it as absent-but-empty rather than invalid. */
function withAreasDefault(parsed: unknown): unknown {
  if (typeof parsed !== 'object' || parsed === null) return parsed
  const v = parsed as Record<string, unknown>
  if (v.areas === undefined) return { ...v, areas: [] }
  return parsed
}

export function loadState(): ConceptMapState | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = withAreasDefault(JSON.parse(raw))
    return isConceptMapState(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveState(state: ConceptMapState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function exportToFile(state: ConceptMapState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  a.href = url
  a.download = `conceptmap-${timestamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importFromFile(file: File): Promise<ConceptMapState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = withAreasDefault(JSON.parse(reader.result as string))
        if (!isConceptMapState(parsed)) {
          reject(new Error('ファイルの形式が正しくありません'))
          return
        }
        resolve(parsed)
      } catch {
        reject(new Error('JSONの読み込みに失敗しました'))
      }
    }
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'))
    reader.readAsText(file)
  })
}
