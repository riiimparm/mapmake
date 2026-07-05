<script setup lang="ts">
import { ref } from 'vue'
import { useConceptMap } from '../composables/useConceptMap'
import { exportToFile, importFromFile } from '../lib/storage'

const { exportState, importState, undo, redo, canUndo, canRedo } = useConceptMap()

const fileInput = ref<HTMLInputElement | null>(null)
const showShortcuts = ref(false)

const shortcuts = [
  { keys: 'クリック', desc: 'アイテムを選択' },
  { keys: 'Shift+クリック', desc: 'アイテムを複数選択' },
  { keys: 'ダブルクリック', desc: 'アイテム/リンク/エリアの名前を編集' },
  { keys: 'ドラッグ', desc: 'アイテム/エリアを移動' },
  { keys: 'Shift+ドラッグ (背景)', desc: 'ラベル付きエリアを作成' },
  { keys: 'Enter (アイテム選択中)', desc: '兄弟アイテムを作成' },
  { keys: 'Tab (アイテム選択中)', desc: '子アイテムを作成' },
  { keys: 'Shift+Enter (編集中)', desc: 'アイテム内で改行' },
  { keys: 'Delete / Backspace', desc: '選択中のアイテム/リンク/エリアを削除' },
  { keys: 'Cmd/Ctrl+L (2アイテム選択)', desc: '選択した2つを自由リンクで連結' },
  { keys: 'Cmd/Ctrl+A', desc: 'リンクの矢印表示を切り替え' },
  { keys: 'Cmd/Ctrl+Z', desc: '元に戻す' },
  { keys: 'Cmd/Ctrl+Shift+Z', desc: 'やり直す' },
]

function toggleShortcuts(): void {
  showShortcuts.value = !showShortcuts.value
}

function onExport(): void {
  exportToFile(exportState())
}

function onImportClick(): void {
  fileInput.value?.click()
}

async function onFileChange(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!window.confirm('現在のマップを置き換えてインポートしますか?')) {
    ;(e.target as HTMLInputElement).value = ''
    return
  }
  try {
    const imported = await importFromFile(file)
    importState(imported)
  } catch (err) {
    window.alert(err instanceof Error ? err.message : 'インポートに失敗しました')
  } finally {
    ;(e.target as HTMLInputElement).value = ''
  }
}
</script>

<template>
  <div class="toolbar-wrap">
    <div class="toolbar">
      <button type="button" :disabled="!canUndo" title="元に戻す (Cmd+Z)" @click="undo">↶</button>
      <button type="button" :disabled="!canRedo" title="やり直す (Cmd+Shift+Z)" @click="redo">↷</button>
      <span class="divider"></span>
      <button type="button" @click="onExport">Export</button>
      <button type="button" @click="onImportClick">Import</button>
      <span class="divider"></span>
      <button type="button" class="info-button" title="ショートカット一覧" @click="toggleShortcuts">i</button>
      <input ref="fileInput" type="file" accept="application/json" class="hidden-input" @change="onFileChange" />
    </div>

    <div v-if="showShortcuts" class="shortcut-panel">
      <table>
        <tbody>
          <tr v-for="s in shortcuts" :key="s.keys">
            <td class="keys">{{ s.keys }}</td>
            <td class="desc">{{ s.desc }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.toolbar-wrap {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 10;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--node-bg);
  border: 1px solid var(--node-border);
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.info-button {
  border-radius: 50%;
  width: 28px;
  height: 28px;
  padding: 0 !important;
  font-style: italic;
  font-weight: 700;
}

.shortcut-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 320px;
  padding: 10px 12px;
  background: var(--node-bg);
  border: 1px solid var(--node-border);
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.shortcut-panel table {
  border-collapse: collapse;
  width: 100%;
}

.shortcut-panel td {
  padding: 4px 8px;
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
  border-bottom: 1px solid var(--node-border);
}

.shortcut-panel tr:last-child td {
  border-bottom: none;
}

.shortcut-panel .keys {
  color: var(--accent);
  font-family: ui-monospace, monospace;
}

.shortcut-panel .desc {
  color: var(--text-secondary);
  white-space: normal;
}

.toolbar button {
  padding: 6px 12px;
  background: transparent;
  border: 1px solid var(--node-border);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
}

.toolbar button:hover:not(:disabled) {
  border-color: var(--accent);
}

.toolbar button:disabled {
  opacity: 0.4;
  cursor: default;
}

.divider {
  width: 1px;
  height: 20px;
  background: var(--node-border);
}

.hidden-input {
  display: none;
}
</style>
