<script setup lang="ts">
import { computed } from 'vue'
import type { EnvironmentRecipe } from '../../shared/memoryTypes'
const props = defineProps<{
  recipe: EnvironmentRecipe
  photo?: string
  pointer: { x: number; y: number }
}>()
const style = computed(() => ({
  '--base': props.recipe.palette.base,
  '--paper': props.recipe.palette.paper,
  '--ink': props.recipe.palette.ink,
  '--accent': props.recipe.palette.accent,
  '--grain': props.recipe.grainOpacity,
  '--blur': `${props.recipe.blurPx}px`,
  '--px': `${props.pointer.x * props.recipe.parallaxStrength}px`,
  '--py': `${props.pointer.y * props.recipe.parallaxStrength}px`,
  '--vignette': props.recipe.vignette,
}))
</script>
<template>
  <div
    class="atmosphere"
    :data-preset="recipe.preset"
    :data-light="recipe.lighting"
    :style="style"
    aria-hidden="true"
  >
    <Transition name="backdrop"
      ><img v-if="photo" :key="photo" class="photo-derived" :src="photo" alt=""
    /></Transition>
    <div class="atmosphere-veil" />
    <div class="surface" :style="{ backgroundImage: `url(${recipe.surfaceTexture})` }" />
    <div class="ambient-light" />
    <img
      v-for="(prop, index) in recipe.props.slice(0, 4)"
      :key="index"
      class="decorative-prop"
      :class="prop.anchor"
      :src="`/demo-assets/${prop.assetId}.svg`"
      alt=""
      :style="{
        opacity: prop.opacity,
        transform: `rotate(${prop.rotation}deg) scale(${prop.scale}) translate(var(--px), var(--py))`,
      }"
    />
    <div class="grain" />
    <div class="vignette" />
  </div>
</template>
