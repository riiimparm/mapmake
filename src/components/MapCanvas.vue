<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useConceptMap } from '../composables/useConceptMap'
import { placeChild, placeSibling } from '../lib/layout'
import ItemNode from './ItemNode.vue'
import LinkLine from './LinkLine.vue'
import AreaBox from './AreaBox.vue'

const {
  state,
  createItem,
  updateItemText,
  deleteItem,
  getChildren,
  hasChildren,
  beginDragSnapshot,
  setItemPositionLive,
  commitDrag,
  createLink,
  updateLinkLabel,
  deleteLink,
  createArea,
  updateAreaLabel,
  deleteArea,
  setAreaPositionLive,
  setAreaSizeLive,
  getItemsInArea,
  undo,
  redo,
} = useConceptMap()

const wrapperEl = ref<HTMLElement | null>(null)
const panX = ref(0)
const panY = ref(0)
const zoom = ref(1)

const selectedIds = reactive(new Set<string>())
const selectedLinkId = ref<string | null>(null)
const selectedAreaId = ref<string | null>(null)
const editingItemId = ref<string | null>(null)
const editingLinkId = ref<string | null>(null)
const editingAreaId = ref<string | null>(null)
const showArrows = ref(false)

function toggleArrows(): void {
  showArrows.value = !showArrows.value
}

function clearSelection(): void {
  selectedIds.clear()
  selectedLinkId.value = null
  selectedAreaId.value = null
}

type PendingNew = { parentId?: string; x: number; y: number }
const pendingNew = ref<PendingNew | null>(null)
const pendingText = ref('')
const pendingInputEl = ref<HTMLInputElement | null>(null)

const transformStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
  transformOrigin: '0 0',
}))

function getItem(id: string) {
  return state.items.find((i) => i.id === id)
}

const visibleLinks = computed(() =>
  state.links
    .map((link) => ({ link, source: getItem(link.sourceId), target: getItem(link.targetId) }))
    .filter((entry): entry is { link: typeof entry.link; source: NonNullable<typeof entry.source>; target: NonNullable<typeof entry.target> } =>
      Boolean(entry.source && entry.target),
    ),
)

function clientToCanvas(clientX: number, clientY: number) {
  const rect = wrapperEl.value!.getBoundingClientRect()
  return {
    x: (clientX - rect.left - panX.value) / zoom.value,
    y: (clientY - rect.top - panY.value) / zoom.value,
  }
}

// --- pan & zoom ---
let panState: { startX: number; startY: number; startPanX: number; startPanY: number; moved: boolean } | null = null

function onBackgroundPointerDown(e: PointerEvent): void {
  if (e.shiftKey) {
    startAreaDraw(e)
    return
  }
  panState = { startX: e.clientX, startY: e.clientY, startPanX: panX.value, startPanY: panY.value, moved: false }
  window.addEventListener('pointermove', onPanMove)
  window.addEventListener('pointerup', onPanEnd, { once: true })
}

function onPanMove(e: PointerEvent): void {
  if (!panState) return
  const dx = e.clientX - panState.startX
  const dy = e.clientY - panState.startY
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) panState.moved = true
  panX.value = panState.startPanX + dx
  panY.value = panState.startPanY + dy
}

function onPanEnd(): void {
  window.removeEventListener('pointermove', onPanMove)
  if (panState && !panState.moved) {
    clearSelection()
  }
  panState = null
}

function onWheel(e: WheelEvent): void {
  const rect = wrapperEl.value!.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top
  const cx = (mouseX - panX.value) / zoom.value
  const cy = (mouseY - panY.value) / zoom.value
  const factor = e.deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.min(2.5, Math.max(0.3, zoom.value * factor))
  panX.value = mouseX - cx * newZoom
  panY.value = mouseY - cy * newZoom
  zoom.value = newZoom
}

function onBackgroundDblClick(e: MouseEvent): void {
  const pos = clientToCanvas(e.clientX, e.clientY)
  openPendingNew({ x: pos.x, y: pos.y })
}

// --- node selection & drag ---
let dragState: {
  id: string
  startClientX: number
  startClientY: number
  startItemX: number
  startItemY: number
  before: ReturnType<typeof beginDragSnapshot>
  moved: boolean
} | null = null

function onNodePointerDown(id: string, e: PointerEvent): void {
  if (e.shiftKey) {
    if (selectedIds.has(id)) selectedIds.delete(id)
    else selectedIds.add(id)
  } else if (!selectedIds.has(id)) {
    selectedIds.clear()
    selectedIds.add(id)
  }
  selectedLinkId.value = null
  selectedAreaId.value = null

  const item = getItem(id)
  if (!item) return
  dragState = {
    id,
    startClientX: e.clientX,
    startClientY: e.clientY,
    startItemX: item.x,
    startItemY: item.y,
    before: beginDragSnapshot(),
    moved: false,
  }
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd, { once: true })
}

function onDragMove(e: PointerEvent): void {
  if (!dragState) return
  const dx = (e.clientX - dragState.startClientX) / zoom.value
  const dy = (e.clientY - dragState.startClientY) / zoom.value
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragState.moved = true
  setItemPositionLive(dragState.id, dragState.startItemX + dx, dragState.startItemY + dy)
}

function onDragEnd(): void {
  window.removeEventListener('pointermove', onDragMove)
  if (dragState && dragState.moved) commitDrag(dragState.before)
  dragState = null
}

function onNodeDblClick(id: string): void {
  editingItemId.value = id
}

function onCommitText(id: string, text: string): void {
  if (text.length > 0) updateItemText(id, text)
  editingItemId.value = null
}

// --- link selection & editing ---
function onLinkClick(id: string): void {
  selectedLinkId.value = id
  selectedIds.clear()
  selectedAreaId.value = null
}

function onLinkDblClick(id: string): void {
  editingLinkId.value = id
}

function onCommitLabel(id: string, label: string): void {
  updateLinkLabel(id, label)
  editingLinkId.value = null
}

// --- area: shift+drag to draw a new area ---
const MIN_AREA_SIZE = 20

type Rect = { x: number; y: number; width: number; height: number }
const drawingRect = ref<Rect | null>(null)
let drawStart: { x: number; y: number } | null = null

const pendingArea = ref<Rect | null>(null)
const pendingAreaText = ref('')
const pendingAreaInputEl = ref<HTMLInputElement | null>(null)

function startAreaDraw(e: PointerEvent): void {
  const pos = clientToCanvas(e.clientX, e.clientY)
  drawStart = pos
  drawingRect.value = { x: pos.x, y: pos.y, width: 0, height: 0 }
  window.addEventListener('pointermove', onAreaDrawMove)
  window.addEventListener('pointerup', onAreaDrawEnd, { once: true })
}

function onAreaDrawMove(e: PointerEvent): void {
  if (!drawStart) return
  const pos = clientToCanvas(e.clientX, e.clientY)
  drawingRect.value = {
    x: Math.min(drawStart.x, pos.x),
    y: Math.min(drawStart.y, pos.y),
    width: Math.abs(pos.x - drawStart.x),
    height: Math.abs(pos.y - drawStart.y),
  }
}

async function onAreaDrawEnd(): Promise<void> {
  window.removeEventListener('pointermove', onAreaDrawMove)
  const rect = drawingRect.value
  drawingRect.value = null
  drawStart = null
  if (!rect || rect.width < MIN_AREA_SIZE || rect.height < MIN_AREA_SIZE) return
  pendingArea.value = rect
  pendingAreaText.value = ''
  await nextTick()
  pendingAreaInputEl.value?.focus()
}

function confirmPendingArea(): void {
  if (!pendingArea.value) return
  const label = pendingAreaText.value.trim()
  if (label) {
    const area = createArea(label, pendingArea.value.x, pendingArea.value.y, pendingArea.value.width, pendingArea.value.height)
    selectedAreaId.value = area.id
    selectedIds.clear()
    selectedLinkId.value = null
  }
  pendingArea.value = null
}

function cancelPendingArea(): void {
  pendingArea.value = null
}

function onPendingAreaEnterKey(e: KeyboardEvent): void {
  if (e.isComposing) return
  e.preventDefault()
  confirmPendingArea()
}

// --- area: selection & drag (moves contained items with it) ---
let areaDragState: {
  id: string
  startClientX: number
  startClientY: number
  startAreaX: number
  startAreaY: number
  members: { id: string; startX: number; startY: number }[]
  before: ReturnType<typeof beginDragSnapshot>
  moved: boolean
} | null = null

function onAreaPointerDown(id: string, e: PointerEvent): void {
  selectedAreaId.value = id
  selectedIds.clear()
  selectedLinkId.value = null

  const area = state.areas.find((a) => a.id === id)
  if (!area) return
  const members = getItemsInArea(area).map((i) => ({ id: i.id, startX: i.x, startY: i.y }))
  areaDragState = {
    id,
    startClientX: e.clientX,
    startClientY: e.clientY,
    startAreaX: area.x,
    startAreaY: area.y,
    members,
    before: beginDragSnapshot(),
    moved: false,
  }
  window.addEventListener('pointermove', onAreaDragMove)
  window.addEventListener('pointerup', onAreaDragEnd, { once: true })
}

function onAreaDragMove(e: PointerEvent): void {
  if (!areaDragState) return
  const dx = (e.clientX - areaDragState.startClientX) / zoom.value
  const dy = (e.clientY - areaDragState.startClientY) / zoom.value
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) areaDragState.moved = true
  setAreaPositionLive(areaDragState.id, areaDragState.startAreaX + dx, areaDragState.startAreaY + dy)
  for (const member of areaDragState.members) {
    setItemPositionLive(member.id, member.startX + dx, member.startY + dy)
  }
}

function onAreaDragEnd(): void {
  window.removeEventListener('pointermove', onAreaDragMove)
  if (areaDragState && areaDragState.moved) commitDrag(areaDragState.before)
  areaDragState = null
}

// --- area: resize via bottom-right handle ---
const MIN_AREA_WIDTH = 60
const MIN_AREA_HEIGHT = 40

let areaResizeState: {
  id: string
  startClientX: number
  startClientY: number
  startWidth: number
  startHeight: number
  before: ReturnType<typeof beginDragSnapshot>
  moved: boolean
} | null = null

function onAreaResizePointerDown(id: string, e: PointerEvent): void {
  const area = state.areas.find((a) => a.id === id)
  if (!area) return
  areaResizeState = {
    id,
    startClientX: e.clientX,
    startClientY: e.clientY,
    startWidth: area.width,
    startHeight: area.height,
    before: beginDragSnapshot(),
    moved: false,
  }
  window.addEventListener('pointermove', onAreaResizeMove)
  window.addEventListener('pointerup', onAreaResizeEnd, { once: true })
}

function onAreaResizeMove(e: PointerEvent): void {
  if (!areaResizeState) return
  const dx = (e.clientX - areaResizeState.startClientX) / zoom.value
  const dy = (e.clientY - areaResizeState.startClientY) / zoom.value
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) areaResizeState.moved = true
  const width = Math.max(MIN_AREA_WIDTH, areaResizeState.startWidth + dx)
  const height = Math.max(MIN_AREA_HEIGHT, areaResizeState.startHeight + dy)
  setAreaSizeLive(areaResizeState.id, width, height)
}

function onAreaResizeEnd(): void {
  window.removeEventListener('pointermove', onAreaResizeMove)
  if (areaResizeState && areaResizeState.moved) commitDrag(areaResizeState.before)
  areaResizeState = null
}

// --- area: label editing ---
function onAreaDblClick(id: string): void {
  editingAreaId.value = id
}

function onCommitAreaLabel(id: string, label: string): void {
  if (label.length > 0) updateAreaLabel(id, label)
  editingAreaId.value = null
}

// --- pending new item input ---
async function openPendingNew(pos: { parentId?: string; x: number; y: number }): Promise<void> {
  pendingNew.value = pos
  pendingText.value = ''
  await nextTick()
  pendingInputEl.value?.focus()
}

function confirmPendingNew(): void {
  if (!pendingNew.value) return
  const text = pendingText.value.trim()
  if (text) {
    const item = createItem(text, pendingNew.value.x, pendingNew.value.y, pendingNew.value.parentId)
    selectedIds.clear()
    selectedIds.add(item.id)
  }
  pendingNew.value = null
}

function cancelPendingNew(): void {
  pendingNew.value = null
}

function onPendingEnterKey(e: KeyboardEvent): void {
  if (e.isComposing) return
  e.preventDefault()
  confirmPendingNew()
}

function startPendingSibling(): void {
  const id = [...selectedIds][0]
  const reference = getItem(id)
  if (!reference) return
  const siblingCount = reference.parentId
    ? getChildren(reference.parentId).length
    : state.items.filter((i) => !i.parentId).length
  const pos = placeSibling(reference, siblingCount)
  openPendingNew({ parentId: reference.parentId, x: pos.x, y: pos.y })
}

function startPendingChild(): void {
  const id = [...selectedIds][0]
  const parent = getItem(id)
  if (!parent) return
  const childCount = getChildren(parent.id).length
  const pos = placeChild(parent, childCount)
  openPendingNew({ parentId: parent.id, x: pos.x, y: pos.y })
}

// --- deletion ---
function handleDeleteSelection(): void {
  if (selectedAreaId.value) {
    deleteArea(selectedAreaId.value)
    selectedAreaId.value = null
    return
  }
  if (selectedLinkId.value) {
    deleteLink(selectedLinkId.value)
    selectedLinkId.value = null
    return
  }
  if (selectedIds.size === 0) return
  const anyHasChildren = [...selectedIds].some((id) => hasChildren(id))
  if (anyHasChildren && !window.confirm('子アイテムも含めて削除しますか?')) return
  for (const id of [...selectedIds]) deleteItem(id)
  selectedIds.clear()
}

// --- free link between two selected items ---
function tryCreateFreeLink(): void {
  if (selectedIds.size !== 2) return
  const [a, b] = [...selectedIds]
  createLink(a, b)
}

// --- keyboard shortcuts ---
function onKeydown(e: KeyboardEvent): void {
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

  const meta = e.metaKey || e.ctrlKey

  if (meta && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    if (e.shiftKey) redo()
    else undo()
    return
  }

  if (meta && e.key.toLowerCase() === 'l') {
    e.preventDefault()
    tryCreateFreeLink()
    return
  }

  if (meta && e.key.toLowerCase() === 'a') {
    e.preventDefault()
    toggleArrows()
    return
  }

  if (e.key === 'Enter' && selectedIds.size === 1 && !pendingNew.value) {
    e.preventDefault()
    startPendingSibling()
    return
  }

  if (e.key === 'Tab' && selectedIds.size === 1 && !pendingNew.value) {
    e.preventDefault()
    startPendingChild()
    return
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    handleDeleteSelection()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div
    ref="wrapperEl"
    class="canvas-wrapper"
    @wheel.prevent="onWheel"
    @pointerdown="onBackgroundPointerDown"
    @dblclick="onBackgroundDblClick"
  >
    <div class="canvas-inner" :style="transformStyle">
      <AreaBox
        v-for="area in state.areas"
        :key="area.id"
        :area="area"
        :selected="selectedAreaId === area.id"
        :editing="editingAreaId === area.id"
        @pointerdown="onAreaPointerDown"
        @resize-pointerdown="onAreaResizePointerDown"
        @dblclick="onAreaDblClick"
        @commit-label="onCommitAreaLabel"
        @cancel-edit="editingAreaId = null"
      />

      <div
        v-if="drawingRect"
        class="drawing-rect"
        :style="{ left: drawingRect.x + 'px', top: drawingRect.y + 'px', width: drawingRect.width + 'px', height: drawingRect.height + 'px' }"
      ></div>

      <svg class="links-svg">
        <defs>
          <marker id="arrow-marker" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0 L6,3 L0,6 Z" style="fill: var(--link-color)" />
          </marker>
          <marker id="arrow-marker-selected" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0 L6,3 L0,6 Z" style="fill: var(--accent)" />
          </marker>
        </defs>
        <LinkLine
          v-for="entry in visibleLinks"
          :key="entry.link.id"
          :id="entry.link.id"
          :source="entry.source"
          :target="entry.target"
          :label="entry.link.label"
          :selected="selectedLinkId === entry.link.id"
          :editing="editingLinkId === entry.link.id"
          :show-arrow="showArrows"
          @click="onLinkClick"
          @dblclick="onLinkDblClick"
          @commit-label="onCommitLabel"
          @cancel-edit="editingLinkId = null"
        />
      </svg>

      <ItemNode
        v-for="item in state.items"
        :key="item.id"
        :item="item"
        :selected="selectedIds.has(item.id)"
        :editing="editingItemId === item.id"
        @pointerdown="onNodePointerDown"
        @dblclick="onNodeDblClick"
        @commit-text="onCommitText"
        @cancel-edit="editingItemId = null"
      />

      <div
        v-if="pendingNew"
        class="pending-input"
        :style="{ left: pendingNew.x + 'px', top: pendingNew.y + 'px' }"
      >
        <input
          ref="pendingInputEl"
          v-model="pendingText"
          placeholder="単語を入力"
          @keydown.enter.stop="onPendingEnterKey"
          @keydown.esc.stop.prevent="cancelPendingNew"
          @blur="confirmPendingNew"
          @pointerdown.stop
        />
      </div>

      <div
        v-if="pendingArea"
        class="pending-input"
        :style="{ left: pendingArea.x + 'px', top: pendingArea.y - 24 + 'px' }"
      >
        <input
          ref="pendingAreaInputEl"
          v-model="pendingAreaText"
          placeholder="エリア名"
          @keydown.enter.stop="onPendingAreaEnterKey"
          @keydown.esc.stop.prevent="cancelPendingArea"
          @blur="confirmPendingArea"
          @pointerdown.stop
        />
      </div>
    </div>

    <p v-if="state.items.length === 0" class="empty-hint">
      キャンバスをダブルクリックして最初のアイテムを作成
    </p>
  </div>
</template>

<style scoped>
.canvas-wrapper {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--canvas-bg);
  touch-action: none;
}

.canvas-inner {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
}

.links-svg {
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
  pointer-events: none;
}

.drawing-rect {
  position: absolute;
  border: 1.5px dashed var(--accent);
  background: rgba(91, 141, 252, 0.1);
  border-radius: 8px;
  pointer-events: none;
}

.links-svg :deep(.link-hitbox) {
  pointer-events: stroke;
}

.pending-input {
  position: absolute;
  transform: translate(-50%, -50%);
}

.pending-input input {
  min-width: 100px;
  padding: 7px 12px;
  border-radius: 8px;
  border: 1.5px solid var(--accent);
  background: var(--node-bg);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  text-align: center;
}

.empty-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--text-secondary);
  font-size: 14px;
  pointer-events: none;
}
</style>
