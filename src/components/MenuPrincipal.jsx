import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import EncabezadoInstitucional from './EncabezadoInstitucional'
import AvisosBanner from './AvisosBanner'
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
      colorBadge: 'bg-rose-100 text-itd-guinda border-rose-200',
      accentBorder: 'hover:border-itd-guinda',
    },
    {
      id: 'historial',
      titulo: 'Historial de Cursos',
      descripcion: 'Consulta y descarga tu kardex con todos los cursos que has acreditado.',
      icono: '📚',
      colorBadge: 'bg-blue-100 text-blue-800 border-blue-200',
      accentBorder: 'hover:border-blue-600',
    },
    {
      id: 'constancias',
      titulo: 'Descarga de Constancias',
      descripcion: 'Descarga tus constancias oficiales y reconocimientos ya validados.',
      icono: '📜',
      colorBadge: 'bg-amber-100 text-amber-800 border-amber-200',
      accentBorder: 'hover:border-itd-gold',
    },
    {
      id: 'preregistro',
      titulo: 'Preregistro de Curso',
      descripcion: 'Propón un curso para impartir: nombre, objetivo y periodo intersemestral.',
      icono: '🗒️',
      colorBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      accentBorder: 'hover:border-emerald-600',
    },
  ]

  if (esAdmin) {
    opciones.push({
      id: 'administracion',
      titulo: 'Panel de Administración',
      descripcion: 'Revisión de asistencia, validación, constancias y gestión de cursos.',
      icono: '🛠️',
      colorBadge: 'bg-purple-100 text-purple-900 border-purple-200',
      accentBorder: 'hover:border-purple-600',
      esDestacado: true,
    })
  }

  const nombreDocente = docente?.nombre_completo?.split(' ')[0] || (esAdmin ? 'Administrador' : 'Docente')

  return (
    <div className="min-h-screen flex flex-col items-center justify-between px-4 py-8 pb-16 bg-gradient-to-b from-[#F7F5F0] via-white to-slate-100">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <EncabezadoInstitucional />

          <h2 className="font-display text-2xl sm:text-3xl font-bold text-itd-navy">
            Hola, {nombreDocente}
          </h2>
          <p className="text-sm text-itd-navyDark/70 mt-1 max-w-md mx-auto">
            Bienvenido a tu portal de actualización docente, ¿Qué deseas realizar hoy?
          </p>
        </div>

        <div className="mb-6">
          <AvisosBanner />
        </div>

        {/* Cuadrícula de opciones responsiva */}
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
          {opciones.map((op) => (
            <div
              key={op.id}
              onClick={() => onIr(op.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onIr(op.id)
                }
              }}
              role="button"
              tabIndex={0}
              className={`text-left bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-5 sm:p-6 hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer group relative overflow-hidden ${
                op.accentBorder
              } ${op.esDestacado ? 'sm:col-span-2 bg-gradient-to-r from-white via-purple-50/40 to-white border-purple-200' : ''}`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 border shadow-xs transition-transform group-hover:scale-110 ${op.colorBadge}`}>
                  {op.icono}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-display text-base sm:text-lg font-bold text-itd-navy group-hover:text-itd-guinda transition-colors">
                      {op.titulo}
                    </p>
                    <span className="text-itd-navyDark/30 group-hover:text-itd-guinda group-hover:translate-x-1 transition-all text-base">
                      →
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-itd-navyDark/65 mt-1 leading-relaxed">
                    {op.descripcion}
                  </p>

                  {op.id === 'constancias' && (
                    <div className="mt-3 pt-3 border-t border-amber-200/70">
                      <a
                        href="https://da-itd.github.io/B"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold shadow-2xs hover:shadow-xs transition-all cursor-pointer group/btn"
                        title="Ir al sistema anterior para descargar constancias y reconocimientos previos"
                      >
                        <span>📜</span>
                        <span>Constancias y Reconocimientos anteriores</span>
                        <span className="text-amber-700 font-bold group-hover/btn:translate-x-0.5 transition-transform">↗</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs font-semibold text-itd-guinda hover:text-itd-guindaDark underline px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors"
          >
            ← Cerrar sesión institucional
          </button>
        </div>
      </div>

      {proximosCursos.length > 0 && (
        <div className="w-full max-w-3xl mt-10">
          <div className="bg-white rounded-2xl border-2 border-blue-100 shadow-md p-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">👀</span>
              <h3 className="font-display text-base font-bold text-itd-navy">
                Próximos Cursos en Preparación
              </h3>
            </div>
            <p className="text-xs text-itd-navyDark/65 mb-4">
              Cursos autorizados para la siguiente convocatoria. En breve se abrirá el periodo de inscripciones:
            </p>
            <div className="space-y-2">
              {proximosCursos.map((curso, i) => (
                <button
                  key={i}
                  onClick={() => onIr('inscripcion')}
                  className="w-full text-left text-sm border border-itd-navy/10 rounded-xl px-3.5 py-2.5 hover:bg-blue-50/50 hover:border-blue-300 transition-colors flex items-center justify-between group"
                >
                  <div>
                    <p className="font-semibold text-itd-navyDark group-hover:text-itd-navy transition-colors text-xs sm:text-sm">
                      {curso.nombre}
                    </p>
                    <p className="text-[11px] text-itd-navyDark/60 mt-0.5">
                      {curso.horas && `${curso.horas} hrs`}
                      {curso.horario && ` · ${curso.horario}`}
                      {curso.departamento && ` · ${curso.departamento}`}
                    </p>
                  </div>
                  <span className="text-itd-navyDark/30 group-hover:text-blue-600 transition-colors text-sm font-bold">
                    Ver más →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <PieDerechos />
    </div>
  )
}
