// src/components/BannerConmemorativo.jsx
import { obtenerBannerFechaEspecial } from '../lib/bannerFechas'

export default function BannerConmemorativo({ fechaEspecial = null, className = '' }) {
  const efemeride = fechaEspecial || obtenerBannerFechaEspecial()

  if (!efemeride) return null

  return (
    <div
      role="region"
      aria-label="Conmemoración del día"
      className={`relative overflow-hidden rounded-2xl p-3.5 sm:p-4 shadow-sm border transition-all duration-300 ${className}`}
      style={{
        background: efemeride.bg,
        color: efemeride.color,
        borderColor: efemeride.borde || 'transparent',
      }}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Icono conmemorativo con efecto flotante sutil */}
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white/40 backdrop-blur-xs border border-white/60 flex items-center justify-center text-2xl sm:text-3xl shrink-0 shadow-xs select-none">
          {efemeride.icono}
        </div>

        {/* Textos conmemorativos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-black/10 backdrop-blur-xs">
              Conmemoración Institucional
            </span>
            <h4 className="font-display text-xs sm:text-sm font-bold tracking-tight">
              {efemeride.titulo}
            </h4>
          </div>
          <p className="text-[11px] sm:text-xs opacity-90 leading-snug font-medium">
            {efemeride.texto}
          </p>
        </div>
      </div>
    </div>
  )
}
