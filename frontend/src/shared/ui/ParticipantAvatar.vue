<script setup lang="ts">
import type { Participant } from '../types'
defineProps<{ participant: Participant }>()
</script>

<template>
  <span
    class="participant-avatar"
    :style="{ '--person-color': participant.color }"
    aria-hidden="true"
    ><span class="avatar-hair" /><span class="avatar-face">{{ participant.initials }}</span
    ><span class="avatar-shirt"
  /></span>
</template>

<style scoped>
.participant-avatar {
  position: relative;
  display: inline-block;
  flex: 0 0 34px;
  width: 34px;
  height: 36px;
  background: color-mix(in srgb, var(--person-color) 20%, var(--panel));
  border: 1px solid color-mix(in srgb, var(--person-color) 50%, transparent);
  border-radius: 5px;
  overflow: hidden;
  image-rendering: pixelated;
}
.avatar-hair {
  position: absolute;
  width: 18px;
  height: 11px;
  background: #534537;
  top: 5px;
  left: 7px;
  box-shadow:
    -3px 4px #534537,
    3px 4px #534537;
}
.avatar-face {
  position: absolute;
  left: 9px;
  top: 10px;
  width: 14px;
  height: 14px;
  color: #624a37;
  background: #f5cf9f;
  font-size: 10px;
  line-height: 15px;
  text-align: center;
}
.avatar-shirt {
  position: absolute;
  width: 24px;
  height: 12px;
  left: 4px;
  bottom: -2px;
  background: var(--person-color);
  box-shadow:
    3px -3px var(--person-color),
    -3px -3px var(--person-color);
}
</style>
