<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import WorldMap from '../features/world/WorldMap.vue'
import MemoryPanel from '../features/memories/MemoryPanel.vue'
import ImportPanel from '../features/import/ImportPanel.vue'
import ReplayBar from '../features/replay/ReplayBar.vue'
import { useReplay } from '../features/replay/useReplay'
import { useNavigation } from '../navigation/useNavigation'
import BaseButton from '../shared/ui/BaseButton.vue'
import ParticipantAvatar from '../shared/ui/ParticipantAvatar.vue'
import type { Point, Theme } from '../shared/types'
import { useTrip } from './useTrip'

const {
  islands,
  photos,
  participants,
  activeParticipantIds,
  selectedIslandId,
  visiblePhotos,
  selectedIsland,
  selectedPhotos,
  addImport,
  placePhoto,
  cleanupObjectURLs,
} = useTrip()
const theme = ref<Theme>('day')
const importOpen = ref(false)
const peopleOpen = ref(false)
const { position, heading, isMoving, navigateTo, setManualVector, stop } = useNavigation(
  islands,
  (id) => {
    selectedIslandId.value = id
  },
)
const replay = useReplay(visiblePhotos, navigateTo, (photo) => {
  selectedIslandId.value = photo.islandId
})
const { progress, duration, isPlaying, currentPhoto, orderedPhotos } = replay

function pauseNavigation() {
  replay.pause()
  stop()
}
async function visitIsland(id: string) {
  pauseNavigation()
  selectedIslandId.value = null
  if (await navigateTo(id)) selectedIslandId.value = id
}
function manualMove(vector: Point) {
  if (vector.x || vector.y) {
    replay.pause()
    selectedIslandId.value = null
  }
  setManualVector(vector)
}
function changePeople(id: string) {
  pauseNavigation()
  activeParticipantIds.value = activeParticipantIds.value.includes(id)
    ? activeParticipantIds.value.filter((value) => value !== id)
    : [...activeParticipantIds.value, id]
}
function allPeople() {
  pauseNavigation()
  activeParticipantIds.value =
    activeParticipantIds.value.length === participants.value.length
      ? []
      : participants.value.map((person) => person.id)
}
function toggleReplay() {
  if (isPlaying.value) pauseNavigation()
  else {
    stop()
    replay.play()
  }
}
function seekReplay(value: number) {
  stop()
  replay.seek(value)
}
function openImport() {
  pauseNavigation()
  importOpen.value = true
}
onBeforeUnmount(cleanupObjectURLs)
</script>

<template>
  <main class="trip-app" :data-theme="theme">
    <div class="map-stage">
      <WorldMap
        :islands="islands"
        :photos="visiblePhotos"
        :active-participant-ids="activeParticipantIds"
        :selected-island-id="selectedIslandId"
        :position="position"
        :is-moving="isMoving"
        :heading="heading"
        :theme="theme"
        @navigate="visitIsland"
        @manual-move="manualMove"
      />
    </div>

    <header class="topbar panel">
      <a
        href="#"
        class="brand"
        aria-label="Shared Moment World 首页"
        @click.prevent="selectedIslandId = null"
        ><span class="brand-symbol" aria-hidden="true"><i /><i /><i /></span
        ><span>Shared<br /><b>Moment World</b></span></a
      >
      <div class="trip-title">
        <span class="trip-date">2026.08.16 · 夏日纪行</span>
        <h1>和你们一起，去看海</h1>
      </div>
      <div class="trip-stats">
        <span
          ><strong>{{ islands.length }}</strong> 个地点</span
        ><span
          ><strong>{{ photos.length }}</strong> 张回忆</span
        >
      </div>
      <div class="topbar-actions">
        <BaseButton
          class="theme-button"
          :aria-label="theme === 'day' ? '切换夜晚' : '切换白天'"
          @click="theme = theme === 'day' ? 'night' : 'day'"
          ><span aria-hidden="true">{{ theme === 'day' ? '☾' : '☀' }}</span
          ><span class="theme-text">{{ theme === 'day' ? '夜晚' : '白天' }}</span></BaseButton
        ><BaseButton variant="primary" @click="openImport"
          ><span aria-hidden="true">＋</span> 导入照片</BaseButton
        >
      </div>
    </header>

    <section class="world-intro" aria-label="探索提示">
      <span class="intro-line" />
      <div>
        <h2>把共同的瞬间，变成可以回去的地方。</h2>
        <p>点一座岛，让回忆靠岸。</p>
      </div>
    </section>

    <BaseButton
      class="mobile-people-toggle"
      :aria-expanded="peopleOpen"
      @click="peopleOpen = !peopleOpen"
      >旅伴 {{ activeParticipantIds.length }}/{{ participants.length }}</BaseButton
    >
    <aside
      class="people-panel panel"
      :class="{ 'people-panel--open': peopleOpen }"
      aria-label="旅伴照片筛选"
    >
      <div class="people-heading">
        <div>
          <h2>同行的我们</h2>
          <p>每个人眼里的这一天</p>
        </div>
        <button class="text-button" @click="allPeople">
          {{ activeParticipantIds.length === participants.length ? '清空' : '全选' }}
        </button>
      </div>
      <label
        v-for="person in participants"
        :key="person.id"
        class="person-row"
        :class="{
          'person-row--active': activeParticipantIds.includes(person.id),
        }"
        ><ParticipantAvatar :participant="person" /><span class="person-info"
          ><strong>{{ person.name }}</strong
          ><span
            >{{ photos.filter((photo) => photo.photographerId === person.id).length }} 张回忆</span
          ></span
        ><input
          type="checkbox"
          :checked="activeParticipantIds.includes(person.id)"
          :style="{ accentColor: person.color }"
          @change="changePeople(person.id)"
      /></label>
      <p class="people-footnote">
        <span class="status-dot" />{{
          activeParticipantIds.length
            ? '正在看见 ' + activeParticipantIds.length + ' 位旅伴的视角'
            : '选择一位旅伴，看看他的旅程'
        }}
      </p>
    </aside>

    <div v-if="!visiblePhotos.length" class="empty-filter panel" role="status">
      海还在，回忆暂时藏起来了。<button class="text-button" @click="allPeople">显示所有旅伴</button>
    </div>
    <div class="map-caption">
      <span aria-hidden="true">✣</span><span>夏日群岛</span><i /><span
        >点击岛屿探索 · 方向键 / WASD 航行</span
      >
    </div>
    <div class="replay-dock">
      <ReplayBar
        :progress="progress"
        :duration="duration"
        :is-playing="isPlaying"
        :photo="currentPhoto"
        :photo-count="orderedPhotos.length"
        @toggle="toggleReplay"
        @seek="seekReplay"
      />
    </div>
    <MemoryPanel
      :island="selectedIsland"
      :photos="selectedPhotos"
      :participants="participants"
      @close="selectedIslandId = null"
    />
    <ImportPanel
      :open="importOpen"
      :islands="islands"
      :photos="photos"
      :participants="participants"
      @close="importOpen = false"
      @imported="addImport"
      @place="placePhoto"
    />
  </main>
</template>
