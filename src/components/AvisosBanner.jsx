import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const ESTILOS_TIPO = {
  info: {
    bg: '#0E2548',
    color: '#ffffff',
    borde: '#1B396A',
    badge: 'bg-blue-400/20 text-blue-200 border-blue-400/30',
    icono: '📢',
  },
  exito: {
    bg: '#0E5A3C',
    color: '#ffffff',
    borde: '#167B52',
    badge: 'bg-emerald-400/20 text-emerald-200 border-emerald-400/30',
    icono: '✅',
  },
  aviso: {
    bg: '#B45309',
    color: '#ffffff',
    borde: '#D97706',
    badge: 'bg-amber-400/20 text-amber-100 border-amber-400/30',
    icono: '⚠️',
  },
  urgente: {
    bg: '#781834',
    color: '#ffffff',
    borde: '#9B2244',
    badge: 'bg-rose-400/20 text-rose-100 border-rose-400/30',
    icono: '🚨',
  },
}

export default function AvisosBanner({ className = '' }) {
  const [avisos, setAvisos] = useState([])
  const [descartados, setDescartados] = useState([])

  useEffect(() => {
    cargar()

    let channel
    try {
      channel = supabase
        .channel('avisos-publicos-rt')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'avisos' },
          () => {
            cargar()
          }
        )
        .subscribe()
    } catch {
      // Ignorar si realtime no está habilitado
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel)
        } catch {
          // Ignorar error al limpiar canal
        }
      }
    }
  }, [])

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

  const avisosVisibles = avisos.filter((a) => !descartados.includes(a.id))

  if (avisosVisibles.length === 0) return null

  function descartar(id) {
    setDescartados((prev) => [...prev, id])
  }

  return (
    <div className={`space-y-2.5 w-full ${className}`}>
      {avisosVisibles.map((a) => {
        const estilo = ESTILOS_TIPO[a.tipo] || ESTILOS_TIPO.info
        return (
          <div
            key={a.id}
            role="alert"
            className="rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 text-xs sm:text-sm font-semibold shadow-md flex items-center justify-between gap-3 border transition-all animate-fade-in"
            style={{
              background: estilo.bg,
              color: estilo.color,
              borderColor: estilo.borde,
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-base sm:text-lg shrink-0 select-none">
                {estilo.icono}
              </span>
              <p className="leading-snug break-words">
                {a.mensaje}
              </p>
            </div>

            <button
              onClick={() => descartar(a.id)}
              className="ml-2 text-white/70 hover:text-white font-bold text-xs p-1 rounded-md hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              title="Ocultar aviso"
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
