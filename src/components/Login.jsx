import { useState } from 'react'
import { supabase, DOMINIO_PERMITIDO } from '../lib/supabaseClient'

export default function Login() {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function entrarConGoogle() {
    setError('')
    setCargando(true)
    const { error: errorAuth } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // "hd" limita el selector de cuentas de Google a tu dominio.
        // Es una ayuda de UX, no una barrera de seguridad por sí sola:
        // la verificación real ocurre después del login (ver App.jsx)
        // y en las políticas RLS de Supabase.
        queryParams: { hd: DOMINIO_PERMITIDO },
        redirectTo: window.location.origin + window.location.pathname,
      },
    })
    if (errorAuth) {
      setError('No se pudo iniciar sesión. Intenta de nuevo.')
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg shadow-itd-navy/10 border border-itd-navy/10 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-itd-navy flex items-center justify-center">
          <span className="text-white font-display text-xl font-semibold">ITD</span>
        </div>
        <h1 className="font-display text-2xl font-semibold text-itd-navy mb-1">
          Actualización Docente
        </h1>
        <p className="text-sm text-itd-navyDark/60 mb-8">
          Coordinación de Actualización Docente · ITD
        </p>

        <button
          onClick={entrarConGoogle}
          disabled={cargando}
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-itd-navy/20 bg-white px-4 py-3 text-sm font-medium text-itd-navyDark hover:bg-itd-sand transition-colors disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"/>
          </svg>
          Entrar con tu correo institucional
        </button>

        <p className="mt-4 text-xs text-itd-navyDark/50">
          Solo cuentas @{DOMINIO_PERMITIDO}
        </p>

        {error && (
          <p className="mt-4 text-sm text-itd-guinda">{error}</p>
        )}
      </div>
    </div>
  )
}
