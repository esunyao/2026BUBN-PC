<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type {
  MemoryData,
  MemoryManagementAction,
  EnvironmentPreset,
  EnvironmentRecipe,
  Contribution,
} from '../../shared/memoryTypes'
import MemoryImage from './MemoryImage.vue'
const props = defineProps<{
  data: MemoryData
  eventId: string
  viewerId: string
  canUndo: boolean
  error: string
}>()
const emit = defineEmits<{
  save: [action: MemoryManagementAction]
  viewer: [id: string]
  undo: []
}>()
const chapter = computed(() => props.data.events.find((e) => e.id === props.eventId)!)
const people = computed(() =>
  props.data.participants.filter((p) => chapter.value.participantIds.includes(p.id)),
)
const scenes = computed(() => props.data.scenes.filter((s) => s.eventId === props.eventId))
const moments = computed(() =>
  props.data.moments.filter((m) => scenes.value.some((s) => s.id === m.sceneId) && !m.originGapId),
)
const records = computed(() =>
  props.data.contributions.filter((c) => moments.value.some((m) => m.id === c.momentId)),
)
const own = computed(() => records.value.filter((c) => c.participantId === props.viewerId))
const tab = ref('chapter')
const chapterForm = reactive({ title: chapter.value.title, subtitle: chapter.value.subtitle })
const person = reactive({ id: '', name: '', color: '#6b8070' })
const scene = reactive({ id: '', title: '', subtitle: '', preset: 'neutral' as EnvironmentPreset })
const moment = reactive({
  id: '',
  sceneId: scenes.value[0]?.id ?? '',
  title: '',
  startAt: '',
  lighting: 'overcast' as EnvironmentRecipe['lighting'],
})
const record = reactive({
  id: '',
  momentId: '',
  text: '',
  generatedCaption: '',
  objects: '',
  phase: '',
  visibility: 'event-members' as NonNullable<Contribution['visibility']>,
  participantTags: [] as string[],
  tagsConsent: false,
  time: '',
})
const pair = reactive({ sceneId: scenes.value[0]?.id ?? '', before: '', after: '', aligned: false })
const pairPhotos = computed(() =>
  records.value.filter(
    (c) =>
      c.kind === 'photo' &&
      moments.value.find((m) => m.id === c.momentId)?.sceneId === pair.sceneId,
  ),
)
const pairs = computed(() =>
  props.data.pairs.filter((p) => scenes.value.some((s) => s.id === p.sceneId)),
)
const current = computed(() => own.value.find((c) => c.id === record.id))
const localDate = (iso?: string) => {
  if (!iso || !Number.isFinite(Date.parse(iso))) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function pickPerson(id: string) {
  const p = people.value.find((p) => p.id === id)
  Object.assign(person, { id, name: p?.displayName ?? '', color: p?.color ?? '#6b8070' })
}
function pickScene(id: string) {
  const s = scenes.value.find((s) => s.id === id)
  Object.assign(scene, {
    id,
    title: s?.title ?? '',
    subtitle: s?.subtitle ?? '',
    preset: s?.environment.preset ?? 'neutral',
  })
}
function pickMoment(id: string) {
  const m = moments.value.find((m) => m.id === id)
  Object.assign(moment, {
    id,
    sceneId: m?.sceneId ?? scenes.value[0]?.id ?? '',
    title: m?.title ?? '',
    startAt: localDate(m?.startAt),
    lighting: m?.lighting ?? 'overcast',
  })
}
function pickRecord(id: string) {
  const c = own.value.find((c) => c.id === id)
  Object.assign(record, {
    id,
    momentId: c?.momentId ?? '',
    text: c?.writtenText ?? '',
    generatedCaption: c?.generatedCaption ?? '',
    objects: c?.analysis?.objects.join('，') ?? '',
    phase: c?.analysis?.phaseTags?.[0] ?? '',
    visibility: c?.visibility ?? 'event-members',
    participantTags: c?.participantTags ?? [],
    tagsConsent: c?.tagsConsent ?? false,
    time: localDate(c?.timeEvidence?.start),
  })
}
watch(
  () => props.viewerId,
  () => pickRecord(''),
)
watch(
  () => props.canUndo,
  (value) => {
    if (!value) {
      chapterForm.title = chapter.value.title
      chapterForm.subtitle = chapter.value.subtitle
      pickScene(scene.id)
      pickMoment(moment.id)
      pickRecord(record.id)
    }
  },
)
function removeRecord() {
  emit('save', { type: 'remove-record', id: record.id })
  pickRecord('')
}
function resetPair() {
  pair.before = ''
  pair.after = ''
}
const name = (c: Contribution) =>
  `${props.data.participants.find((p) => p.id === c.participantId)?.displayName} · ${props.data.moments.find((m) => m.id === c.momentId)?.label} · ${c.alt}`
</script>
<template>
  <div class="memory-manager">
    <p class="mode-intro">整理已经生成的篇章。记录者切换用于本机体验；云端账号权限尚未接入。</p>
    <div class="manager-toolbar">
      <label
        >当前记录者<select
          :value="viewerId"
          @change="emit('viewer', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="p in people" :key="p.id" :value="p.id">{{ p.displayName }}</option>
        </select></label
      ><button :disabled="!canUndo" @click="emit('undo')">撤销上一步</button>
    </div>
    <nav class="manager-tabs" aria-label="整理功能">
      <button
        v-for="[id, label] in [
          ['chapter', '篇章与人物'],
          ['scene', '事件与时刻'],
          ['record', '我的照片与文字'],
          ['pair', '昨日与今日'],
        ]"
        :key="id"
        :aria-pressed="tab === id"
        @click="tab = id!"
      >
        {{ label }}
      </button>
    </nav>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div v-if="tab === 'chapter'">
      <form
        class="memory-editor"
        @submit.prevent="emit('save', { type: 'chapter', ...chapterForm })"
      >
        <label>篇章标题<input v-model="chapterForm.title" required maxlength="100" /></label
        ><label>篇章简介<textarea v-model="chapterForm.subtitle" maxlength="1000" rows="3" /></label
        ><button class="primary">保存篇章</button>
      </form>
      <form class="memory-editor" @submit.prevent="emit('save', { type: 'person', ...person })">
        <h3>同行的人</h3>
        <label
          >选择人物<select
            :value="person.id"
            @change="pickPerson(($event.target as HTMLSelectElement).value)"
          >
            <option value="">＋ 添加记录者</option>
            <option v-for="p in people" :key="p.id" :value="p.id">{{ p.displayName }}</option>
          </select></label
        ><label>显示名称<input v-model="person.name" required maxlength="100" /></label
        ><label>人物颜色<input v-model="person.color" type="color" /></label
        ><button class="primary">保存人物</button>
      </form>
    </div>
    <div v-else-if="tab === 'scene'">
      <form class="memory-editor" @submit.prevent="emit('save', { type: 'scene', ...scene })">
        <label
          >选择事件<select
            :value="scene.id"
            @change="pickScene(($event.target as HTMLSelectElement).value)"
          >
            <option value="">＋ 新建事件</option>
            <option v-for="s in scenes" :key="s.id" :value="s.id">{{ s.title }}</option>
          </select></label
        ><label>事件标题<input v-model="scene.title" required maxlength="100" /></label
        ><label>事件简介<textarea v-model="scene.subtitle" maxlength="1000" rows="3" /></label
        ><label
          >事件环境<select v-model="scene.preset">
            <option value="neutral">纸本</option>
            <option value="coastal">海边</option>
            <option value="alpine">山野</option>
            <option value="urban">城市</option>
            <option value="ceremony">晚会</option>
          </select></label
        ><button class="primary">保存事件</button>
      </form>
      <form
        v-if="scenes.length"
        class="memory-editor"
        @submit.prevent="emit('save', { type: 'moment', ...moment })"
      >
        <h3>时间轴时刻</h3>
        <label
          >选择时刻<select
            :value="moment.id"
            @change="pickMoment(($event.target as HTMLSelectElement).value)"
          >
            <option value="">＋ 新建时刻</option>
            <option v-for="m in moments" :key="m.id" :value="m.id">
              {{ m.title }} · {{ m.label }}
            </option>
          </select></label
        ><label
          >所属事件<select v-model="moment.sceneId" :disabled="!!moment.id" required>
            <option v-for="s in scenes" :key="s.id" :value="s.id">{{ s.title }}</option>
          </select></label
        ><label>时刻标题<input v-model="moment.title" required maxlength="100" /></label
        ><label>时间<input v-model="moment.startAt" type="datetime-local" required /></label
        ><label
          >光线<select v-model="moment.lighting">
            <option value="morning">清晨</option>
            <option value="golden-hour">黄昏</option>
            <option value="overcast">柔光</option>
            <option value="night">夜晚</option>
            <option value="stage-warm">舞台暖光</option>
          </select></label
        >
        <p>修改时间轴不会覆盖照片原始 EXIF。</p>
        <button class="primary">保存时刻</button>
      </form>
    </div>
    <form
      v-else-if="tab === 'record'"
      class="memory-editor"
      @submit.prevent="
        emit('save', {
          type: 'record',
          ...record,
          objects: record.objects.split(/[,，;；]/),
          time: record.time || undefined,
        })
      "
    >
      <label
        >我的记录<select
          :value="record.id"
          @change="pickRecord(($event.target as HTMLSelectElement).value)"
        >
          <option value="">请选择</option>
          <option v-for="c in own" :key="c.id" :value="c.id">{{ name(c) }}</option>
        </select></label
      >
      <template v-if="current"
        ><MemoryImage
          v-if="current.kind === 'photo'"
          class="manager-preview"
          :src="current.mediaUrl"
          :alt="current.alt"
        /><label
          >移动到时刻<select v-model="record.momentId">
            <option v-for="m in moments" :key="m.id" :value="m.id">
              {{ scenes.find((s) => s.id === m.sceneId)?.title }} · {{ m.label }}
            </option>
          </select></label
        ><label>我的原文<textarea v-model="record.text" maxlength="2000" rows="3" /></label
        ><label
          >自动文案（可修改）<textarea
            v-model="record.generatedCaption"
            maxlength="500"
            rows="2"
          /></label
        ><label
          >物品或道具线索<input
            v-model="record.objects"
            placeholder="例如：红色背包，纸灯笼；以逗号分隔"
            maxlength="500"
        /></label>
        <p>相同线索出现在不同事件时，将形成记忆线索。由你标注，不推断人脸身份。</p>
        <label
          >活动阶段<select v-model="record.phase">
            <option value="">未标注</option>
            <option value="planning">筹备</option>
            <option value="performance">演出</option>
            <option value="after">结束后</option>
          </select></label
        ><label
          >可见范围<select v-model="record.visibility">
            <option value="event-members">篇章成员</option>
            <option value="private">仅当前记录者</option>
            <option value="public">公开</option>
          </select></label
        ><label>修正拍摄时间<input v-model="record.time" type="datetime-local" /></label
        ><small>用户修正会单独标记来源，原始 EXIF 保留。</small>
        <fieldset>
          <legend>自愿标注画面人物</legend>
          <label v-for="p in people" :key="p.id"
            ><input v-model="record.participantTags" type="checkbox" :value="p.id" />{{
              p.displayName
            }}</label
          ><label><input v-model="record.tagsConsent" type="checkbox" />我已获得被标注者同意</label>
        </fieldset>
        <div class="manager-toolbar">
          <button class="primary">保存我的记录</button
          ><button type="button" @click="removeRecord">移除记录</button>
        </div>
        <small>移除后可撤销上一步；本地原文件暂不清除。</small></template
      >
      <p v-else>选择自己的照片或文字开始整理。</p>
    </form>
    <form
      v-else
      class="memory-editor"
      @submit.prevent="
        emit('save', {
          type: 'pair',
          before: pair.before,
          after: pair.after,
          aligned: pair.aligned,
        })
      "
    >
      <label
        >对照事件<select v-model="pair.sceneId" @change="resetPair">
          <option v-for="s in scenes" :key="s.id" :value="s.id">{{ s.title }}</option>
        </select></label
      ><label
        >昨日照片<select v-model="pair.before" required>
          <option value="">请选择</option>
          <option v-for="c in pairPhotos" :key="c.id" :value="c.id">{{ name(c) }}</option>
        </select></label
      ><label
        >今日照片<select v-model="pair.after" required>
          <option value="">请选择</option>
          <option v-for="c in pairPhotos" :key="c.id" :value="c.id">{{ name(c) }}</option>
        </select></label
      >
      <div class="comparison-grid">
        <MemoryImage
          v-for="id in [pair.before, pair.after].filter(Boolean)"
          :key="id"
          :src="records.find((c) => c.id === id)?.mediaUrl"
          :alt="records.find((c) => c.id === id)?.alt ?? ''"
        />
      </div>
      <label
        ><input
          v-model="pair.aligned"
          type="checkbox"
        />我确认两张照片机位与构图对齐，启用滑动对照</label
      >
      <p>默认并排比较。时间不明时也可以手动建立对照，发现页不会据此推断时间演变。</p>
      <button class="primary">建立对照</button>
      <h3>已有对照</h3>
      <div v-for="p in pairs" :key="p.id" class="manager-toolbar">
        <span
          >{{ scenes.find((s) => s.id === p.sceneId)?.title }} ·
          {{ p.comparisonMode === 'wipe' ? '滑动' : '并排' }}</span
        ><button type="button" @click="emit('save', { type: 'remove-pair', id: p.id })">
          移除对照
        </button>
      </div>
    </form>
  </div>
</template>
<style scoped>
.manager-tabs,
.manager-toolbar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  margin: 16px 0;
}
.manager-tabs button {
  padding: 10px 14px;
  border: 1px solid #b8b4a9;
  border-radius: 8px;
}
.manager-tabs button[aria-pressed='true'] {
  background: var(--ink, #273329);
  color: white;
}
.memory-editor {
  margin-block: 24px;
}
.manager-preview {
  max-height: 260px;
  object-fit: contain;
}
fieldset {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px;
}
fieldset label {
  display: flex;
  align-items: center;
  gap: 6px;
}
.comparison-grid img {
  max-height: 200px;
  object-fit: contain;
}
.manager-toolbar select {
  max-width: 220px;
}
</style>
