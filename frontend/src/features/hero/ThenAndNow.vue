<script setup lang="ts">
import { ref } from 'vue'
import type { Contribution, MemoryData, ThenNowPair } from '../../shared/memoryTypes'
import MemoryImage from './MemoryImage.vue'
const props = defineProps<{ pair: ThenNowPair; data: MemoryData }>()
const position = ref(50)
const find = (id: string) => props.data.contributions.find((c) => c.id === id)
const author = (c?: Contribution) =>
  props.data.participants.find((p) => p.id === c?.participantId)?.displayName
const time = (c?: Contribution) =>
  c?.timeEvidence?.precision !== 'unknown' && c?.timeEvidence?.start
    ? new Date(c.timeEvidence.start).toLocaleString('zh-CN')
    : '时间待确认'
</script>
<template>
  <p class="mode-intro">
    {{
      pair.comparisonMode === 'sideBySide'
        ? '不同角度的记录，用并排对照看见变化。' +
          (find(pair.beforeContributionId)?.isDemo || find(pair.afterContributionId)?.isDemo
            ? '素材包含示例，并非同一地点的实拍证据。'
            : '由用户手动建立关联；未知时间不作为时间演变证据。')
        : '拖动分界，查看同一构图在两个时刻的变化。'
    }}
  </p>
  <div v-if="pair.comparisonMode === 'sideBySide'" class="comparison-grid">
    <figure v-for="(id, i) in [pair.beforeContributionId, pair.afterContributionId]" :key="id">
      <MemoryImage :src="find(id)?.mediaUrl" :alt="find(id)?.alt ?? ''" eager />
      <figcaption>
        <span class="eyebrow">{{ i ? 'NOW / 今日' : 'THEN / 昨日' }}</span>
        <h3>{{ time(find(id)) }}</h3>
        <p>{{ author(find(id)) }} · {{ find(id)?.isDemo ? '样例文字' : '原文' }}</p>
        <blockquote>{{ find(id)?.writtenText }}</blockquote>
      </figcaption>
    </figure>
  </div>
  <div v-else>
    <div class="wipe-comparison">
      <MemoryImage
        :src="find(pair.afterContributionId)?.mediaUrl"
        :alt="find(pair.afterContributionId)?.alt ?? ''"
        eager
      />
      <div class="wipe-before" :style="{ clipPath: `inset(0 ${100 - position}% 0 0)` }">
        <MemoryImage
          :src="find(pair.beforeContributionId)?.mediaUrl"
          :alt="find(pair.beforeContributionId)?.alt ?? ''"
          eager
        />
      </div>
      <div class="wipe-divider" :style="{ left: `${position}%` }"><span>↔</span></div>
      <input
        v-model.number="position"
        class="wipe-input"
        type="range"
        min="0"
        max="100"
        aria-label="昨日与今日分界位置"
        :aria-valuetext="`${position}% 昨日`"
      />
    </div>
    <div class="wipe-labels">
      <p>
        {{ time(find(pair.beforeContributionId)) }} · {{ author(find(pair.beforeContributionId)) }}
      </p>
      <p>
        {{ time(find(pair.afterContributionId)) }} · {{ author(find(pair.afterContributionId)) }}
      </p>
    </div>
  </div>
</template>
