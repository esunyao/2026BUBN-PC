<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Contribution } from '../../shared/memoryTypes'
import MemoryImage from './MemoryImage.vue'
const props = defineProps<{
  contributions: Contribution[]
  participant: string
  names: Record<string, string>
  pointer: { x: number; y: number }
}>()
const emit = defineEmits<{ focus: [id: string]; nearest: [] }>()
const photos = computed(() => props.contributions.filter((c) => c.kind === 'photo'))
const selected = computed(() =>
  photos.value.filter((c) => props.participant === 'all' || c.participantId === props.participant),
)
const photoIndex = ref(0)
let touchX = 0
function step(delta: number) {
  photoIndex.value =
    (photoIndex.value + delta + Math.max(selected.value.length, 1)) %
    Math.max(selected.value.length, 1)
}
function style(c: Contribution, index: number) {
  const relevant = props.participant === 'all' || c.participantId === props.participant
  const order = relevant ? selected.value.findIndex((p) => p.id === c.id) : index
  const main = relevant && order === photoIndex.value % Math.max(selected.value.length, 1)
  return {
    '--x': `${main ? 0 : relevant ? [-29, 27, -22, 32][order % 4] : index % 2 ? 49 : -49}%`,
    '--y': `${main ? 0 : relevant ? [-12, 8, 22, -18][order % 4] : 5}%`,
    '--rotate': `${main ? -1 : relevant ? [-5, 5, -7, 4][order % 4] : index % 2 ? 10 : -10}deg`,
    '--scale': main ? 1 : relevant ? 0.68 : 0.52,
    '--depth': main ? '60px' : relevant ? '0px' : '-160px',
    opacity: relevant ? 1 : 0.15,
    zIndex: main ? 10 : relevant ? 5 - order : 0,
    pointerEvents: relevant ? ('auto' as const) : ('none' as const),
  }
}
</script>
<template>
  <div
    class="stack-wrap"
    tabindex="0"
    aria-label="照片堆叠，左右方向键切换照片"
    @keydown.left.prevent="step(-1)"
    @keydown.right.prevent="step(1)"
    @touchstart.passive="touchX = $event.touches[0]?.clientX ?? 0"
    @touchend.passive="
      Math.abs(($event.changedTouches[0]?.clientX ?? touchX) - touchX) > 45 &&
      step(($event.changedTouches[0]?.clientX ?? touchX) > touchX ? -1 : 1)
    "
  >
    <div
      class="spatial-stack"
      :style="{
        transform: `rotateY(${pointer.x * 2}deg) rotateX(${-pointer.y * 2}deg) translate(${pointer.x * 5}px, ${pointer.y * 5}px)`,
      }"
    >
      <TransitionGroup name="photo">
        <button
          v-for="(c, index) in photos"
          :key="c.id"
          class="photo-card"
          :class="{
            'is-leading':
              selected.findIndex((p) => p.id === c.id) ===
              photoIndex % Math.max(selected.length, 1),
          }"
          :style="style(c, index)"
          :tabindex="participant === 'all' || c.participantId === participant ? 0 : -1"
          :aria-label="`放大 ${names[c.participantId]} 的照片：${c.alt}`"
          @click="emit('focus', c.id)"
        >
          <MemoryImage :src="c.mediaUrl" :alt="c.alt" eager />
          <span class="print-caption"
            ><span>{{ names[c.participantId] }}的视角</span
            ><span
              >{{ c.isDemo ? 'DEMO' : 'LOCAL' }} · {{ String(index + 1).padStart(2, '0') }}</span
            ></span
          >
        </button>
      </TransitionGroup>
    </div>
    <div v-if="!selected.length" class="empty-memory" role="status">
      <p>此人在这个时刻没有留下照片。</p>
      <button @click="emit('nearest')">查看最近的时刻 ↗</button>
    </div>
    <div class="stack-controls">
      <button aria-label="上一张照片" :disabled="selected.length < 2" @click="step(-1)">←</button
      ><span
        >{{ selected.length ? (photoIndex % selected.length) + 1 : 0 }} / {{ selected.length }} ·
        点击相纸，走近这一刻</span
      ><button aria-label="下一张照片" :disabled="selected.length < 2" @click="step(1)">→</button>
    </div>
  </div>
</template>
