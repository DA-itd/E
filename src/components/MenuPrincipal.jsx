import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import EncabezadoInstitucional from './EncabezadoInstitucional'
import PieDerechos from './PieDerechos'

export default function MenuPrincipal({ docente, esAdmin, onIr }) {
  const [proximosCursos, setProximosCursos] = useState([])

  useEffect(() => {
    cargarProximosCursos()
  }, [])

  // Cursos ya aprobados (creados en Convocatorias y cursos) pero que el admin
  // todavía no publica para inscripción: se muestran como adelanto.
  async function cargarProximosCursos() {
    const { data } = await supabase
      .from('cursos')
      .select('nombre, horas, horario, departamento, convocatorias(nombre)')
      .eq('status', 'borrador')
      .order('nombre')
    setProximosCursos(data || [])
  }

  const opciones = [
    {
      id: 'inscripcion',
      titulo: 'Inscripción a Cursos',
      descripcion: 'Inscríbete a los cursos de la convocatoria vigente o revisa tus cursos activos.',
      icono: '📝',
    },
    {
      id: 'historial',
      titulo: 'Historial de Cursos',
      descripcion: 'Consulta y descarga tu kardex con todos los cursos que has tomado.',
      icono: '📚',
    },
    {
      id: 'constancias',
      titulo: 'Descarga de Constancias',
      descripcion: 'Descarga tus constancias y reconocimientos ya validados.',
      icono: '📄',
    },
    {
      id: 'preregistro',
      titulo: 'Preregistro de Curso',
      descripcion: 'Propón un curso para impartir: nombre, objetivo y periodo.',
      icono: '🗒️',
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 pb-16">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <EncabezadoInstitucional />
          <h2 className="font-display text-xl font-semibold text-itd-navy mt-2">
            Hola, {docente.nombre_completo?.split(' ')[0]}
          </h2>
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

      {proximosCursos.length > 0 && (
        <div className="w-full max-w-2xl mt-10">
          <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6">
            <h3 className="font-display text-base font-semibold text-itd-navy mb-1">
              Próximos cursos 👀
            </h3>
            <p className="text-sm text-itd-navyDark/60 mb-4">
              Ya se aprobaron, en breve se abre la inscripción. Ve pensando en cuál te interesa.
            </p>
            <div className="space-y-2">
              {proximosCursos.map((curso, i) => (
                <div key={i} className="text-sm border border-itd-navy/10 rounded-lg px-3 py-2">
                  <p className="font-medium text-itd-navyDark">{curso.nombre}</p>
                  <p className="text-xs text-itd-navyDark/50">
                    {curso.horas && `${curso.horas} hrs`}
                    {curso.horario && ` · ${curso.horario}`}
                    {curso.departamento && ` · ${curso.departamento}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <PieDerechos />
    </div>
  )
}
