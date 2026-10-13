<script setup lang="ts">
import type { Photo } from '../../shared/types'
import BaseButton from '../../shared/ui/BaseButton.vue'
defineProps<{
  progress: number
  duration: number
  isPlaying: boolean
  photo: Photo | null
  photoCount: number
}>()
const emit = defineEmits<{ toggle: []; seek: [value: number] }>()
function clock(value: number) {
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
}
function captured(photo: Photo) {
  return photo.capturedAt === undefined
    ? '时间未知'
    : new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(photo.capturedAt)
}
</script>

<template>
  <section class="replay-bar panel" aria-label="旅行回放">
    <BaseButton
      variant="primary"
      class="play-button"
      :disabled="photoCount === 0"
      :aria-label="isPlaying ? '暂停回放' : '播放回放'"
      @click="emit('toggle')"
      >{{ isPlaying ? 'Ⅱ' : '▶' }}</BaseButton
    >
    <div class="replay-description">
      <strong>重走这段旅程</strong><span>{{ photo ? captured(photo) : '选择旅伴，开始回放' }}</span>
    </div>
    <div class="replay-track">
      <div class="replay-label">
        <span>{{ clock(progress) }}</span
        ><span>{{ photoCount }} 张回忆 · {{ clock(duration) }}</span>
      </div>
      <input
        aria-label="回放进度"
        type="range"
        min="0"
        :max="duration"
        step="0.1"
        :value="progress"
        :disabled="photoCount === 0"
        @input="emit('seek', Number(($event.target as HTMLInputElement).value))"
      />
    </div>
    <div class="replay-note">把一天，<br />再过一遍。</div>
  </section>
</template>

<style scoped>
.replay-bar {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 17px 22px;
}
.play-button {
  width: 44px;
  height: 44px;
  padding: 0;
  font-size: 18px;
}
.replay-description {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 142px;
}
.replay-description strong {
  font-size: 14px;
}
.replay-description span {
  color: var(--muted);
  font-size: 11px;
}
.replay-track {
  flex: 1;
  min-width: 60px;
}
.replay-label {
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  font-size: 11px;
  margin-bottom: 7px;
  font-variant-numeric: tabular-nums;
}
input {
  display: block;
  width: 100%;
  accent-color: var(--accent);
  cursor: pointer;
  height: 12px;
}
.replay-note {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.7;
  padding-left: 16px;
  border-left: 1px solid var(--border);
}
@media (max-width: 640px) {
  .replay-bar {
    padding: 13px;
    gap: 12px;
    flex-wrap: wrap;
  }
  .replay-description {
    flex: 1;
  }
  .replay-track {
    flex-basis: 100%;
    order: 3;
  }
  .replay-note {
    display: none;
  }
}
</style>
