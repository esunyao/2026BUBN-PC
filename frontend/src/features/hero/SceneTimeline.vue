<script setup lang="ts">
import type { Contribution, Moment } from '../../shared/memoryTypes'
import MemoryImage from './MemoryImage.vue'
defineProps<{
  moments: Moment[]
  contributions: Contribution[]
  activeId: string
  playing: boolean
  speed: number
}>()
const emit = defineEmits<{ select: [id: string]; toggle: []; speed: [speed: number] }>()
</script>
<template>
  <section class="scene-timeline" aria-label="场景时间轴">
    <div class="timeline-head">
      <span class="eyebrow">THE PASSAGE OF TIME / 时间留下的痕迹</span>
      <div class="playback">
        <button :aria-label="playing ? '暂停时间轴' : '播放时间轴'" @click="emit('toggle')">
          {{ playing ? 'Ⅱ 暂停' : '▷ 播放' }}</button
        ><label
          >速率
          <select
            :value="speed"
            @change="emit('speed', Number(($event.target as HTMLSelectElement).value))"
          >
            <option :value="1">1x</option>
            <option :value="2">2x</option>
          </select></label
        >
      </div>
    </div>
    <div class="filmstrip">
      <button
        v-for="(m, i) in moments"
        :key="m.id"
        :class="{ active: m.id === activeId }"
        :aria-pressed="m.id === activeId"
        @click="emit('select', m.id)"
      >
        <span class="film-photo"
          ><MemoryImage
            :src="
              contributions.find((c) => m.contributionIds.includes(c.id) && c.mediaUrl)
                ?.thumbnailUrl ??
              contributions.find((c) => m.contributionIds.includes(c.id) && c.mediaUrl)?.mediaUrl
            "
            :alt="m.title"
          /><span>{{ String(i + 1).padStart(2, '0') }}</span></span
        ><span class="film-label">{{ m.label }}</span>
      </button>
    </div>
    <input
      class="time-range"
      aria-label="拖动选择时刻"
      type="range"
      min="0"
      :max="Math.max(0, moments.length - 1)"
      step="1"
      :value="moments.findIndex((m) => m.id === activeId)"
      :aria-valuetext="moments.find((m) => m.id === activeId)?.title"
      @input="
        moments[Number(($event.target as HTMLInputElement).value)] &&
        emit('select', moments[Number(($event.target as HTMLInputElement).value)]!.id)
      "
    />
  </section>
</template>
