import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatearRangoFechas } from '../lib/formatoFechas'
import { descargarConstancia } from '../lib/constancias'
import { calcularPeriodoAnteriorTexto, obtenerInscripcionesConEncuestaRespondida } from '../lib/encuesta'
import EncuestaOpinion from './EncuestaOpinion'

function normalizar(texto) {
  return (texto || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// La encuesta de opinión es obligatoria para desbloquear la constancia a partir
// del PRÓXIMO periodo (posterior a Agosto 2026).
// Para el periodo de Agosto 2026 y anteriores, por esta ocasión la descarga se
// habilita únicamente teniendo la asistencia acreditada/activa.
function esPeriodoAgostoOAnterior(ins) {
  const conv = ins.cursos?.convocatorias
  if (conv) {
    const anio = Number(conv.anio)
    const mes = Number(conv.mes)
    const nombre = (conv.nombre || '').toUpperCase()

    if (anio && anio < 2026) return true
    if (anio === 2026) {
      if (nombre.includes('AGOSTO')) return true
      if (mes && mes <= 8) return true
    }
  }

  const fecha = conv?.fecha_inicio || ins.cursos?.fecha_inicio || ''
  if (fecha && fecha < '2026-09-01') {
    return true
  }

  return false
}

export default function DescargaConstancias({ docente }) {
  const [inscripciones, setInscripciones] = useState([])
  const [cursosComoInstructor, setCursosComoInstructor] = useState([])
  const [encuestasRespondidas, setEncuestasRespondidas] = useState(new Set())
  const [cargando, setCargando] = useState(true)
  const [generando, setGenerando] = useState(null)
  const [encuestaActiva, setEncuestaActiva] = useState(null) // la inscripción que está contestando ahora

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    const hoy = new Date().toISOString().slice(0, 10)

    // "El último archivado": todas las filas de una misma tanda de archivado
    // comparten el mismo instante exacto en `migrado_en` (se insertan en una
    // sola operación). Buscamos ese instante más reciente en TODA la tabla
    // (no solo de este docente) para saber a qué tanda limitarnos.
    const { data: ultimaTanda } = await supabase
      .from('inscripciones_historial')
      .select('migrado_en')
      .order('migrado_en', { ascending: false })
      .limit(1)
      .maybeSingle()

    let histQuery = supabase
      .from('inscripciones_historial')
      .select('id, folio_personal, folio_curso, asistencia_aprobada')
      .ilike('email', docente.email)
      .eq('asistencia_aprobada', 'Sí')
    if (ultimaTanda?.migrado_en) {
      histQuery = histQuery.eq('migrado_en', ultimaTanda.migrado_en)
    }

    const [{ data: insData }, { data: cursosData }, { data: histData }] = await Promise.all([
      supabase
        .from('inscripciones')
        .select('id, folio_personal, asistencia_aprobada, cursos(id, nombre, fecha_inicio, fecha_fin, horas, folio, tipo, convocatorias(nombre, mes, anio, fecha_inicio))')
        .eq('docente_id', docente.id)
        .eq('estado', 'activo')
        .order('fecha_inscripcion', { ascending: false }),
      supabase
        .from('cursos')
        .select('id, folio, nombre, instructor, departamento, fecha_inicio, fecha_fin, horas, tipo')
        .not('instructor', 'is', null)
        .lte('fecha_fin', hoy),
      // Solo la última tanda archivada (ver arriba) -- no todo el historial
      // acumulado, para no duplicar lo que ya muestra "Historial de Cursos".
      histQuery,
    ])

    let historialConCurso = []
    if (histData && histData.length > 0) {
      const folios = [...new Set(histData.map((h) => h.folio_curso).filter(Boolean))]
      const { data: cursosPorFolio } = await supabase
        .from('cursos')
        .select('id, folio, nombre, fecha_inicio, fecha_fin, horas, tipo, departamento, convocatorias(nombre, mes, anio, fecha_inicio)')
        .in('folio', folios)
      const mapaCursos = Object.fromEntries((cursosPorFolio || []).map((c) => [c.folio, c]))
      historialConCurso = histData
        .map((h) => {
          const curso = mapaCursos[h.folio_curso]
          if (!curso) return null // el curso ya no existe en `cursos`; no se puede regenerar el PDF
          return {
            id: h.id,
            folio_personal: h.folio_personal,
            asistencia_aprobada: true,
            origen: 'historial',
            cursos: curso,
          }
        })
        .filter(Boolean)
    }

    const activasConOrigen = (insData || []).map((i) => ({ ...i, origen: 'activa' }))
    setInscripciones([...activasConOrigen, ...historialConCurso])

    const aprobadasIds = [...activasConOrigen, ...historialConCurso]
      .filter((i) => i.asistencia_aprobada === true)
      .map((i) => i.id)
    setEncuestasRespondidas(await obtenerInscripcionesConEncuestaRespondida(aprobadasIds))

    const miNombre = normalizar(docente.nombre_completo)
    const comoInstructor = (cursosData || []).filter((c) => normalizar(c.instructor) === miNombre)
    setCursosComoInstructor(comoInstructor)

    setCargando(false)
  }

  async function descargar(ins) {
    setGenerando(ins.id)
    try {
      await descargarConstancia('constancia', {
        docenteId: docente.id,
        cursoId: ins.cursos?.id,
        nombreCompleto: docente.nombre_completo,
        curso: ins.cursos?.nombre,
        fechaInicio: ins.cursos?.fecha_inicio,
        fechaFin: ins.cursos?.fecha_fin,
        horas: ins.cursos?.horas,
        departamento: docente.departamento,
        folioPersonal: ins.folio_personal,
        tipo: ins.cursos?.tipo,
      })
    } catch (err) {
      console.error(err)
      alert('No se pudo generar la constancia: ' + err.message)
    }
    setGenerando(null)
  }

  async function descargarReconocimiento(curso) {
    setGenerando(curso.id)
    try {
      await descargarConstancia('reconocimiento', {
        docenteId: docente.id,
        cursoId: curso.id,
        nombreCompleto: docente.nombre_completo,
        curso: curso.nombre,
        fechaInicio: curso.fecha_inicio,
        fechaFin: curso.fecha_fin,
        horas: curso.horas,
        departamento: curso.departamento,
        folioPersonal: curso.folio,
        tipo: curso.tipo,
      })
    } catch (err) {
      console.error(err)
      alert('No se pudo generar el reconocimiento: ' + err.message)
    }
    setGenerando(null)
  }

  if (cargando) return <p className="text-center text-itd-navyDark/50 py-12">Cargando…</p>

  // Mientras el docente está contestando la encuesta de una inscripción,
  // mostramos solo eso -- al terminar, regresa a la lista ya actualizada.
  if (encuestaActiva) {
    const conv = encuestaActiva.cursos?.convocatorias
    const periodoAnteriorTexto = conv ? calcularPeriodoAnteriorTexto(conv.mes, conv.anio) : ''
    return (
      <EncuestaOpinion
        docente={docente}
        inscripcion={encuestaActiva}
        curso={encuestaActiva.cursos}
        periodoAnteriorTexto={periodoAnteriorTexto}
        onCancelar={() => setEncuestaActiva(null)}
        onCompletado={async () => {
          setEncuestaActiva(null)
          await cargar()
        }}
      />
    )
  }

  const aprobadas = inscripciones.filter((i) => i.asistencia_aprobada === true)
  const pendientes = inscripciones.filter((i) => i.origen === 'activa' && i.asistencia_aprobada !== true)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
        <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">
          Descarga tus Constancias
        </h2>
        <p className="text-sm text-itd-navyDark/60 mb-6">
          Aquí aparecen los cursos que ya fueron validados con tu asistencia. Para el periodo de Agosto,
          la descarga está habilitada directamente con tu asistencia aprobada. A partir del próximo periodo,
          se requerirá contar con ambas condiciones (asistencia aprobada y encuesta contestada) para desbloquearla.
        </p>

        {aprobadas.length === 0 ? (
          <p className="text-center text-itd-navyDark/50 py-8">
            Todavía no tienes constancias listas para descargar.
          </p>
        ) : (
          <div className="space-y-3 mb-8">
            {aprobadas.map((ins) => {
              const requiereEncuesta = !esPeriodoAgostoOAnterior(ins)
              const yaRespondio = !requiereEncuesta || encuestasRespondidas.has(ins.id)
              const respondioEncuesta = encuestasRespondidas.has(ins.id)

              return (
                <div
                  key={ins.id}
                  className="rounded-xl border border-green-200 bg-green-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div>
                    <p className="font-medium text-sm text-itd-navyDark">
                      {ins.cursos?.nombre}
                      {ins.origen === 'historial' && (
                        <span className="ml-2 text-[11px] font-normal text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          archivado
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-itd-navyDark/60 mt-1">
                      Folio {ins.folio_personal} · {formatearRangoFechas(ins.cursos?.fecha_inicio, ins.cursos?.fecha_fin)} · {ins.cursos?.horas} hrs
                    </p>
                  </div>
                  <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                    {yaRespondio ? (
                      <>
                        <button
                          onClick={() => descargar(ins)}
                          disabled={generando === ins.id}
                          className="rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-50"
                        >
                          {generando === ins.id ? 'Generando…' : '⬇ Descargar constancia'}
                        </button>
                        {!requiereEncuesta && (
                          respondioEncuesta ? (
                            <span className="text-[11px] text-green-700 font-medium">✓ Encuesta contestada</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEncuestaActiva(ins)}
                              className="text-xs text-itd-navy/70 hover:text-itd-navy underline text-left sm:text-right"
                            >
                              📝 Contestar encuesta (opcional)
                            </button>
                          )
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => setEncuestaActiva(ins)}
                        className="rounded-lg bg-itd-gold text-itd-navyDark px-4 py-2 text-sm font-medium hover:brightness-95"
                      >
                        📝 Contestar encuesta para desbloquear
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {pendientes.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-itd-navyDark/70 mb-2">
              En espera de validación de asistencia
            </h3>
            <div className="space-y-2">
              {pendientes.map((ins) => (
                <div key={ins.id} className="rounded-lg border border-itd-navy/10 px-4 py-2 text-sm text-itd-navyDark/60">
                  {ins.cursos?.nombre}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {cursosComoInstructor.length > 0 && (
        <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">
            Tus Reconocimientos como Instructor
          </h2>
          <p className="text-sm text-itd-navyDark/60 mb-6">
            Cursos que impartiste y ya concluyeron.
          </p>
          <div className="space-y-3">
            {cursosComoInstructor.map((curso) => (
              <div
                key={curso.id}
                className="rounded-xl border border-purple-200 bg-purple-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <p className="font-medium text-sm text-itd-navyDark">{curso.nombre}</p>
                  <p className="text-xs text-itd-navyDark/60 mt-1">
                    Folio {curso.folio} · {formatearRangoFechas(curso.fecha_inicio, curso.fecha_fin)} · {curso.horas} hrs
                  </p>
                </div>
                <button
                  onClick={() => descargarReconocimiento(curso)}
                  disabled={generando === curso.id}
                  className="shrink-0 rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-50"
                >
                  {generando === curso.id ? 'Generando…' : '⬇ Descargar reconocimiento'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}