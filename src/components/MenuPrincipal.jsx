import { supabase } from '../lib/supabaseClient'

export default function MenuPrincipal({ docente, esAdmin, onIr }) {
  const opciones = [
    {
      id: 'inscripcion',
      titulo: 'Inscripción a Cursos',
      descripcion: 'Inscríbete a los cursos de la convocatoria vigente o revisa tus cursos activos.',
      icono: '📝',
    },
    {
      id: 'constancias',
      titulo: 'Descarga de Constancias',
      descripcion: 'Descarga tus constancias y reconocimientos ya validados.',
      icono: '📄',
    },
  ]

  if (esAdmin) {
    opciones.push({
      id: 'administracion',
      titulo: 'Administración',
      descripcion: 'Revisión de asistencia y validación de cursos.',
      icono: '🛠️',
    })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-itd-navy flex items-center justify-center">
            <span className="text-white font-display text-lg font-semibold">ITD</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-itd-navy">
            Hola, {docente.nombre_completo?.split(' ')[0]}
          </h1>
          <p className="text-sm text-itd-navyDark/60 mt-1">¿Qué necesitas hacer hoy?</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {opciones.map((op) => (
            <button
              key={op.id}
              onClick={() => onIr(op.id)}
              className="text-left bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 hover:border-itd-navy/30 hover:shadow-md transition-all"
            >
              <span className="text-3xl">{op.icono}</span>
              <p className="font-display text-lg font-semibold text-itd-navy mt-3">{op.titulo}</p>
              <p className="text-sm text-itd-navyDark/60 mt-1">{op.descripcion}</p>
            </button>
          ))}
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-itd-navyDark/50 hover:text-itd-navyDark underline"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
