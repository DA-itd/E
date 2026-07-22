export default function PasoFinalizado({ onVolverAInicio }) {
  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-8 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center text-2xl">
        ✓
      </div>
      <h2 className="font-display text-xl font-semibold text-itd-navy mb-2">
        ¡Inscripción registrada!
      </h2>
      <p className="text-sm text-itd-navyDark/60 mb-6">
        Puedes revisar tus cursos activos en cualquier momento en la pestaña "Mis cursos".
      </p>
      <button
        onClick={onVolverAInicio}
        className="rounded-lg bg-itd-navy text-white px-6 py-2.5 text-sm font-medium hover:bg-itd-navyDark"
      >
        Ver mis cursos
      </button>
    </div>
  )
}
