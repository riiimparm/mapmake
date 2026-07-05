<script setup lang="ts">
import { nextTick, ref, watch, computed } from 'vue'
import type { Item } from '../types'

const props = defineProps<{
  id: string
  source: Item
  target: Item
  label?: string
  selected: boolean
  editing: boolean
  showArrow: boolean
}>()

const emit = defineEmits<{
  click: [id: string, event: MouseEvent]
  dblclick: [id: string]
  commitLabel: [id: string, label: string]
  cancelEdit: []
}>()

const draft = ref(props.label ?? '')
const inputEl = ref<HTMLInputElement | null>(null)

const midX = computed(() => (props.source.x + props.target.x) / 2)
const midY = computed(() => (props.source.y + props.target.y) / 2)

const ARROW_PULLBACK = 34

const visibleEnd = computed(() => {
  if (!props.showArrow) return { x: props.target.x, y: props.target.y }
  const dx = props.target.x - props.source.x
  const dy = props.target.y - props.source.y
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  return {
    x: props.target.x - (dx / dist) * ARROW_PULLBACK,
    y: props.target.y - (dy / dist) * ARROW_PULLBACK,
  }
})

watch(
  () => props.editing,
  async (editing) => {
    if (editing) {
      draft.value = props.label ?? ''
      await nextTick()
      inputEl.value?.focus()
      inputEl.value?.select()
    }
  },
)

function confirm(): void {
  emit('commitLabel', props.id, draft.value.trim())
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
  <g class="link-line">
    <line
      :x1="source.x"
      :y1="source.y"
      :x2="visibleEnd.x"
      :y2="visibleEnd.y"
      :class="{ selected }"
      class="link-visible"
      :marker-end="showArrow ? (selected ? 'url(#arrow-marker-selected)' : 'url(#arrow-marker)') : undefined"
    />
    <line
      :x1="source.x"
      :y1="source.y"
      :x2="target.x"
      :y2="target.y"
      class="link-hitbox"
      @click.stop="(e) => emit('click', id, e)"
      @dblclick.stop="emit('dblclick', id)"
    />
    <text v-if="label && !editing" :x="midX" :y="midY - 6" class="link-label" text-anchor="middle">
      {{ label }}
    </text>
    <foreignObject v-if="editing" :x="midX - 60" :y="midY - 12" width="120" height="24">
      <input
        ref="inputEl"
        v-model="draft"
        class="link-label-input"
        @keydown.enter.stop="onEnterKey"
        @keydown.esc.stop.prevent="cancel"
        @blur="confirm"
        @pointerdown.stop
      />
    </foreignObject>
  </g>
</template>

<style scoped>
.link-visible {
  stroke: var(--link-color);
  stroke-width: 1.5;
  pointer-events: none;
}

.link-visible.selected {
  stroke: var(--accent);
  stroke-width: 2.5;
}

.link-hitbox {
  stroke: transparent;
  stroke-width: 14;
  cursor: pointer;
}

.link-label {
  fill: var(--text-secondary);
  font-size: 11px;
  pointer-events: none;
}

.link-label-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--node-bg);
  border: 1px solid var(--accent);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 11px;
  text-align: center;
  outline: none;
}
</style>
