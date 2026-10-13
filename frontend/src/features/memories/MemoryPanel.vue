<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Island, Participant, Photo } from '../../shared/types'
import { photographerName, photoTime } from '../../shared/lib/photoFormat'

const props = defineProps<{
  island: Island | null
  photos: Photo[]
  participants: Participant[]
}>()
const emit = defineEmits<{ close: [] }>()
const enlarged = ref<Photo | null>(null)
const lightboxClose = ref<HTMLButtonElement | null>(null)
let previousFocus: HTMLElement | null = null
watch(enlarged, async (photo) => {
  if (photo) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    lightboxClose.value?.focus()
  } else previousFocus?.focus()
})
const memories = computed(() => props.photos.filter((photo) => photo.islandId === props.island?.id))
watch(
  () => props.island?.id,
  () => {
    enlarged.value = null
  },
)
watch(
  () => props.photos,
  () => {
    if (enlarged.value && !memories.value.some((photo) => photo.id === enlarged.value?.id))
      enlarged.value = null
  },
)
function escape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (enlarged.value) enlarged.value = null
  else if (props.island) emit('close')
}
onMounted(() => window.addEventListener('keydown', escape))
onUnmounted(() => window.removeEventListener('keydown', escape))
</script>

<template>
  <Transition name="memory">
    <aside v-if="island" class="memory-panel" aria-labelledby="memory-title" @keydown.stop="escape">
      <header class="memory-header">
        <span class="eyebrow">回忆靠岸</span
        ><button aria-label="关闭回忆面板" class="close-button" @click="emit('close')">×</button>
      </header>
      <div class="place-number">
        {{ String(island.appearance + 1).padStart(2, '0') }}
        <span>／ 旅途拾光</span>
      </div>
      <h2 id="memory-title">{{ island.name }}</h2>
      <div class="place-summary">
        <span class="small-line" />
        <p>{{ memories.length }} 张照片 · 一些舍不得忘记的瞬间</p>
      </div>
      <div v-if="!memories.length" class="empty-memory">
        <span aria-hidden="true">☁</span>
        <h3>这里暂时很安静。</h3>
        <p>当前人物筛选下还没有照片。看看其他旅伴的视角，或带一张新的回忆来。</p>
      </div>
      <div v-else class="photo-stack">
        <article
          v-for="(photo, index) in memories"
          :key="photo.id"
          class="memory-card"
          :class="{ alternate: index % 2 === 1 }"
        >
          <button
            class="photo-button"
            :aria-label="'查看原图：' + photo.caption"
            @click="enlarged = photo"
          >
            <img :src="photo.url" :alt="photo.caption" loading="lazy" /><span class="enlarge-hint"
              >查看原图 ↗</span
            >
          </button>
          <div class="photo-caption">
            <span class="photo-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <p>{{ photo.caption || '旅途中的一刻' }}</p>
          </div>
          <div class="photo-meta">
            <span
              ><i
                :style="{
                  background:
                    participants.find((person) => person.id === photo.photographerId)?.color ||
                    'var(--accent)',
                }"
              />{{ photographerName(photo, participants) }} 拍摄</span
            ><time
              :datetime="
                photo.capturedAt === undefined
                  ? undefined
                  : new Date(photo.capturedAt).toISOString()
              "
              >{{ photoTime(photo) }}</time
            >
          </div>
        </article>
      </div>
      <footer class="memory-footer">
        <span aria-hidden="true">✦</span> 风会吹过，回忆会留下。
      </footer>
    </aside>
  </Transition>
  <Teleport to="body">
    <div
      v-if="enlarged"
      class="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="回忆照片原图"
      @click.self="enlarged = null"
      @keydown.stop="escape"
    >
      <button
        ref="lightboxClose"
        class="lightbox-close"
        aria-label="关闭原图"
        @click="enlarged = null"
      >
        ×
      </button>
      <img :src="enlarged.url" :alt="enlarged.caption" />
      <p>
        {{ enlarged.caption
        }}<span>{{ photographerName(enlarged, participants) }} · {{ photoTime(enlarged) }}</span>
      </p>
    </div>
  </Teleport>
</template>

<style scoped>
.memory-panel {
  position: absolute;
  right: 22px;
  top: 108px;
  bottom: 28px;
  width: 350px;
  z-index: 25;
  background: var(--panel, #fffdf4);
  color: var(--text, #263e39);
  border: 1px solid var(--border, #d9dfd4);
  border-radius: 20px;
  padding: 26px;
  overflow: auto;
  box-shadow: 0 18px 60px #173e3520;
  box-sizing: border-box;
}
.memory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.eyebrow {
  font-size: 9px;
  letter-spacing: 0.2em;
  color: var(--muted, #879388);
  font-weight: 700;
}
.close-button {
  width: 29px;
  height: 29px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: transparent;
  color: var(--text);
  font-size: 21px;
  cursor: pointer;
}
.place-number {
  margin-top: 27px;
  font-size: 12px;
  color: var(--accent, #527869);
  font-family: monospace;
}
.place-number span {
  color: var(--muted);
  font-size: 10px;
}
h2 {
  font-family: Georgia, 'Songti SC', serif;
  font-size: 29px;
  font-weight: 500;
  line-height: 1.4;
  margin: 10px 0 13px;
  overflow-wrap: anywhere;
}
.place-summary {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 28px;
}
.small-line {
  width: 24px;
  height: 1px;
  background: var(--accent);
  flex-shrink: 0;
}
.place-summary p {
  font-size: 10px;
  color: var(--muted);
  margin: 0;
  line-height: 1.6;
}
.photo-stack {
  display: grid;
  gap: 24px;
}
.memory-card {
  padding: 9px 9px 12px;
  background: color-mix(in srgb, var(--panel) 94%, var(--accent));
  border: 1px solid var(--border);
  box-shadow: 0 5px 14px #173e3509;
}
.photo-button {
  display: block;
  position: relative;
  padding: 0;
  width: 100%;
  border: 0;
  background: var(--border);
  cursor: zoom-in;
  overflow: hidden;
  aspect-ratio: 4/3;
}
.photo-button img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s;
}
.photo-button:hover img {
  transform: scale(1.035);
}
.enlarge-hint {
  position: absolute;
  right: 8px;
  bottom: 8px;
  background: #102c276e;
  color: #fffdf4;
  border-radius: 5px;
  padding: 5px 7px;
  font-size: 9px;
  opacity: 0;
  transition: opacity 0.2s;
}
.photo-button:hover .enlarge-hint,
.photo-button:focus-visible .enlarge-hint {
  opacity: 1;
}
.photo-caption {
  display: flex;
  gap: 10px;
  padding: 13px 3px 8px;
  align-items: baseline;
}
.photo-index {
  font-family: monospace;
  font-size: 10px;
  color: var(--muted);
}
.photo-caption p {
  font-family: Georgia, 'Songti SC', serif;
  font-size: 15px;
  line-height: 1.6;
  margin: 0;
  overflow-wrap: anywhere;
}
.photo-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  padding: 0 3px;
  font-size: 9px;
  color: var(--muted);
  line-height: 1.7;
}
.photo-meta > span {
  display: flex;
  align-items: center;
  gap: 5px;
}
.photo-meta i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.memory-footer {
  padding-top: 30px;
  font-size: 10px;
  letter-spacing: 0.13em;
  color: var(--muted);
  text-align: center;
}
.memory-footer span {
  display: block;
  font-size: 16px;
  margin-bottom: 9px;
  color: var(--accent);
}
.empty-memory {
  padding: 36px 12px;
  text-align: center;
  border: 1px dashed var(--border);
  border-radius: 12px;
}
.empty-memory > span {
  font-size: 40px;
  color: var(--accent);
}
.empty-memory h3 {
  font-size: 15px;
  font-weight: 500;
}
.empty-memory p {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.9;
}
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: #091a16ec;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 28px 30px;
  color: #fffdf4;
  box-sizing: border-box;
  backdrop-filter: blur(8px);
}
.lightbox > img {
  max-width: 100%;
  max-height: calc(100vh - 170px);
  object-fit: contain;
  box-shadow: 0 20px 70px #0006;
}
.lightbox > p {
  font-family: Georgia, 'Songti SC', serif;
  font-size: 17px;
  text-align: center;
  line-height: 1.8;
  margin: 20px 0 0;
}
.lightbox > p span {
  display: block;
  font-family: system-ui, sans-serif;
  font-size: 11px;
  color: #c0cbc1;
}
.lightbox-close {
  position: absolute;
  top: 22px;
  right: 26px;
  width: 40px;
  height: 40px;
  border: 1px solid #ffffff50;
  border-radius: 50%;
  color: #fff;
  background: transparent;
  font-size: 28px;
  cursor: pointer;
}
.memory-enter-active,
.memory-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.memory-enter-from,
.memory-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
@media (max-width: 700px) {
  .memory-panel {
    top: auto;
    bottom: 0;
    right: 0;
    left: 0;
    width: 100%;
    max-height: 65vh;
    border-radius: 20px 20px 0 0;
    padding: 24px;
  }
  .photo-stack {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    align-items: start;
  }
  .place-number {
    margin-top: 14px;
  }
  h2 {
    font-size: 25px;
  }
  .place-summary {
    margin-bottom: 20px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .photo-button img,
  .memory-enter-active,
  .memory-leave-active {
    transition: none;
  }
}
</style>

<style scoped>
.memory-panel {
  border-radius: 4px;
  border-width: 2px;
  box-shadow:
    5px 5px 0 color-mix(in srgb, var(--accent) 25%, transparent),
    0 18px 60px #173e3520;
}
.memory-card {
  box-shadow: 3px 3px 0 color-mix(in srgb, var(--accent) 12%, transparent);
  border-width: 2px;
}
.photo-index,
.place-number {
  font-family: monospace;
  font-weight: bold;
}
.close-button,
.lightbox-close,
.enlarge-hint,
.empty-memory {
  border-radius: 2px;
}
.photo-meta i {
  border-radius: 0;
}
.photo-button:focus-visible,
.close-button:focus-visible,
.lightbox-close:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
@media (max-width: 700px) {
  .memory-panel {
    border-radius: 4px 4px 0 0;
  }
}
</style>
