// The session lives in an HttpOnly cookie set by the API: page scripts never see
// or store it, so there's no token to steal from localStorage.

// Tokens stored by earlier versions (before cookie sessions, and before the app was
// renamed); removed so nothing sensitive stays in storage. The API no longer accepts them.
try {
  for (const key of ['atarefado.token', 'taskflow.token']) localStorage.removeItem(key)
} catch {
  /* storage unavailable */
}

export class ApiError extends Error {
  status: number
  /** Parsed response body, for errors that carry extra fields (e.g. `code`) */
  data: Record<string, unknown> | undefined

  constructor(status: number, message: string, data?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.data = data
  }
}

/** Fired when an authenticated request finds the session gone, so the app can log out. */
export const UNAUTHORIZED_EVENT = 'atarefado:unauthorized'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const OFFLINE_MESSAGE = 'Não foi possível conectar ao servidor. Tente novamente em instantes.'

export async function api<T = void>(
  path: string,
  method: Method = 'GET',
  body?: unknown,
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, OFFLINE_MESSAGE)
  }

  // /auth/* answers 401 for wrong credentials too; only other routes mean "session gone"
  if (res.status === 401 && !path.startsWith('/auth/')) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
  }

  // Our API always answers JSON (errors included); anything else came from a proxy or gateway
  let data: Record<string, unknown> | undefined
  try {
    const text = await res.text()
    data = text ? JSON.parse(text) : undefined
  } catch {
    throw new ApiError(502, OFFLINE_MESSAGE)
  }

  if (!res.ok) {
    if (typeof data?.error === 'string') throw new ApiError(res.status, data.error, data)
    if (res.status >= 500) throw new ApiError(502, OFFLINE_MESSAGE)
    throw new ApiError(res.status, `Falha na requisição (${res.status})`, data)
  }
  return data as T
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Algo deu errado'
}
