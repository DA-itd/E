import { haySoporteVoz, leerTexto } from '../lib/voz'

export default function BotonEscuchar({ texto, className = '' }) {
  if (!haySoporteVoz()) return null

  return (
    <button
      type="button"
      onClick={() => leerTexto(texto)}
      title="Escuchar"
      aria-label="Escuchar"
      className={`inline-flex items-center justify-center text-itd-navy/60 hover:text-itd-navy ${className}`}
    >
      🔊
    </button>
  )
}
