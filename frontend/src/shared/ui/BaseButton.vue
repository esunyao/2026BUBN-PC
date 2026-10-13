<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'primary' | 'quiet'; disabled?: boolean }>(), {
  variant: 'quiet',
  disabled: false,
})
</script>

<template>
  <button type="button" class="base-button" :class="`base-button--${variant}`" :disabled="disabled">
    <slot />
  </button>
</template>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 9px 14px;
  border: 2px solid var(--border);
  border-radius: 2px;
  background: var(--panel);
  color: var(--text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 2px 2px 0 var(--border);
}
.base-button:hover {
  filter: brightness(1.04);
}
.base-button:active {
  transform: translateY(1px);
  box-shadow: none;
}
.base-button--primary {
  background: var(--accent);
  color: var(--accent-text);
  border-color: var(--accent);
}
.base-button:disabled {
  opacity: 0.45;
  cursor: default;
}
</style>
