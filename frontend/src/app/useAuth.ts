import { reactive } from 'vue'
import { InMemoryWebStorage, UserManager, WebStorageStateStore, type User } from 'oidc-client-ts'
import { apiBase, configureApi, jsonBody, request } from '../shared/lib/api'

export const auth = reactive({
  user: undefined as User | undefined,
  account: undefined as { id: string; username: string; email?: string } | undefined,
  loading: true,
  error: '',
})
let manager: UserManager | undefined
function oidc() {
  return manager ??= new UserManager({
    authority: import.meta.env.VITE_OIDC_AUTHORITY ?? apiBase,
    client_id: 'world-web',
    redirect_uri: `${location.origin}/auth/callback`,
    post_logout_redirect_uri: `${location.origin}/`,
    response_type: 'code',
    scope: 'openid profile world',
    automaticSilentRenew: false,
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    stateStore: new WebStorageStateStore({ store: sessionStorage }),
  })
}
configureApi(() => auth.user?.expired ? undefined : auth.user?.access_token, () => {
  auth.user = undefined
  auth.account = undefined
  auth.error = '登录已过期，请重新登录。'
})

export async function initializeAuth() {
  try {
    if (location.pathname === '/auth/callback') {
      auth.user = await oidc().signinRedirectCallback()
      const destination = typeof auth.user.state === 'string' && auth.user.state.startsWith('/events/')
        ? auth.user.state : '/'
      history.replaceState(null, '', destination)
    } else if (sessionStorage.getItem('memory-auth-session') === 'active') {
      await login('none')
      return
    }
    if (auth.user) {
      auth.account = await request('/me')
      sessionStorage.setItem('memory-auth-session', 'active')
      oidc().events.addAccessTokenExpired(() => {
        auth.user = undefined
        auth.account = undefined
        auth.error = '登录已过期，请重新登录。'
      })
    }
  } catch (error) {
    sessionStorage.removeItem('memory-auth-session')
    auth.error = error instanceof Error ? error.message : '无法连接登录服务。'
  } finally {
    auth.loading = false
  }
}
export async function login(prompt?: 'none') {
  auth.error = ''
  try {
    await oidc().signinRedirect({ state: location.pathname + location.search, ...(prompt ? { prompt } : {}) })
  } catch (error) {
    auth.error = error instanceof Error ? error.message : '无法打开登录服务。'
  }
}
export async function logout() {
  sessionStorage.removeItem('memory-auth-session')
  await oidc().signoutRedirect({ id_token_hint: auth.user?.id_token })
  auth.user = undefined
  auth.account = undefined
}
export async function passwordDigest(password: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('密码摘要需要 HTTPS 或 localhost 开发环境。')
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
export async function register(username: string, email: string, password: string) {
  if (password.length < 8 || password.length > 128) throw new Error('密码需要 8–128 个字符。')
  await request('/auth/register', { method: 'POST', ...jsonBody({ username, email, passwordDigest: await passwordDigest(password) }) })
  await login()
}
