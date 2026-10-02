// Minimal typing and loader for Google Identity Services ("Sign in with Google").
// Docs: https://developers.google.com/identity/gsi/web/reference/js-reference

type CredentialResponse = { credential: string }

type GoogleAccountsId = {
  initialize(config: {
    client_id: string
    callback: (response: CredentialResponse) => void
    ux_mode?: 'popup' | 'redirect'
  }): void
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

const SCRIPT_URL = 'https://accounts.google.com/gsi/client'
let loading: Promise<GoogleAccountsId> | null = null

/** Loads Google's script once and resolves with its `accounts.id` API. */
export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () =>
      window.google?.accounts?.id
        ? resolve(window.google.accounts.id)
        : reject(new Error('O login com Google não carregou corretamente'))
    script.onerror = () => {
      loading = null // allow a retry on the next render
      script.remove()
      reject(new Error('Não foi possível carregar o login com Google'))
    }
    document.head.appendChild(script)
  })
  return loading
}
