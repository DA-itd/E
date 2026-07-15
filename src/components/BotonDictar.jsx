import { useEffect, useRef, useState } from 'react'
import { haySoporteDictado, crearDictado } from '../lib/voz'

export default function BotonDictar({ onTexto, className = '' }) {
  const [escuchando, setEscuchando] = useState(false)
  const dictadoRef = useRef(null)

  useEffect(() => {
    if (!haySoporteDictado()) return
    dictadoRef.current = crearDictado((texto) => onTexto(texto))
    dictadoRef.current?.onEstadoCambio(setEscuchando)
  }, [])

  if (!haySoporteDictado()) return null

  function alternar() {
    if (!dictadoRef.current) return
    if (escuchando) dictadoRef.current.detener()
    else dictadoRef.current.iniciar()
  }

  return (
    <button
      type="button"
      onClick={alternar}
      title={escuchando ? 'Detener dictado' : 'Dictar por voz'}
      aria-label={escuchando ? 'Detener dictado' : 'Dictar por voz'}
      className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-colors ${
        escuchando ? 'bg-itd-guinda text-white animate-pulse' : 'bg-itd-navy/10 text-itd-navy hover:bg-itd-navy/20'
      } ${className}`}
    >
      🎤
    </button>
  )
}
