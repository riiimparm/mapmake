export interface Item {
  id: string
  text: string
  x: number
  y: number
  parentId?: string
  createdAt: number
  updatedAt: number
}

export interface Link {
  id: string
  sourceId: string
  targetId: string
  label?: string
  createdAt: number
  updatedAt: number
}

export interface Area {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  createdAt: number
  updatedAt: number
}

export interface ConceptMapState {
  items: Item[]
  links: Link[]
  areas: Area[]
}

export function createEmptyState(): ConceptMapState {
  return { items: [], links: [], areas: [] }
}
