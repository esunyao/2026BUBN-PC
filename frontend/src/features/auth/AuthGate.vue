<script setup lang="ts">
import { ref } from 'vue'
const props = defineProps<{ loading: boolean; error: string; register: (username: string, email: string, password: string) => Promise<void> }>()
const emit = defineEmits<{ login: [] }>()
const formError = ref('')
const registering = ref(false), username = ref(''), email = ref(''), password = ref(''), busy = ref(false)
async function submit() {
  busy.value = true
  formError.value = ''
  try { await props.register(username.value, email.value, password.value) }
  catch (failure) { formError.value = failure instanceof Error ? failure.message : '注册失败，请重试。' }
  finally { password.value = ''; busy.value = false }
}
</script>
<template>
  <main class="memory-app auth-gate">
    <header class="site-header"><span class="wordmark"><span class="brand-mark">m.</span><span>共同记忆<small>SHARED MEMORIES</small></span></span></header>
    <section class="auth-panel">
      <span class="eyebrow">A LITTLE PLACE FOR EVERYTHING WE REMEMBER</span>
      <h1>同一段时光，<br />不同的世界。</h1>
      <p>登录后，回到属于你们的共同记忆。</p>
      <form v-if="registering" class="memory-editor" @submit.prevent="submit">
        <label>用户名<input v-model="username" autocomplete="username" pattern="[A-Za-z0-9_-]{3,32}" minlength="3" maxlength="32" required placeholder="3–32 位字母、数字、下划线或短横线" /></label>
        <label>邮箱<input v-model="email" type="email" autocomplete="email" maxlength="254" required /></label>
        <label>密码<input v-model="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required /></label>
        <p class="muted">邮箱仅作账号信息，当前不验证邮箱，不提供密码找回。</p>
        <button class="primary" :disabled="busy">{{ busy ? '正在注册…' : '注册并登录 ↗' }}</button>
      </form>
      <button v-else class="primary" :disabled="loading" @click="emit('login')">{{ loading ? '正在连接…' : '登录，走进共同记忆 ↗' }}</button>
      <button class="text-link" :disabled="busy" @click="registering = !registering">{{ registering ? '已有账号，返回登录' : '还没有账号？创建账号' }}</button>
      <p v-if="formError || props.error" role="alert" class="form-error">{{ formError || props.error }}</p>
    </section>
  </main>
</template>
