const PASOS = [
  { id: 1, label: 'Información' },
  { id: 2, label: 'Cursos' },
  { id: 3, label: 'Confirmar' },
  { id: 4, label: 'Finalizado' },
]

export default function WizardHeader({ pasoActual }) {
  return (
    <div className="flex items-center justify-center gap-6 sm:gap-10 py-6">
      {PASOS.map((paso, i) => (
        <div key={paso.id} className="flex items-center gap-6 sm:gap-10">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                paso.id === pasoActual
                  ? 'bg-itd-navy text-white'
                  : paso.id < pasoActual
                  ? 'bg-itd-navy/20 text-itd-navy'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {paso.id}
            </div>
            <span
              className={`text-xs font-medium ${
                paso.id === pasoActual ? 'text-itd-navy' : 'text-gray-400'
              }`}
            >
              {paso.label}
            </span>
          </div>
          {i < PASOS.length - 1 && <div className="w-8 sm:w-14 h-px bg-gray-200 mb-5" />}
        </div>
      ))}
    </div>
  )
}
