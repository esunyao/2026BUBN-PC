<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Contribution, MemoryData, Moment } from '../../shared/memoryTypes'
import MemoryImage from './MemoryImage.vue'
const props = defineProps<{ data: MemoryData; eventId: string }>()
const emit = defineEmits<{ jump: [c: Contribution]; moment: [id: string] }>()
const zoom = ref(1),
  pan = ref({ x: 0, y: 0 }),
  list = ref(false),
  byPerson = ref(false),
  sharedOnly = ref(false),
  selectedId = ref('')
const momentNodes = computed(() =>
  props.data.moments
    .filter((m) => props.data.scenes.some((s) => s.id === m.sceneId && s.eventId === props.eventId))
    .filter((m) => !sharedOnly.value || props.data.links.some((l) => l.momentIds.includes(m.id)))
    .map((m, i) => ({ m, x: 465, y: 45 + i * 230 })),
)
const nodes = computed(() =>
  momentNodes.value.flatMap((row) =>
    props.data.contributions
      .filter((c) => c.momentId === row.m.id)
      .filter(
        (c) => !sharedOnly.value || props.data.links.some((l) => l.contributionIds.includes(c.id)),
      )
      .map((c, i) => ({ c, x: 115 + i * 205, y: row.y + 105 })),
  ),
)
const graphHeight = computed(() => momentNodes.value.length * 230 + 30)
const selected = computed(() => nodes.value.find((n) => n.c.id === selectedId.value)?.c)
const selectedMoment = computed(() => momentNodes.value.find((n) => n.m.id === selectedId.value)?.m)
const chapterEdges = computed(() =>
  momentNodes.value.slice(1).map((node, i) => ({
    a: momentNodes.value[i]!,
    b: node,
    reason:
      momentNodes.value[i]?.m.sceneId === node.m.sceneId
        ? 'sameScene / earlierLater · 同一场景的前后时刻'
        : 'earlierLater · 同一事件的前后章节',
  })),
)
function rowFor(c: Contribution) {
  return momentNodes.value.find((row) => row.m.id === c.momentId)
}
function enterMoment(m: Moment) {
  emit('moment', m.id)
}
const edges = computed(() =>
  nodes.value.flatMap((a, i) =>
    nodes.value.slice(i + 1).flatMap((b) => {
      const same = props.data.links.find(
        (l) => l.contributionIds.includes(a.c.id) && l.contributionIds.includes(b.c.id),
      )
      const person = a.c.participantId === b.c.participantId
      const ai = props.data.moments.findIndex((m) => m.id === a.c.momentId),
        bi = props.data.moments.findIndex((m) => m.id === b.c.momentId)
      const time = !same && a.c.participantId === 'a' && b.c.participantId === 'a' && bi === ai + 1
      return same || (person && byPerson.value) || time
        ? [
            {
              a,
              b,
              reason:
                same?.reason ?? (time ? 'earlierLater · 前后时刻' : 'samePerson · 同一位记录者'),
            },
          ]
        : []
    }),
  ),
)
let drag: { x: number; y: number; px: number; py: number } | undefined
function start(e: PointerEvent) {
  if ((e.target as Element).closest('button')) return
  drag = { x: e.clientX, y: e.clientY, px: pan.value.x, py: pan.value.y }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function move(e: PointerEvent) {
  if (drag) pan.value = { x: drag.px + e.clientX - drag.x, y: drag.py + e.clientY - drag.y }
}
function reset() {
  zoom.value = 1
  pan.value = { x: 0, y: 0 }
}
function scale(delta: number) {
  zoom.value = Math.min(2.4, Math.max(0.45, zoom.value + delta))
}
const name = (c: Contribution) =>
  props.data.participants.find((p) => p.id === c.participantId)?.displayName
</script>
<template>
  <div class="constellation-tools">
    <button aria-label="缩小星图" @click="scale(-0.15)">−</button
    ><span>{{ Math.round(zoom * 100) }}%</span
    ><button aria-label="放大星图" @click="scale(0.15)">＋</button
    ><button @click="reset">复位</button
    ><label><input v-model="byPerson" type="checkbox" />按人物着色</label
    ><label><input v-model="sharedOnly" type="checkbox" />只看交汇点</label
    ><button @click="list = !list">{{ list ? '关系地图' : '节点目录' }}</button>
  </div>
  <p class="graph-hint">
    拖动空白处平移 · 滚轮缩放 · 点选相纸查看关联。连线表示手工交汇、同一人物或时间先后。
  </p>
  <div
    v-if="!list"
    class="graph-viewport"
    @pointerdown="start"
    @pointermove="move"
    @pointerup="drag = undefined"
    @pointercancel="drag = undefined"
    @wheel.prevent="scale($event.deltaY > 0 ? -0.08 : 0.08)"
  >
    <div
      class="graph-canvas"
      :style="{
        height: `${graphHeight}px`,
        transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
      }"
    >
      <svg class="graph-edges" width="1100" :height="graphHeight">
        <line
          v-for="edge in chapterEdges"
          :key="edge.b.m.id"
          :x1="edge.a.x"
          :y1="edge.a.y"
          :x2="edge.b.x"
          :y2="edge.b.y"
        >
          <title>{{ edge.reason }}</title>
        </line>
        <line
          v-for="node in nodes"
          :key="`member-${node.c.id}`"
          :x1="rowFor(node.c)?.x"
          :y1="rowFor(node.c)?.y"
          :x2="node.x"
          :y2="node.y"
        >
          <title>归属于 {{ rowFor(node.c)?.m.title }}</title>
        </line>
        <line
          v-for="(edge, i) in edges"
          :key="i"
          :x1="edge.a.x"
          :y1="edge.a.y"
          :x2="edge.b.x"
          :y2="edge.b.y"
        >
          <title>{{ edge.reason }}</title>
        </line>
      </svg>
      <button
        v-for="node in momentNodes"
        :key="node.m.id"
        class="graph-moment"
        :style="{ left: `${node.x}px`, top: `${node.y}px` }"
        :aria-pressed="selectedId === node.m.id"
        @click="selectedId = node.m.id"
      >
        {{ node.m.title }}<small>{{ node.m.label }} · MOMENT</small>
      </button>
      <button
        v-for="node in nodes"
        :key="node.c.id"
        class="graph-node"
        :class="{ selected: selectedId === node.c.id }"
        :style="{
          left: `${node.x}px`,
          top: `${node.y}px`,
          borderColor: byPerson
            ? data.participants.find((p) => p.id === node.c.participantId)?.color
            : '',
        }"
        @click="selectedId = node.c.id"
      >
        <MemoryImage :src="node.c.thumbnailUrl ?? node.c.mediaUrl" :alt="node.c.alt" /><span
          >{{ name(node.c) }} ·
          {{ data.moments.find((m) => m.id === node.c.momentId)?.label }}</span
        >
      </button>
    </div>
  </div>
  <div v-else class="node-list">
    <button v-for="row in momentNodes" :key="row.m.id" @click="selectedId = row.m.id">
      时刻 · {{ row.m.label }} · {{ row.m.title }}
    </button>
    <button v-for="node in nodes" :key="node.c.id" @click="selectedId = node.c.id">
      {{ name(node.c) }} · {{ data.moments.find((m) => m.id === node.c.momentId)?.title }} —
      {{ node.c.alt }}
    </button>
  </div>
  <div v-if="selected" class="graph-summary" aria-live="polite">
    <p>
      {{ name(selected) }} · {{ selected.isDemo ? '样例文字' : '原文' }}：{{
        selected.writtenText || '没有留下文字。'
      }}
    </p>
    <button class="primary" @click="emit('jump', selected)">走进这段记忆 ↗</button>
  </div>
  <div v-else-if="selectedMoment" class="graph-summary" aria-live="polite">
    <p>
      {{ selectedMoment.title }} · {{ selectedMoment.label }} ·
      {{ selectedMoment.contributionIds.length }} 份记录
    </p>
    <button class="primary" @click="enterMoment(selectedMoment)">返回这个时刻 ↗</button>
  </div>
  <p v-else class="graph-summary">
    {{ momentNodes.length }} 个时刻，{{ nodes.length }} 段记忆，相互连结。选择相纸或时刻开始探索。
  </p>
</template>
