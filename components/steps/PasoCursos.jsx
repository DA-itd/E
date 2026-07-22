import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatearRangoFechas, formatearHora } from '../../lib/formatoFechas'
import BotonEscuchar from '../BotonEscuchar'

export default function PasoCursos({ docente, onSiguiente, onRegresar }) {
  const [cargando, setCargando] = useState(true)
  const [convocatorias, setConvocatorias] = useState([])
  const [cursos, setCursos] = useState([])
  const [cupos, setCupos] = useState({})
  const [misActivas, setMisActivas] = useState([]) // [{id, curso_id}]
  const [seleccion, setSeleccion] = useState([]) // curso_id seleccionados (incluye ya inscritos)
  const [semanaActiva, setSemanaActiva] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [avisoCupo, setAvisoCupo] = useState({})
  const [liberando, setLiberando] = useState(null)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    const hoy = new Date().toISOString().slice(0, 10)

    const { data: convData } = await supabase
      .from('convocatorias')
      .select('*')
      .eq('activo', true)
      .gte('fecha_fin', hoy)
      .order('fecha_inicio', { ascending: true })

    const convIds = (convData || []).map((c) => c.id)

    const [{ data: cursosData }, { data: cupoData }, { data: misData }] = await Promise.all([
      convIds.length
        ? supabase.from('cursos').select('*').in('convocatoria_id', convIds).eq('status', 'activo').order('semana')
        : Promise.resolve({ data: [] }),
      supabase.from('vista_cupo_cursos').select('*'),
      supabase
        .from('inscripciones')
        .select('id, curso_id, folio_personal')
        .eq('docente_id', docente.id)
        .eq('estado', 'activo'),
    ])

    setConvocatorias(convData || [])
    setCursos(cursosData || [])
    const mapaCupo = {}
    ;(cupoData || []).forEach((c) => (mapaCupo[c.curso_id] = c))
    setCupos(mapaCupo)
    const activas = misData || []
    setMisActivas(activas)
    setSeleccion(activas.map((r) => r.curso_id))

    const semanas = [...new Set((cursosData || []).map((c) => c.semana))].sort()
    setSemanaActiva((prev) => prev || semanas[0] || null)

    setCargando(false)
  }

  const semanasDisponibles = useMemo(() => {
    const infoPorSemana = {}
    for (const c of cursos) {
      if (!infoPorSemana[c.semana]) {
        infoPorSemana[c.semana] = { fechaInicio: c.fecha_inicio, fechaFin: c.fecha_fin }
      }
    }
    return Object.entries(infoPorSemana)
      .map(([semana, info]) => ({ semana, ...info }))
      .sort((a, b) => (a.fechaInicio > b.fechaInicio ? 1 : -1))
  }, [cursos])

  const cursosDeLaSemana = useMemo(() => {
    let lista = cursos.filter((c) => c.semana === semanaActiva)
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase()
      lista = lista.filter((c) => c.nombre.toLowerCase().includes(q))
    }
    return lista
  }, [cursos, semanaActiva, busqueda])

  async function liberarCurso(curso) {
    const inscripcion = misActivas.find((r) => r.curso_id === curso.id)
    if (!inscripcion) return
    if (!confirm(`¿Seguro que quieres liberar tu lugar en "${curso.nombre}"? Otro docente podrá tomarlo.`)) return

    setLiberando(curso.id)
    const { error } = await supabase
      .from('inscripciones')
      .update({ estado: 'cancelado', fecha_cancelacion: new Date().toISOString() })
      .eq('id', inscripcion.id)
    setLiberando(null)

    if (!error) {
      supabase.functions
        .invoke('send-email', {
          body: {
            tipo: 'cancelacion',
            email: docente.email,
            nombre: docente.nombre_completo,
            cursos: [
              {
                nombre: curso.nombre,
                folio_personal: inscripcion.folio_personal,
                fechas: formatearRangoFechas(curso.fecha_inicio, curso.fecha_fin),
                horario: `${formatearHora(curso.hora_inicio)} a ${formatearHora(curso.hora_fin)} hrs`,
                lugar: curso.lugar,
              },
            ],
          },
        })
        .catch(() => {})
      await cargar()
    }
  }

  function toggleCurso(curso) {
    setAvisoCupo((prev) => ({ ...prev, [curso.id]: null }))
    const yaEstaba = misActivas.some((r) => r.curso_id === curso.id)

    if (yaEstaba) {
      liberarCurso(curso)
      return
    }

    if (seleccion.includes(curso.id)) {
      setSeleccion((prev) => prev.filter((id) => id !== curso.id))
      return
    }

    const cupo = cupos[curso.id]
    const disponibles = cupo ? cupo.disponibles : curso.cupo_max
    if (disponibles <= 0) {
      setAvisoCupo((prev) => ({ ...prev, [curso.id]: 'Este curso ya no tiene cupo disponible.' }))
      return
    }

    if (seleccion.length >= 2) {
      setAvisoCupo((prev) => ({ ...prev, [curso.id]: 'Ya seleccionaste 2 cursos, el máximo permitido. Libera uno para elegir otro.' }))
      return
    }

    const traslape = seleccion.some((idSel) => {
      const otro = cursos.find((c) => c.id === idSel)
      if (!otro) return false
      return curso.fecha_inicio <= otro.fecha_fin && curso.fecha_fin >= otro.fecha_inicio
    })
    if (traslape) {
      setAvisoCupo((prev) => ({
        ...prev,
        [curso.id]: 'Las fechas de este curso se empalman con otro que ya seleccionaste.',
      }))
      return
    }

    setSeleccion((prev) => [...prev, curso.id])
  }

  if (cargando) {
    return <p className="text-center text-itd-navyDark/50 py-12">Cargando cursos…</p>
  }

  if (convocatorias.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-itd-navy/10 p-8 text-center text-itd-navyDark/60">
        No hay ninguna convocatoria abierta en este momento. Vuelve a intentarlo cuando se abra el
        siguiente periodo.
      </div>
    )
  }

  const idsYaInscritos = misActivas.map((r) => r.curso_id)
  const nuevasSeleccionadas = seleccion.filter((id) => !idsYaInscritos.includes(id))

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-semibold text-itd-navy">Selección de Cursos</h2>
            <BotonEscuchar texto="Selección de cursos. Selecciona hasta dos cursos de la semana que te interese." />
          </div>
          <p className="text-sm text-itd-navyDark/60">
            Seleccionados: <strong>{seleccion.length} / 2</strong>
            {idsYaInscritos.length > 0 && ' (incluye los cursos que ya tenías inscritos)'}
          </p>
        </div>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar curso…"
          className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm w-full sm:w-64"
        />
      </div>

      {/* Selector de semana */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {semanasDisponibles.map(({ semana, fechaInicio, fechaFin }) => (
          <button
            key={semana}
            onClick={() => setSemanaActiva(semana)}
            className={`rounded-lg px-4 py-2 text-sm font-medium border transition-colors ${
              semana === semanaActiva
                ? 'bg-itd-navy text-white border-itd-navy'
                : 'bg-white text-itd-navyDark/70 border-itd-navy/15 hover:bg-itd-sand'
            }`}
          >
            <div>{semana}</div>
            <div className={`text-[11px] font-normal ${semana === semanaActiva ? 'text-white/70' : 'text-itd-navyDark/50'}`}>
              {formatearRangoFechas(fechaInicio, fechaFin)}
            </div>
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cursosDeLaSemana.map((curso) => {
          const cupo = cupos[curso.id]
          const disponibles = cupo ? cupo.disponibles : curso.cupo_max
          const cupoLleno = disponibles <= 0
          const seleccionado = seleccion.includes(curso.id)
          const yaEstaba = idsYaInscritos.includes(curso.id)

          return (
            <button
              key={curso.id}
              type="button"
              onClick={() => toggleCurso(curso)}
              disabled={liberando === curso.id}
              className={`text-left rounded-xl border p-4 transition-colors ${
                seleccionado
                  ? 'border-itd-navy bg-itd-navy/5'
                  : cupoLleno
                  ? 'border-gray-200 bg-gray-50 opacity-60'
                  : 'border-itd-navy/10 hover:border-itd-navy/30'
              }`}
            >
              <span
                className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full mb-2 ${
                  curso.tipo === 'Profesional'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {curso.tipo}
              </span>
              <p className="font-medium text-sm text-itd-navyDark leading-snug">{curso.nombre}</p>
              <p className="text-xs text-itd-navyDark/60 mt-2">
                🗓️ {formatearRangoFechas(curso.fecha_inicio, curso.fecha_fin)}
              </p>
              <p className="text-xs text-itd-navyDark/60">
                🕐 {formatearHora(curso.hora_inicio)} a {formatearHora(curso.hora_fin)} hrs
              </p>
              <p className="text-xs text-itd-navyDark/60">📍 {curso.lugar}</p>

              {yaEstaba ? (
                <p className="text-xs mt-2 font-medium text-green-700">
                  {liberando === curso.id ? 'Liberando…' : 'Ya inscrito · toca para liberar tu lugar'}
                </p>
              ) : (
                <p className={`text-xs mt-2 font-medium ${cupoLleno ? 'text-itd-guinda' : 'text-itd-navy/70'}`}>
                  {cupoLleno ? 'Cupo lleno' : `${disponibles} lugares disponibles`}
                </p>
              )}
              {avisoCupo[curso.id] && (
                <p className="text-xs mt-2 text-itd-guinda font-medium">{avisoCupo[curso.id]}</p>
              )}
            </button>
          )
        })}
        {cursosDeLaSemana.length === 0 && (
          <p className="col-span-full text-sm text-itd-navyDark/50 py-6 text-center">
            No hay cursos que coincidan con tu búsqueda en esta semana.
          </p>
        )}
      </div>

      <div className="flex justify-between items-center mt-8">
        <button onClick={onRegresar} className="text-sm text-itd-navyDark/60 hover:text-itd-navyDark">
          ← Regresar
        </button>
        <div className="flex items-center gap-3">
          {nuevasSeleccionadas.length === 0 && (
            <span className="text-xs text-itd-navyDark/50">Selecciona al menos un curso nuevo</span>
          )}
          <button
            onClick={() => onSiguiente(nuevasSeleccionadas, cursos)}
            disabled={nuevasSeleccionadas.length === 0}
            className="rounded-lg bg-itd-navy text-white px-6 py-2.5 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirmar →
          </button>
        </div>
      </div>
    </div>
  )
}
