<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type {
  ImportResult,
  Island,
  Participant,
  Photo,
  PlacePhotoRequest,
} from '../../shared/types'
import { photographerName, photoTime } from '../../shared/lib/photoFormat'
import { importPhotos } from './importPhotos'

const props = defineProps<{
  open: boolean
  islands: Island[]
  photos: Photo[]
  participants: Participant[]
}>()
const emit = defineEmits<{
  close: []
  imported: [result: ImportResult]
  place: [request: PlacePhotoRequest]
}>()
const photographerId = ref('')
const busy = ref(false)
const dragging = ref(false)
const completed = ref(0)
const total = ref(0)
const failures = ref<string[]>([])
const summary = ref('')
const closeButton = ref<HTMLButtonElement | null>(null)
let previousFocus: HTMLElement | null = null
const destinations = ref<Record<string, string>>({})
const names = ref<Record<string, string>>({})
const pending = computed(() => props.photos.filter((photo) => photo.islandId === null))
watch(
  () => props.open,
  async (open) => {
    if (open) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      await nextTick()
      closeButton.value?.focus()
    } else previousFocus?.focus()
  },
  { immediate: true },
)
watch(
  () => props.participants,
  (people) => {
    if (!people.some((person) => person.id === photographerId.value))
      photographerId.value = people[0]?.id ?? ''
  },
  { immediate: true },
)

async function receive(files: File[]) {
  if (busy.value || !files.length || !photographerId.value) return
  busy.value = true
  total.value = files.length
  completed.value = 0
  failures.value = []
  summary.value = ''
  const selectedPhotographer = photographerId.value
  const result: ImportResult = { photos: [], islands: [], failures: [] }
  const order = Math.max(-1, ...props.photos.map((photo) => photo.importOrder)) + 1
  try {
    for (const [index, file] of files.entries()) {
      const next = await importPhotos(
        [file],
        selectedPhotographer,
        [...props.islands, ...result.islands],
        order + index,
      )
      result.photos.push(...next.photos)
      result.islands.push(...next.islands)
      result.failures.push(...next.failures)
      completed.value++
    }
    emit('imported', result)
    failures.value = result.failures
    const unplaced = result.photos.filter((photo) => photo.islandId === null).length
    summary.value =
      '已收下 ' +
      result.photos.length +
      ' 张回忆' +
      (unplaced ? '，其中 ' + unplaced + ' 张等待安放。' : '，已安放在地图上。')
  } finally {
    busy.value = false
  }
}

function chooseFiles(event: Event) {
  const input = event.target as HTMLInputElement
  void receive(Array.from(input.files ?? []))
  input.value = ''
}
function dropFiles(event: DragEvent) {
  dragging.value = false
  void receive(Array.from(event.dataTransfer?.files ?? []))
}
function placePhoto(photo: Photo) {
  const target = destinations.value[photo.id] ?? ''
  if (!target) return
  const name = names.value[photo.id]?.trim()
  if (target === 'new' && !name) return
  emit('place', {
    photoId: photo.id,
    islandId: target === 'new' ? null : target,
    ...(target === 'new' ? { newPlaceName: name } : {}),
  })
}
function escape(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open && !busy.value) emit('close')
}
onMounted(() => window.addEventListener('keydown', escape))
onUnmounted(() => window.removeEventListener('keydown', escape))
</script>

<template>
  <Transition name="drawer">
    <div v-if="open" class="import-backdrop" @click.self="!busy && emit('close')">
      <section
        class="import-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        @keydown.stop="escape"
      >
        <header class="panel-header">
          <div>
            <span class="eyebrow">导入回忆</span>
            <h2 id="import-title">把旅途，带到这里。</h2>
          </div>
          <button
            ref="closeButton"
            class="close-button"
            :disabled="busy"
            aria-label="关闭导入面板"
            @click="emit('close')"
          >
            ×
          </button>
        </header>
        <p class="intro">把同一地点的照片，放进同一座岛。</p>
        <label class="photographer"
          >这批照片是谁拍的？
          <select v-model="photographerId" :disabled="busy">
            <option v-for="person in participants" :key="person.id" :value="person.id">
              {{ person.name }}
            </option>
          </select>
        </label>
        <label
          class="drop-zone"
          :class="{ dragging, busy }"
          @dragover.prevent="dragging = !busy"
          @dragleave.prevent="dragging = false"
          @drop.prevent="dropFiles"
        >
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            :disabled="busy || !photographerId"
            @change="chooseFiles"
          />
          <span class="drop-icon" aria-hidden="true">↥</span>
          <strong>{{ busy ? '正在整理这些时光…' : '轻放照片，或点击挑选' }}</strong>
          <span>JPEG · PNG · WebP</span>
          <progress
            v-if="busy"
            :value="completed"
            :max="total"
            :aria-label="'已处理 ' + completed + ' / ' + total"
          />
          <small v-if="busy">{{ completed }} / {{ total }} 张</small>
        </label>
        <p class="privacy">照片只保留在本次打开的页面里，刷新后会回到示例旅行。</p>
        <p v-if="summary" class="import-summary" role="status">{{ summary }}</p>
        <div v-if="failures.length" class="failures" role="alert">
          <strong>{{ failures.length }} 张照片未能收下</strong>
          <ul>
            <li v-for="failure in failures" :key="failure">{{ failure }}</li>
          </ul>
        </div>
        <section v-if="pending.length" class="pending-section">
          <div class="section-heading">
            <h3>还在寻找归处</h3>
            <span>{{ pending.length }} 张</span>
          </div>
          <p class="pending-intro">这些照片没有位置。选一座已有的小岛，或为它取一个新的地点名。</p>
          <article v-for="photo in pending" :key="photo.id" class="pending-card">
            <img :src="photo.url" :alt="photo.caption" loading="lazy" />
            <div class="pending-detail">
              <strong>{{ photo.caption }}</strong
              ><small>{{ photographerName(photo, participants) }} · {{ photoTime(photo) }}</small>
              <label class="sr-only" :for="'place-' + photo.id">照片归属地点</label>
              <select :id="'place-' + photo.id" v-model="destinations[photo.id]">
                <option value="">选择它的归处</option>
                <option v-for="island in islands" :key="island.id" :value="island.id">
                  {{ island.name }}
                </option>
                <option value="new">＋ 新建一座回忆小岛</option>
              </select>
              <input
                v-if="destinations[photo.id] === 'new'"
                v-model="names[photo.id]"
                maxlength="60"
                placeholder="地点名称，如：海边的早餐店"
                aria-label="新地点名称"
              />
              <button
                class="place-button"
                :disabled="
                  !destinations[photo.id] ||
                  (destinations[photo.id] === 'new' && !names[photo.id]?.trim())
                "
                @click="placePhoto(photo)"
              >
                安放这张回忆 <span aria-hidden="true">↗</span>
              </button>
            </div>
          </article>
        </section>
        <div v-else class="import-note">
          <span aria-hidden="true">⌖</span>
          <p>带有位置的照片会自动找到附近的小岛；相距 300 米以内的照片，会留在同一处。</p>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.import-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: #10292570;
  backdrop-filter: blur(5px);
  display: flex;
  justify-content: flex-end;
}
.import-panel {
  width: min(520px, 100%);
  height: 100%;
  overflow: auto;
  background: var(--panel, #fffdf4);
  color: var(--text, #263e39);
  padding: 36px;
  box-shadow: -16px 0 70px #05201d25;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.eyebrow {
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--accent, #527869);
  font-weight: 700;
}
h2 {
  margin: 12px 0 0;
  font-family: Georgia, 'Songti SC', serif;
  font-size: 28px;
  font-weight: 500;
}
.close-button {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border, #d6ded4);
  border-radius: 50%;
  background: transparent;
  color: var(--text);
  font-size: 24px;
  cursor: pointer;
}
.intro,
.privacy,
.pending-intro {
  color: var(--muted, #7b8c80);
  line-height: 1.7;
}
.intro {
  font-size: 13px;
  margin: 16px 0 28px;
}
.photographer {
  display: grid;
  gap: 10px;
  font-size: 13px;
}
.photographer select {
  margin-bottom: 20px;
}
select,
input:not([type='file']) {
  width: 100%;
  background: var(--panel);
  border: 1px solid var(--border, #d6ded4);
  border-radius: 9px;
  padding: 11px 12px;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  box-sizing: border-box;
}
.drop-zone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 34px 16px;
  border: 1px dashed var(--accent, #527869);
  border-radius: 16px;
  cursor: pointer;
  background: color-mix(in srgb, var(--accent, #527869) 5%, transparent);
  transition: background 0.2s;
}
.drop-zone.dragging {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}
.drop-zone input {
  position: absolute;
  width: 100%;
  height: 100%;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.drop-zone:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.drop-zone.busy input {
  cursor: wait;
}
.drop-icon {
  font-size: 34px;
  color: var(--accent);
}
.drop-zone strong {
  font-size: 14px;
  font-weight: 500;
}
.drop-zone > span:not(.drop-icon),
.drop-zone small {
  font-size: 11px;
  color: var(--muted);
  letter-spacing: 0.08em;
}
progress {
  width: 80%;
  accent-color: var(--accent);
}
.privacy {
  font-size: 11px;
  margin: 14px 2px 24px;
}
.import-summary {
  font-size: 13px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-radius: 10px;
  padding: 14px;
  line-height: 1.6;
}
.failures {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 12px;
}
.failures ul {
  padding-left: 18px;
  color: var(--muted);
  line-height: 1.7;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 30px;
}
.section-heading h3 {
  font-size: 18px;
  font-weight: 500;
  margin: 0;
}
.section-heading span {
  font-size: 12px;
  color: var(--muted);
}
.pending-intro {
  font-size: 12px;
}
.pending-card {
  display: flex;
  gap: 14px;
  padding: 18px 0;
  border-bottom: 1px solid var(--border);
}
.pending-card > img {
  width: 88px;
  height: 112px;
  object-fit: cover;
  border-radius: 9px;
  background: var(--border);
}
.pending-detail {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 8px;
}
.pending-detail > strong {
  font-size: 13px;
  overflow-wrap: anywhere;
}
.pending-detail > small {
  font-size: 10px;
  color: var(--muted);
  line-height: 1.5;
}
.pending-detail select,
.pending-detail input {
  padding: 8px;
  font-size: 12px;
}
.place-button {
  background: var(--accent, #527869);
  color: var(--panel, #fffdf4);
  border: 0;
  border-radius: 8px;
  padding: 9px;
  text-align: left;
  font-size: 12px;
  cursor: pointer;
}
.place-button span {
  float: right;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
.import-note {
  display: flex;
  gap: 14px;
  margin-top: 30px;
  padding-top: 22px;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}
.import-note > span {
  font-size: 24px;
  color: var(--accent);
}
.import-note p {
  margin: 0;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s;
}
.drawer-enter-active .import-panel,
.drawer-leave-active .import-panel {
  transition: transform 0.2s;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from .import-panel,
.drawer-leave-to .import-panel {
  transform: translateX(40px);
}
@media (max-width: 600px) {
  .import-panel {
    padding: 26px 22px;
  }
  h2 {
    font-size: 25px;
  }
  .pending-card > img {
    width: 74px;
    height: 100px;
  }
}
</style>

<style scoped>
.import-panel {
  border-left: 3px solid var(--border);
  box-shadow: -6px 0 0 color-mix(in srgb, var(--accent) 20%, transparent);
}
.close-button,
.drop-zone,
select,
input:not([type='file']),
.place-button,
.pending-card > img,
.failures,
.import-summary {
  border-radius: 2px;
}
.drop-zone {
  border-width: 2px;
  box-shadow: 4px 4px 0 color-mix(in srgb, var(--accent) 12%, transparent);
}
.drop-icon {
  font-family: monospace;
  font-weight: bold;
}
.place-button {
  box-shadow: 2px 2px 0 color-mix(in srgb, var(--text) 25%, transparent);
}
.pending-card > img {
  image-rendering: auto;
}
button:focus-visible,
select:focus-visible,
input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
</style>
