import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { loadGoogleIdentity } from '../lib/googleIdentity'

type GoogleSignInButtonProps = {
  /** Receives Google's ID token, to be checked by our API */
  onCredential: (credential: string) => void
  onError: (message: string) => void
}

/**
 * Google's official "Continuar com o Google" button. Renders nothing until the API
 * says Google sign-in is configured, so the app works without a client id.
 */
export function GoogleSignInButton({ onCredential, onError }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  // Google keeps the first callback it receives, so route it through refs to stay current
  const onCredentialRef = useRef(onCredential)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onCredentialRef.current = onCredential
    onErrorRef.current = onError
  })

  useEffect(() => {
    let active = true
    api<{ googleClientId: string | null }>('/auth/config').then(
      ({ googleClientId }) => {
        if (active) setClientId(googleClientId)
      },
      () => {
        /* without the config we simply don't offer Google sign-in */
      },
    )
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!clientId) return
    let active = true
    loadGoogleIdentity().then(
      (google) => {
        const container = containerRef.current
        if (!active || !container) return
        google.initialize({
          client_id: clientId,
          callback: ({ credential }) => onCredentialRef.current(credential),
          ux_mode: 'popup',
        })
        google.renderButton(container, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          locale: 'pt-BR',
          // Google's button takes a pixel width (max 400)
          width: Math.min(400, Math.round(container.getBoundingClientRect().width)),
        })
      },
      (err: Error) => {
        if (active) onErrorRef.current(err.message)
      },
    )
    return () => {
      active = false
    }
  }, [clientId])

  if (!clientId) return null

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        ou
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <div ref={containerRef} className="mt-6 flex min-h-11 justify-center" />
    </div>
  )
}
