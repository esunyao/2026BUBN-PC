<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import type { MemoryParticipant } from '../../shared/memoryTypes'
import { analyzePhotos, type AnalyzedPhoto } from './photoAnalysis'
import { defaultGrouping, groupPhotos, type EventCandidate } from './eventGrouping'
import { generateChapterCopy } from './chapterDrafts'
const props = defineProps<{
  participants: MemoryParticipant[]
  saving: boolean
  saveError?: string
}>()
const emit = defineEmits<{
  save: [photos: AnalyzedPhoto[], groups: EventCandidate[], person: string]
}>()
const person = ref(props.participants[0]?.id ?? '')
const vision = ref(true),
  analyzing = ref(false),
  status = ref(''),
  error = ref('')
const useAI = ref(true)
const photos = ref<AnalyzedPhoto[]>([]),
  groups = ref<EventCandidate[]>([]),
  failures = ref<string[]>([])
const options = reactive({ ...defaultGrouping })
const excluded = ref(new Set<string>())
let controller: AbortController | undefined
const working = computed(() => analyzing.value || props.saving)
const selectedGroups = computed(() =>
  groups.value
    .map((g) => ({ ...g, photoIds: g.photoIds.filter((id) => !excluded.value.has(id)) }))
    .filter((g) => g.photoIds.length),
)
const duplicates = computed(() => photos.value.filter((p) => p.duplicateOf))
function dispose() {
  photos.value.forEach((p) => URL.revokeObjectURL(p.url))
  photos.value = []
}
onBeforeUnmount(() => {
  controller?.abort()
  dispose()
})
async function choose(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length || working.value) return
  dispose()
  groups.value = []
  excluded.value = new Set()
  failures.value = []
  error.value = ''
  controller = new AbortController()
  analyzing.value = true
  try {
    const result = await analyzePhotos(
      files,
      person.value,
      vision.value,
      controller.signal,
      (message) => (status.value = message),
    )
    photos.value = result.photos
    failures.value = result.failures
    groups.value = groupPhotos(photos.value, options)
    await writeCopy()
  } catch (e) {
    error.value =
      e instanceof Error && e.name === 'AbortError'
        ? '整理已取消，未保存任何事件。'
        : e instanceof Error
          ? e.message
          : '整理失败'
  } finally {
    analyzing.value = false
    status.value = ''
  }
}
async function writeCopy() {
  const result = await generateChapterCopy(
    groups.value,
    photos.value,
    '共同记忆',
    controller!.signal,
    (message) => (status.value = message),
    useAI.value,
  )
  groups.value = result.groups
  if (result.failures)
    failures.value.push(`${result.failures} 个事件的 DeepSeek 文案暂不可用，已使用本地草稿。`)
}
async function regroup() {
  controller = new AbortController()
  analyzing.value = true
  groups.value = groupPhotos(photos.value, options)
  try {
    await writeCopy()
  } catch {
    error.value = '生成已取消，照片仍保留在候选列表。'
  } finally {
    analyzing.value = false
    status.value = ''
  }
}
function move(photoId: string, targetId: string) {
  groups.value.forEach((g) => (g.photoIds = g.photoIds.filter((id) => id !== photoId)))
  if (targetId === 'new') {
    groups.value.push({
      id: crypto.randomUUID(),
      title: '新的事件',
      photoIds: [photoId],
      reasons: ['由你手动分组'],
      needsReview: true,
    })
  } else {
    const target = groups.value.find((g) => g.id === targetId)
    if (target) {
      target.photoIds.push(photoId)
      target.reasons = ['由你手动调整分组']
    }
  }
  groups.value = groups.value.filter((g) => g.photoIds.length)
}
function setTime(photo: AnalyzedPhoto, value: string) {
  photo.capturedAt = value ? Date.parse(value) : undefined
  photo.timeSource = value ? 'user' : 'unknown'
}
function localDate(time?: number) {
  if (time === undefined || !Number.isFinite(time)) return ''
  const d = new Date(time)
  return new Date(time - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function toggle(id: string) {
  const next = new Set(excluded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  excluded.value = next
}
function confirm() {
  error.value = ''
  if (!selectedGroups.value.length) {
    error.value = '请选择要保存的照片。'
    return
  }
  emit('save', photos.value, selectedGroups.value, person.value)
}
</script>
<template>
  <div class="photo-event-import">
    <p class="import-intro">
      把一批照片整理成事件。先看候选分组，再由你决定哪些照片属于同一段经历。
    </p>
    <fieldset :disabled="working">
      <div class="form-row">
        <label
          >这批照片的记录者<select v-model="person">
            <option v-for="p in participants" :key="p.id" :value="p.id">{{ p.displayName }}</option>
          </select></label
        >
        <label
          >选择照片<input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            @change="choose"
        /></label>
      </div>
      <label class="import-check"
        ><input v-model="vision" type="checkbox" />用画面相似度辅助整理（在此浏览器分析）</label
      >
      <label class="import-check"
        ><input v-model="useAI" type="checkbox" />用 DeepSeek 自动写标题和简介</label
      >
      <p class="muted">
        支持 HEIC。每批最多 500 张、合计 2 GB，单张不超过 30 MB。开启 DeepSeek
        时每个事件仅发送最多两张压缩缩略图和日期，不发送原图或精确 GPS。没有 EXIF
        的时间和位置会明确留待确认。
      </p>
    </fieldset>
    <p v-if="status" role="status">
      {{ status }} <button @click="controller?.abort()">取消整理</button>
    </p>
    <ul v-if="failures.length" class="import-warnings">
      <li v-for="f in failures" :key="f">{{ f }}</li>
    </ul>
    <template v-if="photos.length">
      <fieldset :disabled="working" class="import-rules">
        <legend>分组尺度</legend>
        <div class="form-row">
          <label
            >相邻照片间隔<select v-model="options.gapHours">
              <option :value="1">1 小时</option>
              <option :value="3">3 小时</option>
              <option :value="6">6 小时</option>
            </select></label
          >
          <label
            >距首张照片范围<select v-model="options.radiusKm">
              <option :value="1">1 km</option>
              <option :value="10">10 km</option>
              <option :value="30">30 km</option>
              <option :value="100">100 km</option>
            </select></label
          >
        </div>
        <button @click="regroup">重新归类并生成标题</button>
        <p class="muted">
          会重置手动分组和事件标题。照片时间保持你刚才的修改；跨日期默认分开，跨日旅行可手动合并。EXIF
          未附时区时按设备本地时间读取，可在下方纠正。
        </p>
      </fieldset>
      <p>
        {{ selectedGroups.length }} 个待确认事件 ·
        {{ selectedGroups.reduce((sum, g) => sum + g.photoIds.length, 0) }} 张已选照片
      </p>
      <fieldset :disabled="working" class="import-candidates">
        <article v-for="group in groups" :key="group.id" class="import-candidate">
          <label>事件名称<input v-model="group.title" maxlength="80" /></label>
          <label>事件简介<textarea v-model="group.description" rows="3" maxlength="500" /></label>
          <small
            >{{ group.copySource === 'deepseek' ? 'DeepSeek 生成' : '本地生成' }} ·
            可编辑草稿，不代表拍摄者原文</small
          >
          <label
            >事件类型<select v-model="group.type">
              <option :value="undefined">旅行 / 一次活动</option>
              <option value="longActivity">长期活动</option>
            </select></label
          >
          <p class="muted">候选依据：{{ group.reasons.join('；') }}。请确认是否属于同一事件。</p>
          <label
            v-if="
              !group.photoIds.some((id) =>
                Number.isFinite(photos.find((p) => p.id === id)?.capturedAt),
              )
            "
            >事件日期（必填，不会冒充照片拍摄时间）<input
              v-model="group.manualStart"
              type="datetime-local"
          /></label>
          <div class="import-photo-grid">
            <article
              v-for="photo in photos.filter((p) => group.photoIds.includes(p.id))"
              :key="photo.id"
              class="import-photo"
            >
              <img :src="photo.url" :alt="photo.filename" loading="lazy" />
              <label class="import-check"
                ><input
                  type="checkbox"
                  :checked="!excluded.has(photo.id)"
                  @change="toggle(photo.id)"
                />{{ photo.filename }}</label
              >
              <label
                >拍摄时间 ·
                {{
                  photo.timeSource === 'exif'
                    ? 'EXIF'
                    : photo.timeSource === 'user'
                      ? '你填写的时间'
                      : '缺失'
                }}<input
                  type="datetime-local"
                  :value="localDate(photo.capturedAt)"
                  @change="setTime(photo, ($event.target as HTMLInputElement).value)"
              /></label>
              <small
                >{{
                  photo.gps
                    ? 'GPS ' + photo.gps.latitude.toFixed(3) + ', ' + photo.gps.longitude.toFixed(3)
                    : '无 GPS · 位置待确认'
                }}
                · {{ photo.visualSource ? '已分析画面' : '未分析画面' }}</small
              >
              <label
                >移到事件<select
                  :value="group.id"
                  @change="move(photo.id, ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.title }}</option>
                  <option value="new">＋ 单独成一个事件</option>
                </select></label
              >
            </article>
          </div>
        </article>
      </fieldset>
      <p v-if="duplicates.length" class="muted">
        已跳过 {{ duplicates.length }} 张完全相同的文件：{{
          duplicates.map((p) => p.filename).join('、')
        }}。仅检测本批文件，不删除你的原图。
      </p>
      <button class="primary" :disabled="working || !selectedGroups.length" @click="confirm">
        {{ saving ? '正在保存…' : '确认分组并保存事件' }}
      </button>
      <p class="muted">
        保存至当前浏览器。每个事件内再按 GPS 300 米分章节、30
        分钟分时刻；无位置或时间的照片保持“待确认”，不会推断人名或生成你的心情。
      </p>
    </template>
    <p v-if="error || props.saveError" role="alert" class="form-error">
      {{ error || props.saveError }}
    </p>
  </div>
</template>
<style scoped>
.photo-event-import {
  max-width: 960px;
  margin: auto;
}
fieldset {
  border: 0;
  padding: 0;
  min-width: 0;
}
.photo-event-import label {
  display: grid;
  gap: 7px;
  margin: 10px 0;
  font-size: 13px;
}
.photo-event-import input:not([type='checkbox']),
select {
  width: 100%;
  min-width: 0;
  padding: 10px;
  border: 1px solid #b99c7b60;
  background: #fff9;
  border-radius: 4px;
  color: inherit;
}
textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #b99c7b60;
  background: #fff9;
  border-radius: 4px;
  color: inherit;
  resize: vertical;
}
.import-intro {
  font-family: var(--serif);
  font-size: 20px;
}
.import-check {
  display: flex !important;
  align-items: center;
  overflow-wrap: anywhere;
}
.import-check input {
  flex-shrink: 0;
}
.import-rules,
.import-candidate {
  border-top: 1px solid #b99c7b60;
  padding-top: 18px;
  margin-top: 22px;
}
.import-photo-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}
.import-photo {
  min-width: 0;
}
.import-photo img {
  width: 100%;
  height: 150px;
  object-fit: contain;
  background: #eee6d8;
}
.import-photo small {
  font-size: 11px;
}
.import-warnings {
  color: #745d4d;
  font-size: 13px;
}
@media (max-width: 640px) {
  .import-photo-grid {
    grid-template-columns: 1fr;
  }
}
</style>
