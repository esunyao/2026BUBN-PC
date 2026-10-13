<script setup lang="ts">
import type { Theme } from '../types'

defineProps<{ heading: number; moving: boolean; theme: Theme }>()
</script>

<template>
  <svg
    class="pixel-boat"
    :class="{ moving }"
    viewBox="0 0 72 66"
    aria-hidden="true"
    shape-rendering="crispEdges"
  >
    <g class="wake" :opacity="moving ? 0.8 : 0.35">
      <path
        d="M8 46h8v4h-8zM3 40h7v3H3zM54 46h12v3H54zM60 37h9v3h-9zM18 54h32v3H18z"
        fill="#a1e5ea"
      />
    </g>
    <g :transform="'rotate(' + heading + ', 36, 38)'">
      <path d="M12 30h5v-5h38v5h5v13h-5v5H22v-4h-6v-5h-4z" fill="#503932" />
      <path d="M15 30h42v10h-6v5H24v-4h-6v-4h-3z" fill="#b47745" />
      <path d="M21 29h29v4H21zM24 39h24v4H24z" fill="#e2ac6c" />
      <path d="M10 24h5v8h-5zM57 41h5v10h-5z" fill="#e8be80" />
      <path d="M10 22h5v3h-5zM57 49h5v4h-5z" fill="#744b37" />
    </g>
    <g>
      <path d="M29 24h14v16H29zM26 28h4v9h-4zM43 28h4v9h-4z" fill="#e9bc53" />
      <path d="M31 17h10v10H31z" fill="#edbd99" />
      <path d="M30 16h12v5H30zM28 20h16v3H28z" fill="#795236" />
      <path d="M32 16h9v3h-9z" fill="#ebc576" />
      <path d="M39 22h2v2h-2zM31 38h5v5h-5zM38 38h5v5h-5z" fill="#25354c" />
    </g>
    <path v-if="theme === 'night'" d="M49 28h4v6h-4z" fill="#ffda83" />
  </svg>
</template>

<style scoped>
.pixel-boat {
  width: 72px;
  height: 66px;
  overflow: visible;
  filter: drop-shadow(0 5px 2px #001a3040);
}
.moving .wake {
  animation: wake 0.6s steps(2) infinite;
}
@keyframes wake {
  50% {
    transform: translateY(2px);
    opacity: 0.4;
  }
}
@media (prefers-reduced-motion: reduce) {
  .moving .wake {
    animation: none;
  }
}
</style>
