<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { Area } from '../types'

const props = defineProps<{
  area: Area
  selected: boolean
  editing: boolean
}>()

const emit = defineEmits<{
  pointerdown: [id: string, event: PointerEvent]
  resizePointerdown: [id: string, event: PointerEvent]
  dblclick: [id: string]
  commitLabel: [id: string, label: string]
  cancelEdit: []
}>()

const draft = ref(props.area.label)
const inputEl = ref<HTMLInputElement | null>(null)

watch(
  () => props.editing,
  async (editing) => {
    if (editing) {
      draft.value = props.area.label
      await nextTick()
      inputEl.value?.focus()
      inputEl.value?.select()
    }
  },
)

function confirm(): void {
  emit('commitLabel', props.area.id, draft.value.trim())
}

function cancel(): void {
  emit('cancelEdit')
}

function onEnterKey(e: KeyboardEvent): void {
  if (e.isComposing) return
  e.preventDefault()
  confirm()
}
</script>

<template>
  <div
    class="area-box"
    :class="{ selected }"
    :style="{ left: area.x + 'px', top: area.y + 'px', width: area.width + 'px', height: area.height + 'px' }"
    @pointerdown.stop="(e) => emit('pointerdown', area.id, e)"
    @dblclick.stop="emit('dblclick', area.id)"
  >
    <div class="area-label">
      <input
        v-if="editing"
        ref="inputEl"
        v-model="draft"
        class="area-label-input"
        placeholder="エリア名"
        @keydown.enter.stop="onEnterKey"
        @keydown.esc.stop.prevent="cancel"
        @blur="confirm"
        @pointerdown.stop
      />
      <span v-else>{{ area.label }}</span>
    </div>
    <div class="resize-handle" @pointerdown.stop="(e) => emit('resizePointerdown', area.id, e)"></div>
  </div>
</template>

<style scoped>
.area-box {
  position: absolute;
  border: 1.5px dashed var(--node-border);
  background: rgba(91, 141, 252, 0.06);
  border-radius: 8px;
  cursor: grab;
}

.area-box:active {
  cursor: grabbing;
}

.area-box.selected {
  border-color: var(--accent);
  background: rgba(91, 141, 252, 0.12);
}

.area-label {
  position: absolute;
  top: -11px;
  left: 10px;
  padding: 1px 8px;
  background: var(--canvas-bg);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.area-label-input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 12px;
  font-family: inherit;
  min-width: 60px;
}

.resize-handle {
  position: absolute;
  right: -5px;
  bottom: -5px;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: var(--node-border);
  cursor: nwse-resize;
}

.area-box.selected .resize-handle {
  background: var(--accent);
}
</style>
