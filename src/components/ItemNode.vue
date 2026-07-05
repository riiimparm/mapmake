<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { Item } from '../types'

const props = defineProps<{
  item: Item
  selected: boolean
  editing: boolean
}>()

const emit = defineEmits<{
  pointerdown: [id: string, event: PointerEvent]
  dblclick: [id: string]
  commitText: [id: string, text: string]
  cancelEdit: []
}>()

const draft = ref(props.item.text)
const inputEl = ref<HTMLTextAreaElement | null>(null)

watch(
  () => props.editing,
  async (editing) => {
    if (editing) {
      draft.value = props.item.text
      await nextTick()
      resize()
      inputEl.value?.focus()
      inputEl.value?.select()
    }
  },
)

function resize(): void {
  const el = inputEl.value
  if (!el) return
  el.style.width = '2px'
  el.style.height = 'auto'
  el.style.width = `${Math.max(40, el.scrollWidth + 2)}px`
  el.style.height = `${el.scrollHeight}px`
}

function confirm(): void {
  emit('commitText', props.item.id, draft.value.trim())
}

function cancel(): void {
  emit('cancelEdit')
}

function onEnterKey(e: KeyboardEvent): void {
  if (e.isComposing) return
  if (e.shiftKey) return
  e.preventDefault()
  confirm()
}
</script>

<template>
  <div
    class="item-node"
    :class="{ selected }"
    :style="{ left: item.x + 'px', top: item.y + 'px' }"
    @pointerdown.stop="(e) => emit('pointerdown', item.id, e)"
    @dblclick.stop="emit('dblclick', item.id)"
  >
    <textarea
      v-if="editing"
      ref="inputEl"
      v-model="draft"
      class="item-input"
      rows="1"
      @input="resize"
      @keydown.enter.stop="onEnterKey"
      @keydown.esc.stop.prevent="cancel"
      @blur="confirm"
      @pointerdown.stop
    ></textarea>
    <span v-else class="item-text">{{ item.text }}</span>
  </div>
</template>

<style scoped>
.item-node {
  position: absolute;
  transform: translate(-50%, -50%);
  min-width: 64px;
  max-width: none;
  padding: 8px 14px;
  border-radius: 8px;
  background: var(--node-bg);
  border: 1.5px solid var(--node-border);
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.4;
  text-align: center;
  cursor: grab;
  user-select: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  white-space: pre;
}

.item-node:active {
  cursor: grabbing;
}

.item-node.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
}

.item-text {
  pointer-events: none;
}

.item-input {
  display: block;
  min-width: 40px;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.4;
  text-align: center;
  font-family: inherit;
  white-space: pre;
}
</style>
