// src/components/AdminConstancias.jsx
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

// Limpia títulos profesionales y honoríficos (Dr., Ing., Mtro., etc.)
function limpiarTitulos(texto) {
  return normalizar(texto)
    .replace(/\b(DR|DRA|ING|MTRO|MTRA|LIC|DOC|PHD|MC|MA|PROF|PROFA)\b\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Compara nombres de forma flexible ignorando títulos y orden parcial
function coincidenNombres(nom1, nom2) {
  const n1 = limpiarTitulos(nom1)
  const n2 = limpiarTitulos(nom2)
  if (!n1 || !n2) return false
  if (n1 === n2) return true
  if (n1.includes(n2) || n2.includes(n1)) return true

  // Comparar por palabras clave de apellidos y nombres
  const palabras1 = n1.split(' ').filter((p) => p.length > 2)
  const palabras2 = n2.split(' ').filter((p) => p.length > 2)
  const coincidencias = palabras1.filter((p) => palabras2.includes(p))
  return coincidencias.length >= 2
}

export default function AdminConstancias() {
  const [todosDocentes, setTodosDocentes] = useState([])
  const [todosCursos, setTodosCursos] = useState([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [docenteSel, setDocenteSel] = useState(null)
  const [inscripciones, setInscripciones] = useState([])
  const [cursosComoInstructor, setCursosComoInstructor] = useState([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [generando, setGenerando] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarDatosIniciales()
  }, [])

  async function cargarDatosIniciales() {
    setCargandoLista(true)
    setError('')
    try {
      const [{ data: docentesData, error: errDoc }, { data: cursosData, error: errCur }] =
        await Promise.all([
          supabase
            .from('docentes')
            .select('id, nombre_completo, email, departamento')
            .order('nombre_completo'),
          supabase
            .from('cursos')
            .select('id, folio, nombre, instructor, departamento, fecha_inicio, fecha_fin, horas, tipo, status')
            .not('instructor', 'is', null)
            .order('fecha_inicio', { ascending: false }),
        ])

      if (errDoc) console.warn('Error al cargar docentes:', errDoc)
      if (errCur) console.warn('Error al cargar cursos:', errCur)

      setTodosDocentes(docentesData || [])
      setTodosCursos(cursosData || [])
    } catch (e) {
      setError('No se pudo cargar la lista completa: ' + e.message)
    } finally {
      setCargandoLista(false)
    }
  }

  // Búsqueda inteligente: encuentra docentes del catálogo, instructores de cursos y nombres de cursos
  const sugerencias = useMemo(() => {
    const q = normalizar(busqueda)
    if (q.length < 2) return []

    // 1. Docentes del catálogo oficial
    const docentesEncontrados = todosDocentes
      .filter((d) => normalizar(d.nombre_completo).includes(q) || normalizar(d.email).includes(q))
      .map((d) => ({
        id: d.id,
        tipoElemento: 'docente',
        nombre_completo: d.nombre_completo,
        email: d.email || 'Sin correo',
        departamento: d.departamento || 'Sin departamento',
        badge: 'Docente registrado',
      }))

    // 2. Instructores de cursos (incluso si no están dados de alta como docentes o tienen título Dr./Ing.)
    const mapaInstructores = new Map()
    for (const c of todosCursos) {
      if (!c.instructor) continue
      const instNorm = normalizar(c.instructor)
      if (instNorm.includes(q) || normalizar(c.nombre).includes(q) || normalizar(c.folio).includes(q)) {
        if (!mapaInstructores.has(c.instructor)) {
          mapaInstructores.set(c.instructor, {
            id: `inst_${c.id}`,
            tipoElemento: 'instructor',
            nombre_completo: c.instructor,
            email: `Instructor del curso: ${c.nombre}`,
            departamento: c.departamento || 'Desarrollo Académico',
            badge: 'Instructor de Curso',
            cursoDirecto: c,
          })
        }
      }
    }

    const instructoresEncontrados = Array.from(mapaInstructores.values())

    // Combinar sin duplicar nombres idénticos
    const combinados = [...docentesEncontrados]
    for (const inst of instructoresEncontrados) {
      const yaExiste = combinados.some((d) => coincidenNombres(d.nombre_completo, inst.nombre_completo))
      if (!yaExiste) {
        combinados.push(inst)
      }
    }

    return combinados.slice(0, 10)
  }, [busqueda, todosDocentes, todosCursos])

  async function seleccionar(item) {
    setDocenteSel(item)
    setBusqueda('')
    setCargandoDetalle(true)
    setError('')

    // Cursos como instructor: busca cualquier curso que coincida con su nombre (con o sin Dr./Ing.)
    const cursosImpartidos = todosCursos.filter((c) =>
      coincidenNombres(c.instructor, item.nombre_completo)
    )
    setCursosComoInstructor(cursosImpartidos)

    // Si tiene ID real en la tabla docentes, buscar también inscripciones de cursos como alumno
    let inscripcionesActivas = []
    let historialConCurso = []

    if (item.tipoElemento === 'docente' && item.id && !item.id.startsWith('inst_')) {
      try {
        const { data: insData } = await supabase
          .from('inscripciones')
          .select('id, folio_personal, asistencia_aprobada, cursos(id, nombre, fecha_inicio, fecha_fin, horas, folio, tipo, departamento)')
          .eq('docente_id', item.id)
          .eq('estado', 'activo')
          .eq('asistencia_aprobada', true)
          .order('fecha_inscripcion', { ascending: false })

        inscripcionesActivas = (insData || []).map((i) => ({ ...i, origen: 'activa' }))

        // Historial previo
        if (item.email && item.email.includes('@')) {
          const { data: histData } = await supabase
            .from('inscripciones_historial')
            .select('id, folio_personal, folio_curso, asistencia_aprobada')
            .ilike('email', item.email)
            .eq('asistencia_aprobada', 'Sí')

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
                if (!curso) return null
                return {
                  id: h.id,
                  folio_personal: h.folio_personal,
                  origen: 'historial',
                  cursos: curso,
                }
              })
              .filter(Boolean)
          }
        }
      } catch (err) {
        console.warn('Error cargando inscripciones:', err)
      }
    }

    setInscripciones([...inscripcionesActivas, ...historialConCurso])
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
        docenteId: docenteSel?.id || curso.id,
        cursoId: curso.id,
        nombreCompleto: curso.instructor || docenteSel?.nombre_completo,
        curso: curso.nombre,
        fechaInicio: curso.fecha_inicio,
        fechaFin: curso.fecha_fin,
        horas: curso.horas,
        departamento: curso.departamento || docenteSel?.departamento,
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
      <div className="flex items-center justify-between gap-4 mb-2">
        <h2 className="font-display text-xl font-bold text-itd-navy flex items-center gap-2">
          <span>📜</span>
          <span>Constancias y Reconocimientos Oficiales</span>
        </h2>
        <span className="text-xs bg-itd-navy/5 text-itd-navy font-semibold px-2.5 py-1 rounded-full border border-itd-navy/10">
          Soporte y Emisión Administrativa
        </span>
      </div>

      <p className="text-sm text-itd-navyDark/60 mb-6">
        Busca por nombre, correo, nombre de curso o folio para emitir y descargar de inmediato las
        <strong> constancias de acreditación</strong> (participante) o los <strong>reconocimientos oficiales de instructor</strong>.
      </p>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium mb-4">
          ⚠️ {error}
        </div>
      )}

      {!docenteSel && (
        <div className="relative">
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
            Buscar docente o instructor:
          </label>
          <div className="relative">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={
                cargandoLista
                  ? 'Cargando catálogo…'
                  : 'Escribe nombre del docente (ej. Alejandro Calderón Rentería, Calderón, etc.)…'
              }
              disabled={cargandoLista}
              autoFocus
              className="w-full rounded-xl border border-slate-300 focus:border-itd-navy focus:ring-2 focus:ring-itd-navy/10 px-4 py-3 text-sm transition-all outline-hidden pr-10"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {busqueda.trim().length >= 2 && (
            <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {sugerencias.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  No se encontró ningún docente o instructor coincidente con "{busqueda}".
                </div>
              ) : (
                sugerencias.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => seleccionar(item)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-bold text-itd-navy group-hover:text-itd-guinda transition-colors">
                        {item.nombre_completo}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.email} {item.departamento ? `· ${item.departamento}` : ''}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 border ${
                        item.badge === 'Instructor de Curso'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {docenteSel && (
        <div className="space-y-6">
          <button
            type="button"
            onClick={regresarABusqueda}
            className="text-xs font-bold text-itd-navy hover:text-itd-guinda transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>←</span>
            <span>Buscar a otra persona</span>
          </button>

          {/* Tarjeta del perfil seleccionado */}
          <div className="rounded-2xl border border-itd-navy/15 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-itd-navy text-white flex items-center justify-center font-display text-lg font-black shrink-0 shadow-xs">
                {docenteSel.nombre_completo.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-itd-navy">
                    {docenteSel.nombre_completo}
                  </h3>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
                    Activo en Sistema
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 font-medium">
                  {docenteSel.email} {docenteSel.departamento ? `· ${docenteSel.departamento}` : ''}
                </p>
              </div>
            </div>
          </div>

          {cargandoDetalle ? (
            <p className="text-center text-slate-400 py-8 text-xs font-medium">
              Cargando constancias y reconocimientos…
            </p>
          ) : (
            <div className="space-y-6">
              {/* SECCIÓN 1: RECONOCIMIENTOS COMO INSTRUCTOR */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                    <span>👨‍🏫</span>
                    <span>Reconocimientos como Instructor ({cursosComoInstructor.length})</span>
                  </h4>
                  {cursosComoInstructor.length > 0 && (
                    <span className="text-[11px] text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                      Listo para descargar en PDF con sello y QR
                    </span>
                  )}
                </div>

                {cursosComoInstructor.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-slate-400 text-xs">
                    No tiene cursos registrados como instructor en este periodo.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cursosComoInstructor.map((curso) => (
                      <div
                        key={curso.id}
                        className="rounded-xl border border-purple-200 bg-purple-50/70 hover:bg-purple-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all shadow-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[10px] font-mono font-bold bg-purple-200/80 text-purple-900 px-2 py-0.5 rounded">
                              Folio: {curso.folio || 'Sin folio'}
                            </span>
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                              Estatus: {curso.status || 'Activo'}
                            </span>
                          </div>
                          <p className="font-bold text-sm text-itd-navy">{curso.nombre}</p>
                          <p className="text-xs text-slate-600 mt-1">
                            📅 {formatearRangoFechas(curso.fecha_inicio, curso.fecha_fin)} · ⏱️ {curso.horas} hrs · 🏛️ {curso.departamento}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => descargarReconocimiento(curso)}
                          disabled={generando === curso.id}
                          className="shrink-0 rounded-xl bg-purple-700 hover:bg-purple-800 active:scale-95 text-white px-4 py-2.5 text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>{generando === curso.id ? '⏳' : '⬇'}</span>
                          <span>
                            {generando === curso.id ? 'Generando PDF…' : 'Descargar Reconocimiento'}
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECCIÓN 2: CONSTANCIAS COMO PARTICIPANTE */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                    <span>🎓</span>
                    <span>Cursos Acreditados como Participante ({inscripciones.length})</span>
                  </h4>
                </div>

                {inscripciones.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-slate-400 text-xs">
                    No tiene cursos con asistencia acreditada como participante.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inscripciones.map((ins) => (
                      <div
                        key={ins.id}
                        className="rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all shadow-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[10px] font-mono font-bold bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded">
                              Folio: {ins.folio_personal || 'Sin folio'}
                            </span>
                            {ins.origen === 'historial' && (
                              <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                                Periodo Anterior (Archivado)
                              </span>
                            )}
                          </div>
                          <p className="font-bold text-sm text-itd-navy">{ins.cursos?.nombre}</p>
                          <p className="text-xs text-slate-600 mt-1">
                            📅 {formatearRangoFechas(ins.cursos?.fecha_inicio, ins.cursos?.fecha_fin)} · ⏱️ {ins.cursos?.horas} hrs · 🏛️ {ins.cursos?.departamento}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => descargar(ins)}
                          disabled={generando === ins.id}
                          className="shrink-0 rounded-xl bg-itd-navy hover:bg-itd-navyDark active:scale-95 text-white px-4 py-2.5 text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>{generando === ins.id ? '⏳' : '⬇'}</span>
                          <span>
                            {generando === ins.id ? 'Generando PDF…' : 'Descargar Constancia'}
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
