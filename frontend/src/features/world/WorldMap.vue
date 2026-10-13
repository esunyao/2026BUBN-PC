<script setup lang="ts">
import { computed, onMounted, onScopeDispose, reactive, ref, watch } from 'vue'
import type { Island, Photo, Point, Theme } from '../../shared/types'
import PixelIsland from '../../shared/ui/PixelIsland.vue'
import PixelBoat from '../../shared/ui/PixelBoat.vue'

const props = defineProps<{
  islands: Island[]
  photos: Photo[]
  activeParticipantIds: string[]
  selectedIslandId: string | null
  position: Point
  isMoving: boolean
  heading: number
  theme: Theme
}>()
const emit = defineEmits<{
  navigate: [islandId: string]
  manualMove: [vector: Point]
}>()
const surface = ref<HTMLElement | null>(null)
const viewport = reactive({ width: 1000, height: 650 })
const camera = reactive({ x: 710, y: 420, zoom: 0.8 })
const followBoat = ref(true)
const dragging = ref(false)
const mapFocused = ref(false)
const keys = new Set<string>()
let observer: ResizeObserver | null = null
let hasFitted = false
let dragged = false
let dragStart: Point | null = null
let dragCamera: Point | null = null
let pointerId: number | null = null
let captureElement: Element | null = null

const worldStyle = computed(() => ({
  '--label-scale': Math.max(1, 0.65 / camera.zoom),
  transform:
    'translate(' +
    (viewport.width / 2 - camera.x * camera.zoom) +
    'px, ' +
    (viewport.height / 2 - camera.y * camera.zoom) +
    'px) scale(' +
    camera.zoom +
    ')',
}))
const visibleIslands = computed(() =>
  props.islands.filter(
    (island) =>
      Math.abs(island.position.x - camera.x) < viewport.width / camera.zoom / 2 + 200 &&
      Math.abs(island.position.y - camera.y) < viewport.height / camera.zoom / 2 + 200,
  ),
)
const visiblePhotos = computed(() =>
  props.photos.filter((photo) => props.activeParticipantIds.includes(photo.photographerId)),
)
const islandPhotos = computed(() => {
  const result = new Map<string, Photo[]>()
  for (const photo of visiblePhotos.value) {
    if (!photo.islandId) continue
    const list = result.get(photo.islandId) ?? []
    list.push(photo)
    result.set(photo.islandId, list)
  }
  return result
})
const routePath = computed(() => {
  const related = props.islands.filter((island) => islandPhotos.value.has(island.id))
  return related
    .map((island, index) => {
      const point = island.position
      const previous = related[index - 1]?.position
      if (!previous) return 'M' + point.x + ' ' + (point.y + 75)
      const middle = (previous.x + point.x) / 2
      return (
        'C' +
        middle +
        ' ' +
        (previous.y + 140) +
        ' ' +
        middle +
        ' ' +
        (point.y + 140) +
        ' ' +
        point.x +
        ' ' +
        (point.y + 75)
      )
    })
    .join(' ')
})
const boatStyle = computed(() => ({
  left: props.position.x - 36 + 'px',
  top: props.position.y - 38 + 'px',
}))

function fitIslands(all = false) {
  const islands = all ? props.islands : props.islands.slice(0, 10)
  if (!islands.length) return
  const minX = Math.min(...islands.map((island) => island.position.x)) - 155
  const maxX = Math.max(...islands.map((island) => island.position.x)) + 155
  const minY = Math.min(...islands.map((island) => island.position.y)) - 140
  const maxY = Math.max(...islands.map((island) => island.position.y)) + 140
  camera.x = (minX + maxX) / 2
  camera.zoom = Math.max(
    0.18,
    Math.min(1.1, (viewport.width - 36) / (maxX - minX), (viewport.height - 120) / (maxY - minY)),
  )
  // Fit into a 36px top / 84px bottom safe area, including island labels.
  camera.y = (minY + maxY) / 2 + 24 / camera.zoom
  hasFitted = true
}

function zoomTo(value: number, local: Point = { x: viewport.width / 2, y: viewport.height / 2 }) {
  const next = Math.max(0.18, Math.min(1.8, value))
  const world = {
    x: camera.x + (local.x - viewport.width / 2) / camera.zoom,
    y: camera.y + (local.y - viewport.height / 2) / camera.zoom,
  }
  camera.x = world.x - (local.x - viewport.width / 2) / next
  camera.y = world.y - (local.y - viewport.height / 2) / next
  camera.zoom = next
}

function wheel(event: WheelEvent) {
  event.preventDefault()
  const rect = surface.value?.getBoundingClientRect()
  if (!rect) return
  followBoat.value = false
  zoomTo(camera.zoom * Math.exp(-event.deltaY * 0.0015), {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  })
}

function pointerDown(event: PointerEvent) {
  if (event.button !== 0 || (event.target as HTMLElement).closest('.map-tools')) return
  surface.value?.focus({ preventScroll: true })
  dragged = false
  dragStart = { x: event.clientX, y: event.clientY }
  dragCamera = { x: camera.x, y: camera.y }
  pointerId = event.pointerId
  // Keep clicks addressed to their island, but receive a fast drag even when
  // its first move is already outside the map.
  captureElement = (event.target as Element).closest('.island') ?? surface.value
  captureElement?.setPointerCapture(event.pointerId)
}

function pointerMove(event: PointerEvent) {
  if (!dragStart || !dragCamera || pointerId !== event.pointerId) return
  const dx = event.clientX - dragStart.x
  const dy = event.clientY - dragStart.y
  if (Math.hypot(dx, dy) < 5 && !dragged) return
  if (!dragged) {
    surface.value?.setPointerCapture(event.pointerId)
    captureElement = surface.value
  }
  dragged = true
  dragging.value = true
  followBoat.value = false
  camera.x = dragCamera.x - dx / camera.zoom
  camera.y = dragCamera.y - dy / camera.zoom
}

function pointerUp(event: PointerEvent) {
  if (captureElement?.hasPointerCapture(event.pointerId))
    captureElement.releasePointerCapture(event.pointerId)
  captureElement = null
  dragStart = null
  dragCamera = null
  pointerId = null
  dragging.value = false
}

function captureClick(event: MouseEvent) {
  if (dragged) {
    event.preventDefault()
    event.stopPropagation()
    dragged = false
  }
}

function sailTo(id: string) {
  clearKeys()
  followBoat.value = true
  emit('navigate', id)
}

function updateKeys() {
  const x =
    Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'))
  const y =
    Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w'))
  const length = Math.hypot(x, y)
  emit('manualMove', length ? { x: x / length, y: y / length } : { x: 0, y: 0 })
}

function keyDown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (
    target.closest('input, textarea, select, [contenteditable="true"]') ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return
  const key = event.key.toLowerCase()
  if (!['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) return
  event.preventDefault()
  if (keys.has(key)) return
  keys.add(key)
  followBoat.value = true
  updateKeys()
}

function keyUp(event: KeyboardEvent) {
  const key = event.key.toLowerCase()
  if (!keys.has(key)) return
  event.preventDefault()
  keys.delete(key)
  updateKeys()
}

function clearKeys() {
  if (!keys.size) return
  keys.clear()
  emit('manualMove', { x: 0, y: 0 })
}

function focusOut(event: FocusEvent) {
  if (surface.value?.contains(event.relatedTarget as Node | null)) return
  mapFocused.value = false
  clearKeys()
}

function recenter() {
  followBoat.value = true
  camera.x = props.position.x
  camera.y = props.position.y
  camera.zoom = Math.max(camera.zoom, 0.8)
  surface.value?.focus({ preventScroll: true })
}

watch(
  () => props.position,
  (point) => {
    if (followBoat.value && props.isMoving) {
      const halfWidth = viewport.width / camera.zoom / 2
      const halfHeight = viewport.height / camera.zoom / 2
      if (
        Math.abs(point.x - camera.x) > halfWidth * 0.46 ||
        Math.abs(point.y - camera.y) > halfHeight * 0.46
      ) {
        camera.x = point.x
        camera.y = point.y
      }
    }
  },
  { deep: true },
)
watch(
  () => props.islands.length,
  () => {
    if (!hasFitted) fitIslands()
  },
)

onMounted(() => {
  if (!surface.value) return
  observer = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return
    viewport.width = entry.contentRect.width
    viewport.height = entry.contentRect.height
    if (!hasFitted) fitIslands()
  })
  observer.observe(surface.value)
  window.addEventListener('blur', clearKeys)
})
onScopeDispose(() => {
  observer?.disconnect()
  window.removeEventListener('blur', clearKeys)
  clearKeys()
})
</script>

<template>
  <section
    ref="surface"
    class="world-map"
    :class="[theme, { dragging, focused: mapFocused }]"
    tabindex="0"
    aria-label="回忆群岛地图。点击岛屿航行，拖动地图或滚轮缩放，使用方向键或 WASD 驾驶小船。"
    @wheel="wheel"
    @pointerdown="pointerDown"
    @pointermove="pointerMove"
    @pointerup="pointerUp"
    @pointercancel="pointerUp"
    @click.capture="captureClick"
    @keydown="keyDown"
    @keyup="keyUp"
    @focusin="mapFocused = true"
    @focusout="focusOut"
  >
    <svg class="ocean-texture" width="100%" height="100%" aria-hidden="true">
      <defs>
        <pattern id="ocean-pixels" width="128" height="96" patternUnits="userSpaceOnUse">
          <path
            d="M12 22h21v3H12zM33 19h8v3h-8zM77 68h26v3H77zM68 71h9v3h-9zM103 64h9v3h-9z"
            fill="currentColor"
            opacity="0.2"
          />
          <path d="M55 41h9v2h-9zM6 86h13v2H6z" fill="currentColor" opacity="0.12" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#ocean-pixels)" />
    </svg>
    <div class="cloud cloud-one" aria-hidden="true" />
    <div class="cloud cloud-two" aria-hidden="true" />
    <div class="map-world" :style="worldStyle">
      <svg class="sea-routes" width="10000" height="20000" aria-hidden="true">
        <path
          :d="routePath"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-dasharray="5 10"
          opacity="0.4"
        />
      </svg>
      <button
        v-for="island in visibleIslands"
        :key="island.id"
        class="island"
        :class="{ selected: selectedIslandId === island.id, quiet: !islandPhotos.has(island.id) }"
        :style="{ left: island.position.x - 120 + 'px', top: island.position.y - 100 + 'px' }"
        :aria-label="
          island.name + '，' + (islandPhotos.get(island.id)?.length ?? 0) + ' 张照片。点击航行'
        "
        :aria-pressed="selectedIslandId === island.id"
        @click="sailTo(island.id)"
      >
        <span class="selection-ring" />
        <PixelIsland :appearance="island.appearance" :theme="theme" />
        <span v-if="islandPhotos.get(island.id)?.[0]" class="island-photo">
          <img
            :src="islandPhotos.get(island.id)?.[0]?.url"
            alt=""
            loading="lazy"
            draggable="false"
          />
          <span class="photo-count">{{ islandPhotos.get(island.id)?.length }}</span>
        </span>
        <span class="island-name"
          ><span v-if="selectedIslandId === island.id" class="location-mark" />{{
            island.name
          }}</span
        >
      </button>
      <div class="boat" :style="boatStyle">
        <PixelBoat :heading="heading" :moving="isMoving" :theme="theme" />
      </div>
    </div>
    <div class="world-status" aria-hidden="true">
      <span class="tiny-wave" /> {{ islands.length }} 座回忆岛屿 <span class="caption-line" />
      {{ visiblePhotos.length }} 个共同瞬间
    </div>
    <div class="compass" aria-hidden="true">
      <span>北</span
      ><svg viewBox="0 0 30 34">
        <path d="M15 2L4 28l11-6 11 6z" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="M15 4v17L6 26z" fill="currentColor" />
      </svg>
    </div>
    <div class="map-tools">
      <div class="zoom-tools">
        <button aria-label="放大地图" title="放大" @click="zoomTo(camera.zoom * 1.2)">+</button>
        <span>{{ Math.round(camera.zoom * 100) }}%</span>
        <button aria-label="缩小地图" title="缩小" @click="zoomTo(camera.zoom / 1.2)">−</button>
      </div>
      <button class="locate-tool" @click="recenter">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 1v4M10 15v4M1 10h4M15 10h4" />
          <circle cx="10" cy="10" r="6" />
          <circle cx="10" cy="10" r="2" /></svg
        >回到小船
      </button>
      <button class="fit-tool" @click="fitIslands(true)">查看群岛</button>
    </div>
    <div class="sailing-hint">
      <span class="hint-square" />{{
        isMoving
          ? '正在航行 · 方向键可接管'
          : mapFocused
            ? '方向键 / WASD 驾驶 · 点击岛屿出发'
            : '点击一座岛，去找回那个瞬间'
      }}
    </div>
  </section>
</template>

<style scoped>
.world-map {
  --sea: #6cb7c3;
  --sea-deep: #3b91a6;
  --sea-ink: #e5fbf4;
  --map-panel: #f5f1da;
  --map-text: #325665;
  --map-line: #39788a50;
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 440px;
  overflow: hidden;
  isolation: isolate;
  background: radial-gradient(ellipse at 44% 36%, var(--sea), var(--sea-deep));
  outline: none;
  touch-action: none;
  user-select: none;
  color: var(--map-text);
  cursor: grab;
}
.world-map.night {
  --sea: #193a5a;
  --sea-deep: #0c233f;
  --sea-ink: #8eb5d6;
  --map-panel: #162f49;
  --map-text: #c0d4df;
  --map-line: #88b6d540;
}
.world-map.dragging {
  cursor: grabbing;
}
.world-map.focused::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border: 2px solid var(--map-line);
}
.ocean-texture {
  position: absolute;
  inset: 0;
  color: var(--sea-ink);
  pointer-events: none;
}
.map-world {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  width: 0;
  height: 0;
  will-change: transform;
}
.sea-routes {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  color: var(--sea-ink);
}
.island {
  position: absolute;
  width: 240px;
  height: 200px;
  padding: 0;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  transition: filter 150ms;
}
.island:hover {
  filter: brightness(1.08);
}
.island:focus-visible {
  outline: 3px dashed var(--sea-ink);
  outline-offset: 2px;
}
.quiet .island-photo {
  opacity: 0.5;
}
.selection-ring {
  position: absolute;
  width: 221px;
  height: 76px;
  left: 9px;
  top: 93px;
  border: 2px dashed transparent;
  border-radius: 50%;
  pointer-events: none;
}
.selected .selection-ring {
  border-color: #ffe5a1;
  box-shadow: 0 0 0 5px #ffe5a115;
}
.night .selected .selection-ring {
  border-color: #88c9f0;
  box-shadow: 0 0 0 5px #88c9f015;
}
.island-name {
  position: absolute;
  left: 50%;
  top: 174px;
  transform: translateX(-50%) scale(var(--label-scale));
  transform-origin: center top;
  display: flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
  padding: 5px 11px;
  background: var(--map-panel);
  color: var(--map-text);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 1px;
  border: 1px solid var(--map-line);
  box-shadow: 3px 3px 0 #193d4920;
}
.selected .island-name {
  background: #f8df96;
  color: #4d563e;
  border-color: #8e995c;
}
.night .selected .island-name {
  background: #7ab9d8;
  color: #133751;
  border-color: #b3d9ed;
}
.location-mark {
  width: 5px;
  height: 5px;
  background: currentColor;
}
.island-photo {
  position: absolute;
  left: 166px;
  top: 29px;
  width: 48px;
  height: 41px;
  padding: 3px 3px 7px;
  transform: rotate(5deg);
  background: #fff5d7;
  box-shadow: 3px 4px 0 #19344c40;
  pointer-events: none;
}
.island-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  image-rendering: pixelated;
}
.photo-count {
  position: absolute;
  right: -5px;
  top: -6px;
  min-width: 15px;
  height: 15px;
  padding: 1px 3px;
  background: #416957;
  color: #fff8df;
  font-size: 10px;
  font-weight: 700;
  line-height: 15px;
  border: 1px solid #e9e1ba;
}
.boat {
  position: absolute;
  width: 72px;
  height: 66px;
  pointer-events: none;
  z-index: 2;
}
.world-status {
  position: absolute;
  left: 26px;
  top: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--map-text);
  opacity: 0.9;
  pointer-events: none;
}
.caption-line {
  height: 12px;
  width: 1px;
  background: currentColor;
  opacity: 0.3;
}
.tiny-wave {
  width: 17px;
  height: 6px;
  border-top: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: skewX(-20deg);
}
.compass {
  position: absolute;
  top: 23px;
  right: 25px;
  text-align: center;
  opacity: 0.6;
  pointer-events: none;
}
.compass span {
  display: block;
  font-size: 10px;
  margin-bottom: 4px;
}
.compass svg {
  width: 25px;
  height: 29px;
}
.map-tools {
  position: absolute;
  left: 24px;
  bottom: 22px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: auto;
  z-index: 3;
}
.map-tools button {
  cursor: pointer;
  border: 1px solid var(--map-line);
  border-radius: 0;
  color: var(--map-text);
  background: var(--map-panel);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  height: 33px;
  box-shadow: 2px 2px 0 #163b4b18;
}
.map-tools button:hover {
  filter: brightness(1.07);
}
.map-tools button:focus-visible {
  outline: 2px solid var(--sea-ink);
  outline-offset: 3px;
}
.zoom-tools {
  display: flex;
  align-items: center;
  background: var(--map-panel);
  height: 33px;
  border: 1px solid var(--map-line);
}
.zoom-tools button {
  border: 0;
  box-shadow: none;
  width: 29px;
  font-size: 20px;
}
.zoom-tools span {
  min-width: 38px;
  text-align: center;
  font-size: 10px;
}
.locate-tool {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 9px;
}
.locate-tool svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}
.fit-tool {
  padding: 0 10px;
}
.sailing-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  position: absolute;
  right: 24px;
  bottom: 30px;
  font-size: 11px;
  letter-spacing: 0.5px;
  opacity: 0.8;
  pointer-events: none;
}
.hint-square {
  width: 5px;
  height: 5px;
  background: currentColor;
}
.cloud {
  position: absolute;
  pointer-events: none;
  width: 125px;
  height: 39px;
  background: #f0f6df;
  opacity: 0.18;
  clip-path: polygon(
    0 45%,
    12% 45%,
    12% 24%,
    24% 24%,
    24% 9%,
    48% 9%,
    48% 20%,
    72% 20%,
    72% 38%,
    91% 38%,
    91% 59%,
    100% 59%,
    100% 82%,
    82% 82%,
    82% 100%,
    22% 100%,
    22% 82%,
    0 82%
  );
}
.cloud-one {
  right: 10%;
  top: 14%;
}
.cloud-two {
  left: 6%;
  bottom: 19%;
  transform: scale(1.3);
}
.night .cloud {
  background: #70839c;
  opacity: 0.1;
}
@media (max-width: 700px) {
  .world-map {
    min-height: 430px;
  }
  .world-status {
    left: 15px;
    top: 16px;
    font-size: 9px;
    gap: 6px;
  }
  .compass {
    right: 15px;
    top: 16px;
  }
  .map-tools {
    left: 12px;
    bottom: 16px;
    gap: 6px;
  }
  .sailing-hint {
    right: 12px;
    bottom: 60px;
    font-size: 10px;
  }
  .fit-tool {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .island {
    transition: none;
  }
  .map-world {
    will-change: auto;
  }
}
</style>
