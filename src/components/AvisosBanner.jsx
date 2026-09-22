import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const ESTILOS_TIPO = {
  info: { bg: '#0C447C', color: '#ffffff' },
  exito: { bg: '#3B6D11', color: '#ffffff' },
  aviso: { bg: '#FAC775', color: '#412402' },
  urgente: { bg: '#72243E', color: '#ffffff' },
}

const ICONOS_TIPO = {
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="11" />
      <circle cx="12" cy="8" r="0.5" fill="currentColor" />
    </svg>
  ),
  exito: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  ),
  aviso: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l10 18H2L12 3z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  ),
  urgente: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12.5" />
      <circle cx="12" cy="16" r="0.5" fill="currentColor" />
    </svg>
  ),
}

export default function AvisosBanner() {
  const [avisos, setAvisos] = useState([])

  useEffect(() => {
    cargar()
  }, [])

  // Si por algo `avisos` no fuera legible sin sesión, esto simplemente no
  // muestra nada — no rompe la pantalla de login.
  async function cargar() {
    try {
      const { data } = await supabase
        .from('avisos')
        .select('id, mensaje, tipo')
        .eq('activo', true)
        .order('creado_en', { ascending: false })
      setAvisos(data || [])
    } catch {
      setAvisos([])
    }
  }

  if (avisos.length === 0) return null

  return (
    <div className="space-y-2">
      <style>{`
        @keyframes avisoEntrada {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes avisoPulso {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.55); }
          50% { box-shadow: 0 0 0 5px rgba(255,255,255,0); }
        }
      `}</style>
      {avisos.map((a, i) => {
        const estilo = ESTILOS_TIPO[a.tipo] || ESTILOS_TIPO.info
        return (
          <div
            key={a.id}
            className="rounded-xl px-4 py-3 text-sm font-medium text-center shadow-sm flex items-center justify-center gap-2"
            style={{
              background: estilo.bg,
              color: estilo.color,
              animation: `avisoEntrada .45s ease-out ${i * 0.08}s both`,
            }}
          >
            <span
              className="shrink-0 rounded-full flex items-center justify-center"
              style={{
                width: 20,
                height: 20,
                animation: a.tipo === 'urgente' ? 'avisoPulso 1.8s ease-in-out infinite' : undefined,
              }}
            >
              {ICONOS_TIPO[a.tipo] || ICONOS_TIPO.info}
            </span>
            <span>{a.mensaje}</span>
          </div>
        )
      })}
    </div>
  )
}