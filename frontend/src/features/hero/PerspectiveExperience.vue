<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Contribution, MemoryData, SharedMomentLink } from '../../shared/memoryTypes'
import MemoryImage from './MemoryImage.vue'
const props = defineProps<{
  data: MemoryData
  active: Contribution
  link?: SharedMomentLink
  shared: boolean
  personId: string
  quote: boolean
  pointer: { x: number; y: number }
}>()
const emit = defineEmits<{ share: []; person: [id: string]; back: []; edit: [] }>()
const zoomed = ref('')
const linked = computed(() =>
  (props.link?.contributionIds ?? [])
    .map((id) => props.data.contributions.find((c) => c.id === id))
    .filter(
      (c): c is Contribution =>
        !!c && c.kind === 'photo' && c.participantId !== props.active.participantId,
    ),
)
const people = computed(() =>
  props.data.participants.filter((p) => linked.value.some((c) => c.participantId === p.id)),
)
const name = (c: Contribution) =>
  props.data.participants.find((p) => p.id === c.participantId)?.displayName
const moment = (c: Contribution) => props.data.moments.find((m) => m.id === c.momentId)
function back() {
  zoomed.value = ''
  emit('back')
}
function change(id: string) {
  zoomed.value = ''
  emit('person', id)
}
</script>
<template>
  <div class="perspective-experience" :class="{ comparing: shared, zooming: zoomed }">
    <div class="perspective-toolbar">
      <p class="mode-intro">
        {{
          shared
            ? `${link?.reason} · 关联可信度 ${Math.round((link?.confidence ?? 0) * 100)}%（演示规则）`
            : `${moment(active)?.label} / ${name(active)}`
        }}
      </p>
      <div v-if="shared" class="shared-switch">
        <span>与谁交汇</span
        ><button
          v-for="p in people"
          :key="p.id"
          :aria-pressed="personId === p.id"
          @click="change(p.id)"
        >
          {{ p.displayName }}</button
        ><button class="text-link" @click="back">← 返回原视角</button>
      </div>
    </div>
    <div class="perspective-stage">
      <figure
        class="perspective-card primary-perspective"
        :class="{ enlarged: zoomed === active.id, hidden: zoomed && zoomed !== active.id }"
      >
        <button
          :aria-label="shared ? `放大 ${name(active)} 的视角` : '进入其他人的视角'"
          :disabled="!shared && !link"
          :style="
            !shared
              ? { transform: `rotateY(${pointer.x * 2}deg) rotateX(${-pointer.y * 2}deg)` }
              : {}
          "
          @click="shared ? (zoomed = zoomed === active.id ? '' : active.id) : emit('share')"
        >
          <MemoryImage :src="active.mediaUrl" :alt="active.alt" eager />
        </button>
        <figcaption class="perspective-caption">
          <span class="eyebrow">{{ name(active) }} / {{ moment(active)?.label }}</span>
          <blockquote>{{ active.writtenText || '这张照片，没有留下文字。' }}</blockquote>
          <small>{{ active.isDemo ? '样例文字 · 图库摄影为叙事演示' : '用户原文' }}</small
          ><template v-if="!shared"
            ><button v-if="link" class="primary" @click="emit('share')">
              这一刻，还有另一双眼睛 ↗
            </button>
            <p v-if="active.gps" class="muted">
              原始 EXIF 位置：{{ active.gps.latitude.toFixed(4) }},
              {{ active.gps.longitude.toFixed(4) }}
            </p>
            <p v-if="active.capturedAt" class="muted">
              原始拍摄时间：{{ new Date(active.capturedAt).toLocaleString() }}
            </p>
            <button class="text-link" @click="emit('edit')">编辑这段记忆</button></template
          >
        </figcaption>
      </figure>
      <figure
        v-for="c in linked.filter(
          (c, i, array) => array.findIndex((p) => p.participantId === c.participantId) === i,
        )"
        :key="c.id"
        class="perspective-card companion-perspective"
        :class="{
          present: shared && c.participantId === personId,
          enlarged: zoomed === c.id,
          hidden: zoomed && zoomed !== c.id,
        }"
        :inert="!shared || c.participantId !== personId"
        :aria-hidden="!shared || c.participantId !== personId"
      >
        <button
          :aria-label="`放大 ${name(c)} 的视角`"
          @click="zoomed = zoomed === c.id ? '' : c.id"
        >
          <MemoryImage :src="c.mediaUrl" :alt="c.alt" eager />
        </button>
        <figcaption class="perspective-caption">
          <span class="eyebrow">{{ name(c) }} / {{ moment(c)?.label }}</span>
          <blockquote>{{ c.writtenText }}</blockquote>
          <small>{{ c.isDemo ? '样例文字' : '用户原文' }}</small>
        </figcaption>
      </figure>
    </div>
    <p v-if="shared && quote" class="discovery-quote">
      {{
        data.events.find((e) => e.sceneIds.includes(moment(active)?.sceneId ?? ''))?.type ===
        'longActivity'
          ? '同一场演出，我们记住了不同的世界。'
          : '同一场旅行，我们记住了不同的世界。'
      }}
    </p>
  </div>
</template>
<style scoped>
.perspective-stage {
  position: relative;
  min-height: 440px;
  perspective: 1400px;
}
.perspective-card {
  transition:
    width 0.75s cubic-bezier(0.22, 0.75, 0.2, 1),
    transform 0.75s cubic-bezier(0.22, 0.75, 0.2, 1),
    opacity 0.5s;
  position: relative;
}
.perspective-card > button {
  width: 100%;
  padding: 9px;
  background: var(--paper);
  box-shadow: 0 12px 35px #49331e22;
  cursor: zoom-in;
  transition: transform 0.5s;
}
.perspective-card > button:disabled {
  opacity: 1;
  cursor: default;
}
.perspective-card .memory-image {
  aspect-ratio: 3/2;
  height: auto;
}
.primary-perspective {
  width: 62%;
  z-index: 2;
}
.perspective-caption {
  padding: 22px 7px;
  line-height: 1.8;
}
.perspective-caption blockquote {
  font-size: 21px;
  margin: 15px 0;
}
.perspective-caption small {
  font-size: 9px;
  color: var(--muted);
}
.perspective-caption .text-link {
  display: block;
  margin-top: 20px;
}
.primary-perspective > .perspective-caption {
  position: absolute;
  width: 53%;
  left: 108%;
  top: 20%;
  padding: 0;
}
.primary-perspective > .perspective-caption .primary {
  display: block;
  margin-top: 25px;
}
.companion-perspective {
  position: absolute;
  right: 0;
  top: 0;
  width: 48%;
  opacity: 0;
  transform: translate(70px, 15px) translateZ(-100px) scale(0.88);
  pointer-events: none;
}
.companion-perspective.present {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}
.comparing .primary-perspective {
  width: 48%;
}
.comparing .primary-perspective > .perspective-caption {
  position: static;
  width: 100%;
  padding: 22px 7px;
  animation: caption 0.7s 0.5s both;
}
.companion-perspective.present .perspective-caption {
  animation: caption 0.7s 0.65s both;
}
.perspective-card.enlarged {
  width: 100%;
  z-index: 5;
}
.perspective-card.hidden {
  opacity: 0;
  pointer-events: none;
}
.zooming .perspective-stage {
  min-height: 660px;
}
.zooming .perspective-card.enlarged .memory-image {
  max-height: 60vh;
  aspect-ratio: auto;
  height: 60vh;
}
.perspective-toolbar {
  min-height: 35px;
}
.comparing .perspective-toolbar {
  min-height: 85px;
}
@keyframes caption {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (max-width: 700px) {
  .perspective-stage {
    min-height: 480px;
  }
  .primary-perspective,
  .comparing .primary-perspective {
    width: 100%;
  }
  .primary-perspective > .perspective-caption {
    position: static;
    width: 100%;
    padding: 22px 7px;
  }
  .companion-perspective {
    position: absolute;
    top: 0;
    width: 100%;
    transform: translateY(70px) scale(0.9);
  }
  .companion-perspective.present {
    position: relative;
    margin-top: 20px;
  }
  .comparing .perspective-stage {
    min-height: 0;
  }
  .perspective-caption blockquote {
    font-size: 19px;
  }
  .perspective-toolbar,
  .comparing .perspective-toolbar {
    min-height: 0;
  }
  .zooming .perspective-card.hidden {
    display: none;
  }
  .zooming .perspective-stage {
    min-height: 0;
  }
  .zooming .perspective-card.enlarged .memory-image {
    height: 38vh;
  }
}
</style>
