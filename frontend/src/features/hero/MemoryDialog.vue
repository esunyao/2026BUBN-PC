<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
const props = defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()
const panel = ref<HTMLElement>(),
  close = ref<HTMLButtonElement>()
const previous = document.activeElement as HTMLElement | null
const previousOverflow = document.body.style.overflow
function keys(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
  if (e.key === 'Tab') {
    const nodes = [
      ...(panel.value?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),a[href],input:not(:disabled),select,textarea,[tabindex="0"]',
      ) ?? []),
    ].filter((n) => n.getClientRects().length)
    const first = nodes[0],
      last = nodes.at(-1)
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last?.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first?.focus()
    }
  }
}
watch(
  () => props.title,
  async () => {
    await nextTick()
    if (!panel.value?.contains(document.activeElement)) close.value?.focus()
  },
)
onMounted(async () => {
  document.body.style.overflow = 'hidden'
  await nextTick()
  close.value?.focus()
  window.addEventListener('keydown', keys)
})
onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow
  window.removeEventListener('keydown', keys)
  if (previous?.isConnected) previous.focus()
})
</script>
<template>
  <div class="dialog-backdrop" @click.self="emit('close')">
    <section
      ref="panel"
      class="memory-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <header class="dialog-heading">
        <div>
          <span class="eyebrow">SHARED MEMORIES / 共同记忆</span>
          <h2 id="dialog-title">{{ title }}</h2>
        </div>
        <button
          ref="close"
          class="round-button"
          aria-label="关闭，返回原来的时刻"
          @click="emit('close')"
        >
          ×
        </button>
      </header>
      <slot />
    </section>
  </div>
</template>
