const LOGO_TECNM = 'https://raw.githubusercontent.com/DA-itd/E/main/LOGO_tecnm.jpg'
const LOGO_ITD = 'https://raw.githubusercontent.com/DA-itd/E/main/logo%20itd%20original.jpg'

export default function EncabezadoInstitucional() {
  return (
    <div className="mb-6">
      <div className="h-1.5 bg-gradient-to-r from-itd-navy via-itd-gold to-itd-guinda rounded-full mb-3" />
      <div className="flex items-center justify-between gap-3 bg-white rounded-xl border border-itd-navy/10 px-4 py-3">
        <img
          src={LOGO_TECNM}
          alt="Tecnológico Nacional de México"
          className="h-9 sm:h-14 w-auto object-contain shrink-0"
        />
        <div className="text-center flex-1 min-w-0">
          <h1 className="font-display text-xs sm:text-lg font-bold text-itd-navy uppercase tracking-normal sm:tracking-wide leading-snug">
            Instituto Tecnológico de Durango
          </h1>
          <p className="text-[10px] sm:text-xs font-semibold text-itd-navyDark/70 uppercase tracking-normal sm:tracking-wide mt-0.5">
            Desarrollo Académico
          </p>
          <p className="text-[9px] sm:text-xs font-medium text-itd-navyDark/50 uppercase tracking-normal sm:tracking-wide">
            Coordinación de Actualización Docente
          </p>
        </div>
        <img
          src={LOGO_ITD}
          alt="Instituto Tecnológico de Durango"
          className="h-9 sm:h-14 w-auto object-contain shrink-0"
        />
      </div>
    </div>
  )
}
