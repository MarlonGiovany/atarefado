const TOKEN_KEY = 'atarefado.token'

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* storage unavailable: session lasts until reload */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
  },
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Fired when the server rejects our token, so the auth layer can log out. */
export const UNAUTHORIZED_EVENT = 'atarefado:unauthorized'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export async function api<T = void>(
  path: string,
  method: Method = 'GET',
  body?: unknown,
): Promise<T> {
  const token = tokenStore.get()
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && token) {
    tokenStore.clear()
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
  }

  const text = await res.text()
  const data = text ? JSON.parse(text) : undefined

  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `Falha na requisição (${res.status})`)
  }
  return data as T
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Algo deu errado'
}
