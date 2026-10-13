<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { MemoryData, Contribution } from '../../shared/memoryTypes'
import type { DiscoveryFeedback, DiscoveryFinding, DiscoveryType } from './types'
import MemoryImage from '../hero/MemoryImage.vue'
import MemoryDialog from '../hero/MemoryDialog.vue'
import PerspectiveExperience from '../hero/PerspectiveExperience.vue'
import ThenAndNow from '../hero/ThenAndNow.vue'
const props = defineProps<{
  requestedId?: string
  data: MemoryData
  findings: DiscoveryFinding[]
  selected?: DiscoveryFinding
  viewerId: string
  accountId?: string
  readOnly?: boolean
  eventId: string
  feedback: Record<string, DiscoveryFeedback>
  hidden: boolean
}>()
const emit = defineEmits<{
  viewer: [id: string]
  select: [id: string]
  close: []
  back: []
  mark: [f: DiscoveryFinding, action: 'confirm' | 'hide' | 'favorite' | 'restore']
  hidden: []
  jump: [c: Contribution]
  save: [
    f: DiscoveryFinding,
    text: string,
    mood: string,
    visibility: 'private' | 'event-members',
    id?: string,
  ]
  remove: [id: string]
  supplement: [f: DiscoveryFinding, text: string, mood: string]
}>()
const supplementOpen = ref(false)
const type = ref<DiscoveryType | ''>(''),
  sceneId = ref(''),
  personId = ref(''),
  why = ref(false),
  mode = ref<'own' | 'other' | 'both'>('both')
const text = ref(''),
  mood = ref(''),
  visibility = ref<'private' | 'event-members'>('event-members'),
  editId = ref('')
const types: Array<[DiscoveryType, string]> = [
  ['unseen_moment', '与你有关'],
  ['shared_moment', '交汇时刻'],
  ['missing_piece', '尚未讲述'],
  ['then_now', '时光变化'],
  ['behind_spotlight', '其他线索'],
]
const event = computed(() => props.data.events.find((e) => e.id === props.eventId))
const visible = computed(() =>
  props.findings.filter(
    (f) =>
      (!type.value || f.type === type.value) &&
      (!sceneId.value || f.sceneIds.includes(sceneId.value)) &&
      (!personId.value || f.participantIds.includes(personId.value)),
  ),
)
const evidence = computed(() =>
  (props.selected?.evidenceIds ?? [])
    .map((id) => props.data.contributions.find((c) => c.id === id))
    .filter((c): c is Contribution => !!c),
)
const photoEvidence = computed(() => evidence.value.filter((c) => c.kind === 'photo'))
const own = computed(
  () =>
    photoEvidence.value.find((c) => c.participantId === props.viewerId) ?? photoEvidence.value[0],
)
const other = computed(() =>
  photoEvidence.value.find((c) => c.participantId !== own.value?.participantId),
)
const activePhoto = computed(() =>
  mode.value === 'other' ? (other.value ?? own.value) : own.value,
)
const notes = computed(() => evidence.value.filter((c) => c.kind === 'note'))
const name = (c: Contribution) =>
  props.data.participants.find((p) => p.id === c.participantId)?.displayName
function resetComposer() {
  text.value = ''
  mood.value = ''
  editId.value = ''
  visibility.value = 'event-members'
}
watch(
  () => [props.selected?.id, props.viewerId],
  () => {
    supplementOpen.value = false
    why.value = false
    mode.value = 'both'
    resetComposer()
  },
)
function edit(c: Contribution) {
  editId.value = c.id
  text.value = c.writtenText ?? ''
  mood.value = c.mood[0] ?? ''
  visibility.value = c.visibility === 'private' ? 'private' : 'event-members'
}
function save() {
  if (props.selected && text.value.trim() && text.value.length <= 500) {
    emit(
      'save',
      props.selected,
      text.value,
      mood.value,
      visibility.value,
      editId.value || undefined,
    )
    resetComposer()
  }
}
function supplement() {
  if (props.selected && text.value.trim()) {
    emit('supplement', props.selected, text.value, mood.value)
    resetComposer()
  }
}
function next() {
  const index = props.findings.findIndex((f) => f.id === props.selected?.id)
  const f = props.findings[(index + 1) % props.findings.length]
  if (f) emit('select', f.id)
}
function shares(f: DiscoveryFinding) {
  return new Set(
    f.evidenceIds
      .map((id) => props.data.contributions.find((c) => c.id === id))
      .filter((c) => c?.kind === 'note')
      .map((c) => c!.participantId),
  ).size
}
</script>
<template>
  <section class="discover-page" :inert="!!selected">
    <button class="text-link" @click="emit('back')">← 返回原来的记忆</button>
    <p v-if="requestedId && !selected" class="muted" role="status">
      这条发现当前不可查看，可能已失效、被隐藏或不属于当前可见范围。<button
        class="text-link"
        @click="emit('close')"
      >
        返回发现目录
      </button>
    </p>
    <div class="discover-intro">
      <span class="eyebrow">MEMORY DISCOVERY / 记忆发现</span>
      <h1>在这段经历里，<br />还有另一段故事。</h1>
      <p>
        {{ event?.title }} ·
        {{ findings.filter((f) => f.status !== 'dismissed').length }}
        条可见发现。<br />照片与原文在前，关联与依据在后。
      </p>
    </div>
    <div class="discovery-filters">
      <label
        >当前身份<select disabled
          :value="viewerId"
          @change="emit('viewer', ($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="p in data.participants.filter((p) => event?.participantIds.includes(p.id))"
            :key="p.id"
            :value="p.id"
          >
            {{ p.displayName }}
          </option>
        </select></label
      ><label
        >场景<select v-model="sceneId">
          <option value="">全部场景</option>
          <option
            v-for="s in data.scenes.filter((s) => s.eventId === eventId)"
            :key="s.id"
            :value="s.id"
          >
            {{ s.title }}
          </option>
        </select></label
      ><label
        >记录者<select v-model="personId">
          <option value="">所有人</option>
          <option
            v-for="p in data.participants.filter((p) => event?.participantIds.includes(p.id))"
            :key="p.id"
            :value="p.id"
          >
            {{ p.displayName }}
          </option>
        </select></label
      ><button @click="emit('hidden')">
        {{ hidden ? '隐藏已忽略的发现' : '查看已忽略 / 恢复' }}
      </button>
    </div>
    <div class="discovery-tabs">
      <button :aria-pressed="!type" @click="type = ''">全部发现</button
      ><button
        v-for="[id, title] in types"
        :key="id"
        :aria-pressed="type === id"
        @click="type = id"
      >
        {{ title }} <small>{{ findings.filter((f) => f.type === id).length }}</small>
      </button>
    </div>
    <p v-if="!visible.length" class="discovery-empty">
      这里还没有符合条件的发现。添加可信的时间记录或邀请参与者留下原文；没有记录不等于没有故事。
    </p>
    <div class="discovery-shelf">
      <article v-for="f in visible" :key="f.id" class="discovery-card">
        <button class="discovery-cover" @click="emit('select', f.id)">
          <MemoryImage
            :src="
              data.contributions.find((c) => c.id === f.evidenceIds[0])?.thumbnailUrl ??
              data.contributions.find((c) => c.id === f.evidenceIds[0])?.mediaUrl
            "
            :alt="f.title"
          /><span v-if="f.type === 'missing_piece'" class="gap-paper"
            >{{ shares(f) ? `${shares(f)} 人分享了记忆` : '未记录片段'
            }}<small>照片缺席，不等于记忆缺席。</small></span
          ></button
        ><span class="eyebrow"
          >{{ f.timeRange?.start?.slice(0, 16).replace('T', ' ') }} ·
          {{ types.find((t) => t[0] === f.type)?.[1] }} /
          {{ f.provenance === 'demo' ? 'DEMO · 规则发现' : '规则 / 用户记录' }}</span
        >
        <h2>
          <button @click="emit('select', f.id)">{{ f.title }} ↗</button>
        </h2>
        <p>{{ f.description }}</p>
        <footer>
          <span
            >{{ data.scenes.find((s) => s.id === f.sceneIds[0])?.title }} ·
            {{
              f.status === 'dismissed' ? '已忽略' : f.status === 'confirmed' ? '已确认' : '建议'
            }}</span
          ><button @click="emit('select', f.id)">查看照片与依据</button>
        </footer>
      </article>
    </div>
    <p class="muted">
      当前没有人脸识别或远程 AI。演示阶段标签是手工标注；真实上传使用 EXIF
      或用户指定的时间。时间空白只在同一天、有界范围和可信记录之间提示，采用 Asia/Shanghai 时区。
    </p>
  </section>
  <MemoryDialog v-if="selected" :title="selected.title" @close="emit('close')"
    ><div class="finding-controls">
      <button @click="emit('mark', selected, 'favorite')">
        {{ feedback[`${viewerId}:${selected.id}`]?.favorite ? '已收藏' : '收藏这条发现' }}</button
      ><button
        @click="emit('mark', selected, selected.status === 'dismissed' ? 'restore' : 'hide')"
      >
        {{ selected.status === 'dismissed' ? '重新展示' : '隐藏 / 这段没什么可补充' }}</button
      ><button @click="emit('mark', selected, 'confirm')">确认关联</button
      ><button @click="next">下一条发现 →</button>
    </div>
    <template v-if="selected.type === 'missing_piece'"
      ><p class="mode-intro">
        {{ selected.timeRange?.start?.slice(0, 16).replace('T', ' ') }} —
        {{ selected.timeRange?.end?.slice(11, 16) }} ·
        {{ selected.timeRange?.source === 'demo' ? '演示时间范围' : '记录时间范围' }}
      </p>
      <div class="gap-context">
        <figure v-for="c in photoEvidence" :key="c.id">
          <MemoryImage :src="c.thumbnailUrl ?? c.mediaUrl" :alt="c.alt" />
          <figcaption>
            {{ name(c) }} · {{ data.moments.find((m) => m.id === c.momentId)?.label }}
          </figcaption>
        </figure>
      </div>
      <h3 class="gap-question">这段时间有什么是你还记得的吗？</h3>
      <form class="gap-composer" @submit.prevent="save">
        <label
          >你的原文（1–500 字）<textarea
            v-model="text"
            rows="4"
            maxlength="500"
            required
            placeholder="不预设发生过什么，只写你想留下的记忆。"
          />
        </label>
        <div class="form-row">
          <label
            >可选心情<select v-model="mood">
              <option value="">不标记</option>
              <option>平静</option>
              <option>开心</option>
              <option>期待</option>
              <option>感动</option>
            </select></label
          ><label
            >可见范围<select v-model="visibility">
              <option value="event-members">事件参与者可见</option>
              <option value="private">仅当前身份可见</option>
            </select></label
          >
        </div>
        <p class="muted">
          当前作者：{{
            data.participants.find((p) => p.id === viewerId)?.displayName
          }}。保存和编辑权限按登录账号校验。
        </p>
        <div>
          <button class="primary" :disabled="!text.trim() || readOnly">
            {{ editId ? '保存我的修改' : '留下我的原文' }}</button
          ><button type="button" class="text-link" @click="resetComposer">撤销输入</button>
        </div>
      </form>
      <div class="gap-notes">
        <blockquote v-for="c in notes" :key="c.id">
          <p>{{ c.writtenText }}</p>
          <footer>
            {{ name(c) }} · 用户原文 · {{ c.mood.join('、') }} ·
            {{ c.visibility === 'private' ? '私密' : '参与者可见'
            }}<template v-if="c.ownerUserId === accountId && !readOnly"
              ><button @click="edit(c)">编辑我的文字</button
              ><button @click="emit('remove', c.id)">删除我的文字</button></template
            >
          </footer>
        </blockquote>
      </div></template
    >
    <ThenAndNow
      v-else-if="selected.type === 'then_now' && data.pairs.find((p) => p.id === selected?.pairId)"
      :data="data"
      :pair="data.pairs.find((p) => p.id === selected?.pairId)!"
    />
    <template v-else-if="activePhoto"
      ><div class="unseen-modes">
        <button :aria-pressed="mode === 'own'" @click="mode = 'own'">{{ name(own!) }} 看见的</button
        ><button :aria-pressed="mode === 'other'" @click="mode = 'other'">
          {{ other ? name(other) : '另一人' }} 拍下的</button
        ><button :aria-pressed="mode === 'both'" @click="mode = 'both'">两人并看</button>
      </div>
      <PerspectiveExperience
        :data="data"
        :active="activePhoto"
        :link="{
          id: selected.id,
          momentIds: [],
          contributionIds: selected.evidenceIds,
          relation: 'sameEvent',
          reason: selected.reason,
          confidence: 0,
        }"
        :shared="mode === 'both'"
        :person-id="other?.participantId ?? ''"
        :quote="false"
        :pointer="{ x: 0, y: 0 }"
        hide-confidence
        read-only
        @share="mode = 'both'"
        @back="mode = 'own'"
    /></template>
    <form
      v-if="selected.type !== 'missing_piece'"
      class="gap-composer finding-supplement"
      @submit.prevent="supplement"
    >
      <button type="button" class="text-link" @click="supplementOpen = !supplementOpen">
        我想补充这一刻的故事 ↓</button
      ><template v-if="supplementOpen"
        ><label
          >你的原文（1–500 字）<textarea v-model="text" maxlength="500" rows="3" required /></label
        ><button class="primary" :disabled="!text.trim() || readOnly">保存我的补充</button></template
      >
    </form>
    <div class="finding-evidence">
      <button class="text-link" :aria-expanded="why" @click="why = !why">
        {{ why ? '收起依据' : '为什么发现 · 查看证据' }} ↓
      </button>
      <div v-if="why">
        <p>{{ selected.reason }}</p>
        <p>
          规则层级：{{ selected.confidenceBand }} · {{ selected.detectorId }} ·
          {{ selected.reasonCodes.join(' / ') }}
        </p>
        <article v-for="c in evidence" :key="c.id">
          <strong>{{ name(c) }} · {{ c.isDemo ? 'Demo 素材' : '用户贡献' }}</strong>
          <p>{{ c.writtenText || '没有文字注释。' }}</p>
          <small
            >素材 {{ c.id }} · {{ c.timeEvidence?.source ?? '未知来源' }} ·
            {{ c.timeEvidence?.start ?? '时间未知' }} · {{ c.timeEvidence?.precision ?? 'unknown'
            }}{{
              c.tagsConsent && c.participantTags?.includes(viewerId) ? ' · 用户同意的身份标注' : ''
            }}</small
          ><button @click="emit('jump', c)">查看原始记忆 ↗</button>
        </article>
      </div>
    </div>
  </MemoryDialog>
</template>
