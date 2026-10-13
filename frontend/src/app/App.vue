<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useMemories } from './useMemories'
import type { Contribution, EnvironmentPreset } from '../shared/memoryTypes'
import AtmosphereEngine from '../features/hero/AtmosphereEngine.vue'
import MemoryImage from '../features/hero/MemoryImage.vue'
import SpatialPhotoStack from '../features/hero/SpatialPhotoStack.vue'
import SceneTimeline from '../features/hero/SceneTimeline.vue'
import MemoryDialog from '../features/hero/MemoryDialog.vue'
import MemoryConstellation from '../features/hero/MemoryConstellation.vue'
import ThenAndNow from '../features/hero/ThenAndNow.vue'
import PerspectiveExperience from '../features/hero/PerspectiveExperience.vue'
const {
  data,
  state,
  event,
  scene,
  moment,
  moments,
  current,
  visible,
  active,
  link,
  pair,
  environmentRecipe,
  loading,
  notice,
  navigate,
  chooseMoment,
  open,
  jump,
  saveMemory,
  createEvent,
  exportArchive,
  importArchive,
} = useMemories()
const pointer = reactive({ x: 0, y: 0 })
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
const names = computed(() =>
  Object.fromEntries(data.value.participants.map((p) => [p.id, p.displayName])),
)
const backdrop = computed(() =>
  data.value.contributions
    .find((c) => c.id === environmentRecipe.value.backgroundPhotoId)
    ?.mediaUrl?.replace(/(\/demo-assets\/\d+)\.jpg$/, '$1-bg.jpg'),
)
const eventScenes = computed(() =>
  data.value.scenes.filter((s) => s.eventId === state.activeEventId),
)
const eventPeople = computed(() =>
  data.value.participants.filter((p) => event.value?.participantIds.includes(p.id)),
)
const sharedPeople = computed(() => [
  ...new Set(
    (link.value?.contributionIds ?? [])
      .map((id) => data.value.contributions.find((c) => c.id === id)?.participantId)
      .filter((id): id is string => !!id),
  ),
])
const sharedPerson = ref(''),
  sharedOrigin = ref<'scene' | 'focus'>('scene'),
  discovery = ref(false),
  quote = ref(false)
const themes: Array<[EnvironmentPreset, string]> = [
  ['coastal', '海边'],
  ['alpine', '山野'],
  ['urban', '城市'],
  ['ceremony', '晚会'],
]
const editor = reactive({
  id: '',
  participantId: 'a',
  momentId: '',
  text: '',
  mood: '平静',
  file: undefined as File | undefined,
})
const busy = ref(false),
  editError = ref(''),
  createTitle = ref(''),
  createType = ref<'trip' | 'longActivity'>('trip')
const archiveInput = ref<HTMLInputElement>()
const author = (c?: Contribution) => names.value[c?.participantId ?? ''] ?? ''
const momentFor = (c?: Contribution) => data.value.moments.find((m) => m.id === c?.momentId)
function cover(sceneId: string) {
  return data.value.contributions.find(
    (c) => data.value.moments.find((m) => m.id === c.momentId)?.sceneId === sceneId && c.mediaUrl,
  )?.mediaUrl
}
function resetPointer() {
  pointer.x = 0
  pointer.y = 0
}
function editActive() {
  const id = active.value?.id
  if (id) {
    open('edit')
    loadEdit(id)
  }
}
function motion(e: PointerEvent) {
  if (reduced.matches || e.pointerType === 'touch') return
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1
  pointer.y = (e.clientY / window.innerHeight) * 2 - 1
}
function togglePlayback() {
  if (!state.isPlaying && moments.value.at(-1)?.id === state.activeMomentId && moments.value[0])
    chooseMoment(moments.value[0].id)
  state.isPlaying = !state.isPlaying
}
function reveal(id: string) {
  state.activeParticipantId = id
  state.activeContributionId = ''
}
function startShared(origin: 'scene' | 'focus') {
  if (!link.value) return
  sharedOrigin.value = origin
  sharedPerson.value = sharedPeople.value.find((id) => id !== active.value?.participantId) ?? ''
  open('shared')
  quote.value = !discovery.value
  discovery.value = true
}
function closeDialog() {
  if (busy.value) return
  state.viewMode = state.viewMode === 'shared' ? sharedOrigin.value : 'scene'
  quote.value = false
}
function goToGraphMoment(id: string) {
  chooseMoment(id)
  state.viewMode = 'scene'
}
function nearest() {
  const now = Date.parse(moment.value?.startAt ?? '')
  const candidates = data.value.moments
    .filter(
      (m) =>
        m.sceneId === state.activeSceneId &&
        data.value.contributions.some(
          (c) =>
            c.momentId === m.id &&
            c.participantId === state.activeParticipantId &&
            c.kind === 'photo',
        ),
    )
    .sort((a, b) => Math.abs(Date.parse(a.startAt) - now) - Math.abs(Date.parse(b.startAt) - now))
  if (candidates[0]) chooseMoment(candidates[0].id)
  else notice.value = '这个场景还没有该人物的照片；可以新增一段记忆。'
}
function loadEdit(id: string) {
  const c = data.value.contributions.find((c) => c.id === id)
  editor.id = id
  editor.participantId =
    c?.participantId ??
    (state.activeParticipantId === 'all'
      ? (eventPeople.value[0]?.id ?? 'a')
      : state.activeParticipantId)
  editor.momentId = c?.momentId ?? state.activeMomentId
  editor.text = c?.writtenText ?? ''
  editor.mood = c?.mood[0] ?? '平静'
  editor.file = undefined
  editError.value = ''
}
watch(
  () => state.viewMode,
  (mode) => {
    if (mode === 'edit') loadEdit('')
  },
  { flush: 'sync' },
)
async function save() {
  busy.value = true
  editError.value = ''
  try {
    await saveMemory(editor)
  } catch (e) {
    editError.value = e instanceof Error ? e.message : '保存失败，请重试。'
  } finally {
    busy.value = false
  }
}
async function archive(e: Event) {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0]
  if (file) {
    try {
      await importArchive(file)
    } catch (err) {
      notice.value = err instanceof Error ? err.message : '导入失败'
    }
  }
  input.value = ''
}
function create() {
  if (createTitle.value.trim()) {
    createEvent(createTitle.value, createType.value)
    createTitle.value = ''
  }
}
const dialogTitle = computed(
  () =>
    ({
      scene: '',
      focus: '走近这一刻',
      shared: '这一刻，还有另一双眼睛。',
      'then-now': '昨日与今日',
      constellation: '记忆星图',
      edit: '留下一段记忆',
      create: '开启共同的篇章',
    })[state.viewMode],
)
</script>
<template>
  <main
    class="memory-app"
    :data-theme="environmentRecipe.preset"
    :style="{
      '--base': environmentRecipe.palette.base,
      '--accent': environmentRecipe.palette.accent,
    }"
    @pointermove="motion"
    @pointerleave="resetPointer"
  >
    <AtmosphereEngine :recipe="environmentRecipe" :photo="backdrop" :pointer="pointer" />
    <header class="site-header" :inert="state.viewMode !== 'scene'">
      <a href="/" class="wordmark" @click.prevent="navigate('home')"
        ><span class="brand-mark">m.</span><span>共同记忆<small>SHARED MEMORIES</small></span></a
      >
      <nav aria-label="主导航">
        <button v-if="state.page !== 'home'" @click="navigate('home')">所有篇章</button
        ><button @click="archiveInput?.click()">导入存档</button
        ><button @click="exportArchive">导出</button
        ><button class="header-create" @click="open(state.page === 'scene' ? 'edit' : 'create')">
          ＋ {{ state.page === 'scene' ? '留下记忆' : '创建篇章' }}
        </button>
      </nav>
      <input
        ref="archiveInput"
        class="sr-only"
        tabindex="-1"
        type="file"
        accept="application/json,.json"
        aria-label="导入记忆 JSON 存档"
        @change="archive"
      />
    </header>
    <div v-if="loading" class="loading-status" role="status">正在整理本地记忆…</div>
    <section v-if="state.page === 'home'" class="home-page" :inert="state.viewMode !== 'scene'">
      <div class="home-intro">
        <span class="eyebrow">A LITTLE PLACE FOR EVERYTHING WE REMEMBER</span>
        <h1>同一段时光，<br />不同的世界。</h1>
        <p>照片、文字、同行的你。<br />把共同经历的瞬间，变成可以回去的地方。</p>
        <div class="intro-rule" />
        <span class="edition">私人记忆展览 / VOL. 01</span>
      </div>
      <div class="event-shelf">
        <a
          v-for="(e, i) in data.events"
          :key="e.id"
          :href="`/events/${e.id}`"
          class="event-cover"
          @click.prevent="navigate('event', e.id)"
          ><MemoryImage :src="cover(e.sceneIds[0] ?? '')" :alt="e.title" eager />
          <div class="cover-meta">
            <span class="eyebrow"
              >{{ String(i + 1).padStart(2, '0') }} /
              {{ e.type === 'trip' ? 'TRAVEL JOURNAL' : 'A SHARED PROJECT' }}</span
            >
            <h2>{{ e.title }}</h2>
            <p>{{ e.subtitle }}</p>
            <span class="cover-arrow">↗</span>
          </div>
          <span class="demo-label">{{ e.isDemo ? '示例事件 · 真实图库摄影' : '本地篇章' }}</span></a
        >
      </div>
      <footer class="home-footer">
        <span>有些瞬间，一个人的镜头装不下。</span
        ><span>所有个人叙述均标为样例 · 图片不代表真实海陵岛或同一次活动</span>
      </footer>
    </section>
    <section
      v-else-if="state.page === 'event'"
      class="overview-page"
      :inert="state.viewMode !== 'scene'"
    >
      <button class="text-link" @click="navigate('home')">← 所有篇章</button>
      <div class="overview-title">
        <div>
          <span class="eyebrow"
            >{{ event?.type === 'trip' ? 'TRAVEL JOURNAL' : 'A SHARED PROJECT' }} /
            {{ event?.isDemo ? '示例事件' : '本地篇章' }}</span
          >
          <h1>{{ event?.title }}</h1>
          <p>{{ event?.subtitle }}</p>
        </div>
        <span class="chapter-count">{{ eventScenes.length }}<small>个记忆章节</small></span>
      </div>
      <div class="scene-shelf">
        <a
          v-for="(s, i) in eventScenes"
          :key="s.id"
          :href="`/events/${s.eventId}/scenes/${s.id}`"
          class="scene-cover"
          @click.prevent="navigate('scene', s.eventId, s.id)"
          ><MemoryImage :src="cover(s.id)" :alt="s.title" eager /><span class="eyebrow"
            >CHAPTER {{ String(i + 1).padStart(2, '0') }} · {{ s.momentIds.length }} 个时刻</span
          >
          <h2>{{ s.title }} <span>↗</span></h2>
          <p>{{ s.subtitle }}</p></a
        >
      </div>
      <p class="overview-note">通过照片进入章节。每一份文字，都留在它原本的作者身旁。</p>
    </section>
    <section v-else class="scene-page" :inert="state.viewMode !== 'scene'">
      <div class="scene-topline">
        <button class="text-link" @click="navigate('event')">← {{ event?.title }}</button
        ><span>{{
          event?.isDemo ? '示例事件 / 时间、作者与文字为演示数据' : '本地篇章 / 仅保存在此浏览器'
        }}</span
        ><select
          aria-label="跳转场景"
          :value="state.activeSceneId"
          @change="
            navigate('scene', state.activeEventId, ($event.target as HTMLSelectElement).value)
          "
        >
          <option v-for="s in eventScenes" :key="s.id" :value="s.id">{{ s.title }}</option>
        </select>
      </div>
      <div class="scene-hero">
        <div class="scene-story">
          <span class="eyebrow"
            >{{ environmentRecipe.preset.toUpperCase() }} / CHAPTER
            {{
              String(eventScenes.findIndex((s) => s.id === state.activeSceneId) + 1).padStart(
                2,
                '0',
              )
            }}</span
          >
          <h1>{{ scene?.title }}</h1>
          <p class="scene-subtitle">{{ scene?.subtitle }}</p>
          <div class="story-time">
            <span>{{ moment?.label }}</span
            ><i /><span>{{ moment?.title }}</span>
          </div>
          <div class="memory-notes" aria-live="polite">
            <TransitionGroup name="note"
              ><blockquote
                v-for="c in visible.filter((c) => c.writtenText).slice(0, 3)"
                :key="c.id"
              >
                <p>“{{ c.writtenText }}”</p>
                <footer>
                  — {{ author(c) }}
                  <small
                    >{{ c.isDemo ? '样例文字' : '原文'
                    }}{{ c.mood.length ? ' · ' + c.mood.join('、') : '' }}</small
                  >
                </footer>
              </blockquote></TransitionGroup
            >
            <p v-if="!visible.some((c) => c.writtenText)" class="no-note">
              这一刻，还没有留下文字。
            </p>
          </div>
        </div>
        <SpatialPhotoStack
          :contributions="current"
          :participant="state.activeParticipantId"
          :names="names"
          :pointer="pointer"
          @focus="open('focus', $event)"
          @nearest="nearest"
        />
      </div>
      <div class="scene-understory">
        <div class="perspective">
          <span class="eyebrow">THROUGH YOUR EYES / 透过你的眼睛</span>
          <div class="people-lens">
            <button
              :class="{ active: state.activeParticipantId === 'all' }"
              :aria-pressed="state.activeParticipantId === 'all'"
              @click="reveal('all')"
            >
              <span class="person-circle all">∞</span><span>我们</span></button
            ><button
              v-for="p in eventPeople"
              :key="p.id"
              :class="{ active: state.activeParticipantId === p.id }"
              :aria-pressed="state.activeParticipantId === p.id"
              @click="reveal(p.id)"
            >
              <span class="person-circle" :style="{ background: p.color }">{{
                p.displayName.slice(-1)
              }}</span
              ><span>{{ p.displayName }}</span>
            </button>
          </div>
        </div>
        <div class="experience-actions">
          <button v-if="link && active" class="shared-discovery" @click="startShared('scene')">
            这一刻，还有另一双眼睛。 <span>↗</span>
          </button>
          <div>
            <button v-if="pair" @click="open('then-now')">昨日与今日 ↗</button
            ><button @click="open('constellation')">记忆星图 ↗</button>
          </div>
        </div>
      </div>
      <SceneTimeline
        :moments="moments"
        :contributions="data.contributions"
        :active-id="state.activeMomentId"
        :playing="state.isPlaying"
        :speed="state.playbackSpeed"
        @select="chooseMoment"
        @toggle="togglePlayback"
        @speed="state.playbackSpeed = $event"
      />
      <footer class="scene-footer">
        <span>环境随记忆展开 <small>· 本地预设，未使用 AI 识别</small></span>
        <div class="theme-selector">
          <button :aria-pressed="!state.themeOverride" @click="state.themeOverride = ''">
            随场景</button
          ><button
            v-for="[id, title] in themes"
            :key="id"
            :aria-pressed="state.themeOverride === id"
            @click="state.themeOverride = id"
          >
            {{ title }}
          </button>
        </div>
      </footer>
    </section>
    <Transition name="modal"
      ><MemoryDialog v-if="state.viewMode !== 'scene'" :title="dialogTitle" @close="closeDialog">
        <PerspectiveExperience
          v-if="(state.viewMode === 'focus' || state.viewMode === 'shared') && active"
          :data="data"
          :active="active"
          :link="link"
          :shared="state.viewMode === 'shared'"
          :person-id="sharedPerson"
          :quote="quote"
          :pointer="pointer"
          @share="startShared('focus')"
          @person="sharedPerson = $event"
          @back="state.viewMode = sharedOrigin"
          @edit="editActive"
        />
        <ThenAndNow v-else-if="state.viewMode === 'then-now' && pair" :pair="pair" :data="data" />
        <MemoryConstellation
          v-else-if="state.viewMode === 'constellation'"
          :data="data"
          :event-id="state.activeEventId"
          @jump="jump"
          @moment="goToGraphMoment"
        />
        <form v-else-if="state.viewMode === 'edit'" class="memory-editor" @submit.prevent="save">
          <label
            >新增或编辑<select
              :value="editor.id"
              :disabled="busy"
              @change="loadEdit(($event.target as HTMLSelectElement).value)"
            >
              <option value="">＋ 新增记忆</option>
              <option
                v-for="c in data.contributions.filter((c) =>
                  moments.some((m) => m.id === c.momentId),
                )"
                :key="c.id"
                :value="c.id"
              >
                {{ author(c) }} · {{ momentFor(c)?.label }} ·
                {{ c.writtenText?.slice(0, 20) || c.alt }}
              </option>
            </select></label
          >
          <div class="form-row">
            <label
              >记录者<select v-model="editor.participantId" :disabled="busy">
                <option v-for="p in eventPeople" :key="p.id" :value="p.id">
                  {{ p.displayName }}
                </option>
              </select></label
            ><label
              >所属时刻<select v-model="editor.momentId" :disabled="busy">
                <option v-for="m in moments" :key="m.id" :value="m.id">
                  {{ m.label }} · {{ m.title }}
                </option>
              </select></label
            >
          </div>
          <label
            >留下你的原文<textarea
              v-model="editor.text"
              :disabled="busy"
              maxlength="3000"
              rows="5"
              placeholder="你想记住什么？文字会原样保留。"
            />
          </label>
          <div class="form-row">
            <label
              >心情<select v-model="editor.mood" :disabled="busy">
                <option>平静</option>
                <option>开心</option>
                <option>期待</option>
                <option>感动</option>
                <option value="">不标记</option>
              </select></label
            ><label
              >照片（可选）<input
                :key="editor.id"
                :disabled="busy"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                @change="editor.file = ($event.target as HTMLInputElement).files?.[0]"
            /></label>
          </div>
          <p class="muted">
            照片存于当前浏览器 IndexedDB，文字与配置存于 localStorage。支持 JPEG / PNG / WebP，最大
            12 MB。EXIF 缺失时不会虚构地点或日期；所属时刻由你选择。编辑样例后会标记为用户原文。
          </p>
          <p v-if="editError" role="alert" class="form-error">{{ editError }}</p>
          <button class="primary" type="submit" :disabled="busy">
            {{ busy ? '正在保存…' : '保存这段记忆' }}
          </button>
        </form>
        <form
          v-else-if="state.viewMode === 'create'"
          class="memory-editor"
          @submit.prevent="create"
        >
          <label
            >篇章名称<input
              v-model="createTitle"
              required
              maxlength="80"
              placeholder="一次旅行，一段共同准备的时光…" /></label
          ><label
            >篇章类型<select v-model="createType">
              <option value="trip">旅行</option>
              <option value="longActivity">长期活动</option>
            </select></label
          >
          <p class="muted">创建第一章与今日时刻，然后添加照片或文字。数据保存在这个浏览器。</p>
          <button class="primary" :disabled="!createTitle.trim()">创建并留下第一段记忆 ↗</button>
        </form>
      </MemoryDialog></Transition
    >
    <div v-if="notice" class="toast" role="status">
      <span>{{ notice }}</span
      ><button aria-label="关闭提示" @click="notice = ''">×</button>
    </div>
  </main>
</template>
