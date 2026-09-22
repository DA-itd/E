import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatearRangoFechas } from '../lib/formatoFechas'
import { descargarConstancia } from '../lib/constancias'

function normalizar(texto) {
  return (texto || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export default function AdminConstancias() {
  const [todosDocentes, setTodosDocentes] = useState([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [docenteSel, setDocenteSel] = useState(null)
  const [inscripciones, setInscripciones] = useState([])
  const [cursosComoInstructor, setCursosComoInstructor] = useState([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [generando, setGenerando] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarTodosLosDocentes()
  }, [])

  async function cargarTodosLosDocentes() {
    setCargandoLista(true)
    const { data, error: errorDB } = await supabase
      .from('docentes')
      .select('id, nombre_completo, email, departamento')
      .order('nombre_completo')
    if (errorDB) setError('No se pudo cargar el catálogo de docentes: ' + errorDB.message)
    setTodosDocentes(data || [])
    setCargandoLista(false)
  }

  // Autocompletado en el cliente: no importa mayúsculas/minúsculas ni acentos,
  // así que "gonzalez", "GONZÁLEZ" o "gonzaléz" siempre van a encontrar a
  // "González" en la lista.
  const sugerencias = useMemo(() => {
    const q = normalizar(busqueda)
    if (q.length < 2) return []
    return todosDocentes
      .filter((d) => normalizar(d.nombre_completo).includes(q) || normalizar(d.email).includes(q))
      .slice(0, 8)
  }, [busqueda, todosDocentes])

  async function seleccionar(docente) {
    setDocenteSel(docente)
    setBusqueda('')
    setCargandoDetalle(true)
    setError('')
    const hoy = new Date().toISOString().slice(0, 10)

    // "El último archivado": todas las filas de una misma tanda de archivado
    // comparten el mismo instante exacto en `migrado_en`. Nos limitamos a la
    // tanda más reciente en toda la tabla, para no duplicar el Kardex.
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

    const [
      { data: insData, error: errIns },
      { data: cursosData, error: errCursos },
      { data: histData, error: errHist },
    ] = await Promise.all([
      supabase
        .from('inscripciones')
        .select('id, folio_personal, asistencia_aprobada, cursos(id, nombre, fecha_inicio, fecha_fin, horas, folio, tipo, departamento)')
        .eq('docente_id', docente.id)
        .eq('estado', 'activo')
        .eq('asistencia_aprobada', true)
        .order('fecha_inscripcion', { ascending: false }),
      supabase
        .from('cursos')
        .select('id, folio, nombre, instructor, departamento, fecha_inicio, fecha_fin, horas, tipo')
        .not('instructor', 'is', null)
        .lte('fecha_fin', hoy),
      histQuery,
    ])

    if (errIns || errCursos || errHist) {
      setError('No se pudo cargar la información del docente: ' + (errIns?.message || errCursos?.message || errHist?.message))
    }

    let historialConCurso = []
    if (histData && histData.length > 0) {
      const folios = [...new Set(histData.map((h) => h.folio_curso).filter(Boolean))]
      const { data: cursosPorFolio } = await supabase
        .from('cursos')
        .select('id, folio, nombre, fecha_inicio, fecha_fin, horas, tipo, departamento')
        .in('folio', folios)
      const mapaCursos = Object.fromEntries((cursosPorFolio || []).map((c) => [c.folio, c]))
      historialConCurso = histData
        .map((h) => {
          const curso = mapaCursos[h.folio_curso]
          if (!curso) return null // el curso ya no existe en `cursos`; no se puede regenerar el PDF
          return {
            id: h.id,
            folio_personal: h.folio_personal,
            origen: 'historial',
            cursos: curso,
          }
        })
        .filter(Boolean)
    }

    const activasConOrigen = (insData || []).map((i) => ({ ...i, origen: 'activa' }))
    setInscripciones([...activasConOrigen, ...historialConCurso])

    const miNombre = normalizar(docente.nombre_completo)
    setCursosComoInstructor((cursosData || []).filter((c) => normalizar(c.instructor) === miNombre))
    setCargandoDetalle(false)
  }

  function regresarABusqueda() {
    setDocenteSel(null)
    setInscripciones([])
    setCursosComoInstructor([])
  }

  async function descargar(ins) {
    setGenerando(ins.id)
    try {
      await descargarConstancia('constancia', {
        docenteId: docenteSel.id,
        cursoId: ins.cursos?.id,
        nombreCompleto: docenteSel.nombre_completo,
        curso: ins.cursos?.nombre,
        fechaInicio: ins.cursos?.fecha_inicio,
        fechaFin: ins.cursos?.fecha_fin,
        horas: ins.cursos?.horas,
        departamento: ins.cursos?.departamento || docenteSel.departamento,
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
        docenteId: docenteSel.id,
        cursoId: curso.id,
        nombreCompleto: docenteSel.nombre_completo,
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

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">
        Constancias de cualquier docente
      </h2>
      <p className="text-sm text-itd-navyDark/60 mb-6">
        Busca a un docente para descargar sus constancias o reconocimientos, incluyendo periodos ya
        archivados a historial. No se requiere que el docente haya contestado la encuesta de opinión
        — es para casos de soporte (ej. el docente perdió su constancia y te la pide directamente).
      </p>

      {error && <p className="text-sm text-itd-guinda mb-4">{error}</p>}

      {!docenteSel && (
        <div className="relative">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={cargandoLista ? 'Cargando docentes…' : 'Escribe el nombre o correo del docente…'}
            disabled={cargandoLista}
            autoFocus
            className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm disabled:opacity-50"
          />

          {busqueda.trim().length >= 2 && (
            <div className="mt-2 rounded-lg border border-itd-navy/10 overflow-hidden">
              {sugerencias.length === 0 ? (
                <p className="text-sm text-itd-navyDark/50 px-4 py-3">
                  Ningún docente coincide con "{busqueda}".
                </p>
              ) : (
                sugerencias.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => seleccionar(d)}
                    className="w-full text-left px-4 py-2.5 hover:bg-itd-sand/50 transition-colors border-b border-itd-navy/5 last:border-0"
                  >
                    <p className="text-sm font-medium text-itd-navyDark">{d.nombre_completo}</p>
                    <p className="text-xs text-itd-navyDark/50">{d.email} · {d.departamento}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {docenteSel && (
        <div>
          <button
            onClick={regresarABusqueda}
            className="text-xs text-itd-navy/70 hover:text-itd-navy underline mb-4"
          >
            ← Buscar otro docente
          </button>

          <div className="rounded-xl border border-itd-navy/10 bg-itd-sand/30 px-4 py-3 mb-6">
            <p className="text-sm font-semibold text-itd-navyDark">{docenteSel.nombre_completo}</p>
            <p className="text-xs text-itd-navyDark/60">{docenteSel.email} · {docenteSel.departamento}</p>
          </div>

          {cargandoDetalle ? (
            <p className="text-center text-itd-navyDark/50 py-8">Cargando…</p>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-itd-navyDark/70 mb-2">
                Cursos con asistencia aprobada
              </h3>
              {inscripciones.length === 0 ? (
                <p className="text-sm text-itd-navyDark/50 py-4 mb-4">
                  No tiene ningún curso con asistencia aprobada todavía.
                </p>
              ) : (
                <div className="space-y-3 mb-8">
                  {inscripciones.map((ins) => (
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
                      <button
                        onClick={() => descargar(ins)}
                        disabled={generando === ins.id}
                        className="shrink-0 rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-50"
                      >
                        {generando === ins.id ? 'Generando…' : '⬇ Descargar constancia'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {cursosComoInstructor.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-itd-navyDark/70 mb-2">
                    Reconocimientos como instructor
                  </h3>
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
            </>
          )}
        </div>
      )}
    </div>
  )
}
