<script setup lang="ts">
import { ref, watch } from 'vue'
const props = defineProps<{ src?: string; alt: string; eager?: boolean }>()
const failed = ref(false),
  loaded = ref(false)
watch(
  () => props.src,
  () => {
    failed.value = false
    loaded.value = false
  },
)
</script>
<template>
  <div class="memory-image" :class="{ 'is-loaded': loaded }">
    <img
      :src="failed || !src ? '/demo-assets/fallback.svg' : src"
      :alt="alt"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
      @load="loaded = true"
      @error="failed = true"
    />
    <span v-if="failed || !src" class="image-status">{{
      src ? '原图暂时无法显示' : '照片待补充'
    }}</span>
  </div>
</template>
