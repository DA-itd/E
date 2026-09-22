const BASE = import.meta.env.BASE_URL?.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL || '.'}/`
const LOGO_TECNM_LOCAL = `${BASE}logos/logo-tecnm.jpg`
const LOGO_TECNM_REMOTE = 'https://raw.githubusercontent.com/DA-itd/E/main/public/logos/logo-tecnm.jpg'
const LOGO_ITD_LOCAL = `${BASE}logo_itdurango.png`
const LOGO_ITD_REMOTE = 'https://github.com/DA-itd/E/blob/main/logo_itdurango.png?raw=true'

export default function EncabezadoInstitucional({ tema = 'claro' }) {
  const esOscuro = tema === 'oscuro'

  return (
    <div className="mb-6 select-none">
      {/* Barra tricolor institucional: Guinda ITD, Oro y Azul TecNM */}
      <div className="h-1.5 bg-gradient-to-r from-itd-guinda via-itd-gold to-itd-navy rounded-full mb-3 shadow-xs" />

      <div
        className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 transition-all ${
          esOscuro
            ? 'bg-white/10 backdrop-blur-md border border-white/15 text-white shadow-inner'
            : 'bg-white border border-itd-navy/10 shadow-xs'
        }`}
      >
        <img
          src={LOGO_TECNM_LOCAL}
          onError={(e) => {
            if (e.currentTarget.src !== LOGO_TECNM_REMOTE) {
              e.currentTarget.src = LOGO_TECNM_REMOTE
            }
          }}
          alt="Tecnológico Nacional de México"
          className="h-10 sm:h-14 w-auto object-contain shrink-0 filter drop-shadow-xs"
        />

        <div className="text-center flex-1 min-w-0 px-2">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-itd-gold">
            Tecnológico Nacional de México
          </p>
          <h1
            className={`font-display text-xs sm:text-base md:text-lg font-bold uppercase tracking-normal sm:tracking-wide leading-tight mt-0.5 ${
              esOscuro ? 'text-white' : 'text-itd-navy'
            }`}
          >
            Instituto Tecnológico de Durango
          </h1>
          <p
            className={`text-[9px] sm:text-xs font-semibold uppercase tracking-wider mt-0.5 ${
              esOscuro ? 'text-white/80' : 'text-itd-navyDark/70'
            }`}
          >
            Desarrollo Académico · Actualización Docente
          </p>
        </div>

        <img
          src={LOGO_ITD_REMOTE}
          onError={(e) => {
            if (e.currentTarget.src !== LOGO_ITD_LOCAL) {
              e.currentTarget.src = LOGO_ITD_LOCAL
            }
          }}
          alt="Instituto Tecnológico de Durango"
          className="h-10 sm:h-14 w-auto object-contain shrink-0 filter drop-shadow-xs"
        />
      </div>
    </div>
  )
}
