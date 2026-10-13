export const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '')
let accessToken: () => string | undefined = () => undefined
let unauthorized: () => void = () => {}

export function configureApi(token: () => string | undefined, onUnauthorized: () => void) {
  accessToken = token
  unauthorized = onUnauthorized
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = accessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${apiBase}/api/v1${path}`, { ...init, headers })
  if (!response.ok) {
    if (response.status === 401) unauthorized()
    const problem = await response.json().catch(() => ({})) as { detail?: string; title?: string }
    throw new Error(problem.detail ?? problem.title ?? `请求失败（${response.status}）`)
  }
  if (response.status === 204) return undefined as T
  return await response.json() as T
}

export const jsonBody = (value: unknown): Pick<RequestInit, 'body'> => ({ body: JSON.stringify(value) })
