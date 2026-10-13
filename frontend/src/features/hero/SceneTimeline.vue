<script setup lang="ts">
import type { DiscoveryFinding } from '../discovery/types'
import type { Contribution, Moment } from '../../shared/memoryTypes'
import MemoryImage from './MemoryImage.vue'
defineProps<{
  findings?: DiscoveryFinding[]
  moments: Moment[]
  contributions: Contribution[]
  activeId: string
  playing: boolean
  speed: number
}>()
const emit = defineEmits<{
  select: [id: string]
  toggle: []
  speed: [speed: number]
  discover: [id: string]
}>()
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
      <template v-for="(m, i) in moments" :key="m.id"
        ><button
          :class="{ active: m.id === activeId }"
          :aria-pressed="m.id === activeId"
          @click="emit('select', m.id)"
        >
          <span class="film-photo"
            ><span v-if="m.originGapId" class="text-film"
              >文字记忆<br />{{
                contributions.filter((c) => c.momentId === m.id).length
              }}
              份原文</span
            ><MemoryImage
              v-else
              :src="
                contributions.find((c) => m.contributionIds.includes(c.id) && c.mediaUrl)
                  ?.thumbnailUrl ??
                contributions.find((c) => m.contributionIds.includes(c.id) && c.mediaUrl)?.mediaUrl
              "
              :alt="m.title"
            /><span>{{ String(i + 1).padStart(2, '0') }}</span></span
          ><span class="film-label">{{ m.label }}</span></button
        ><button
          v-for="gap in (findings ?? []).filter(
            (f) =>
              f.type === 'missing_piece' &&
              f.originMomentIds?.[0] === m.id &&
              !moments.some((m) => m.originGapId === f.gapId),
          )"
          :key="gap.id"
          class="gap-film"
          @click="emit('discover', gap.id)"
        >
          <span>未记录片段</span
          ><small
            >{{ gap.timeRange?.start?.slice(11, 16) }}—{{
              gap.timeRange?.end?.slice(11, 16)
            }}</small
          >
        </button></template
      >
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
