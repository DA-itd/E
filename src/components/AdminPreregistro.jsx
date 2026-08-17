import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { descargarCriteriosInstructor } from '../lib/criteriosInstructor'

function etiquetaPeriodo(p) {
  if (p === 'PERIODO_1') return 'Periodo 1'
  if (p === 'PERIODO_2') return 'Periodo 2'
  return p || 'Sin periodo'
}

// Pestaña de Administración -> Preregistro: revisa las propuestas de curso
// que los propios docentes capturan (ver PreregistroCurso.jsx, en el menú
// principal). Aquí se asigna el tipo (Docente/Profesional) y, al aprobar,
// los datos "pasan" prellenados a Convocatorias y cursos.
export default function AdminPreregistro({ onAprobar }) {
  const [lista, setLista] = useState(null) // null = cargando
  const [tipoSeleccionado, setTipoSeleccionado] = useState({}) // id -> 'Docente' | 'Profesional'
  const [folioSeleccionado, setFolioSeleccionado] = useState({}) // id -> 'TNM-054-XX-año'
  const [anioFolio, setAnioFolio] = useState(new Date().getFullYear())
  const [mostrarAnioFolio, setMostrarAnioFolio] = useState(false)
  const [verAprobados, setVerAprobados] = useState(false)
  const [evaluaciones, setEvaluaciones] = useState({}) // preregistro_id -> evaluación

  useEffect(() => {
    // Octubre a diciembre se lanza la convocatoria de enero del año siguiente,
    // así que en esos meses hay que poder elegir el año del folio. El resto
    // del año se asume el año actual sin preguntar.
    const hoy = new Date()
    const enZonaAmbigua = hoy.getMonth() + 1 >= 10
    setMostrarAnioFolio(enZonaAmbigua)
    setAnioFolio(enZonaAmbigua ? hoy.getFullYear() + 1 : hoy.getFullYear())
    cargar()
  }, [])

  useEffect(() => {
    if (lista) sugerirFolios(anioFolio, lista.filter((i) => i.estado !== 'aprobado'))
  }, [lista, anioFolio])

  async function cargar() {
    const { data } = await supabase
      .from('preregistro_cursos')
      .select('*, docentes(nombre_completo, email, departamento)')
      .order('created_at', { ascending: false })
    setLista(data || [])

    const { data: evalData } = await supabase.from('evaluaciones_instructores').select('*')
    const mapa = {}
    ;(evalData || []).forEach((ev) => { mapa[ev.preregistro_id] = ev })
    setEvaluaciones(mapa)
  }

  // Sugiere folios consecutivos para los pendientes visibles, sin pisar los
  // que el usuario ya haya editado a mano.
  async function sugerirFolios(anio, pendientesActuales) {
    const { data: base } = await supabase.rpc('siguiente_folio_curso', { anio })
    const match = base?.match(/TNM-054-(\d{2})-(\d{4})/)
    if (!match) return
    let n = parseInt(match[1], 10)
    const nuevos = {}
    pendientesActuales.forEach((item) => {
      nuevos[item.id] = `TNM-054-${String(n).padStart(2, '0')}-${anio}`
      n += 1
    })
    setFolioSeleccionado((prev) => ({ ...nuevos, ...prev }))
  }

  function cambiarAnioFolio(anio) {
    setAnioFolio(anio)
    setFolioSeleccionado({}) // limpia para regenerar todos con el nuevo año
  }

  async function borrar(item) {
    if (!confirm(`¿Borrar la propuesta "${item.curso}"?`)) return
    await supabase.from('preregistro_cursos').delete().eq('id', item.id)
    cargar()
  }

  async function aprobar(item) {
    const tipo = tipoSeleccionado[item.id]
    if (!tipo) {
      alert('Antes de aprobar, elige si es tipo Docente o Profesional.')
      return
    }
    const folio = folioSeleccionado[item.id]
    if (!folio) {
      alert('Antes de aprobar, confirma el folio del curso.')
      return
    }

    const { data: convActiva } = await supabase
      .from('convocatorias')
      .select('*')
      .eq('activo', true)
      .order('fecha_inicio', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!convActiva) {
      alert('No hay una convocatoria activa para asignar este curso. Crea o activa una en "Convocatorias y cursos" primero.')
      return
    }

    const fechaInicio = item.periodo === 'PERIODO_2' ? convActiva.periodo2_inicio : convActiva.periodo1_inicio
    const fechaFin = item.periodo === 'PERIODO_2' ? convActiva.periodo2_fin : convActiva.periodo1_fin

    const { error: errorCurso } = await supabase.from('cursos').insert({
      convocatoria_id: convActiva.id,
      folio,
      semana: item.periodo || '',
      nombre: item.curso,
      objetivo: item.objetivo || '',
      instructor: item.docentes?.nombre_completo || '',
      departamento: item.dirigido_a || item.docentes?.departamento || '',
      fecha_inicio: fechaInicio || null,
      fecha_fin: fechaFin || null,
      horas: item.duracion_horas || '',
      horario: item.horario || '',
      tipo,
      cupo_max: 30,
      status: 'borrador', // aprobado, pero tú decides cuándo publicarlo desde Convocatorias y cursos
    })

    if (errorCurso) {
      alert('No se pudo crear el curso: ' + errorCurso.message)
      return
    }

    await supabase.from('preregistro_cursos').update({ estado: 'aprobado', tipo }).eq('id', item.id)
    cargar()
  }

  const pendientes = lista ? lista.filter((i) => i.estado !== 'aprobado') : []
  const aprobados = lista ? lista.filter((i) => i.estado === 'aprobado') : []

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">Preregistro de Cursos</h2>
      <p className="text-sm text-itd-navyDark/60 mb-6">
        Propuestas de curso capturadas por los docentes. Asigna el tipo, confirma el folio y aprueba: el
        curso se crea directo (como borrador, sin publicar) en Convocatorias y cursos.
      </p>

      <h3 className="text-sm font-semibold text-itd-navyDark/70 mb-3">
        Pendientes de revisar {lista && `(${pendientes.length})`}
      </h3>

      {mostrarAnioFolio && pendientes.length > 0 && (
        <div className="flex items-center gap-2 mb-4 text-xs text-itd-navyDark/60">
          <span>Año del folio para estos cursos:</span>
          <select
            value={anioFolio}
            onChange={(e) => cambiarAnioFolio(Number(e.target.value))}
            className="rounded-lg border border-itd-navy/20 px-2 py-1 text-xs"
          >
            <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
            <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
          </select>
        </div>
      )}

      {!lista ? (
        <p className="text-center text-itd-navyDark/50 py-6">Cargando…</p>
      ) : pendientes.length === 0 ? (
        <p className="text-sm text-itd-navyDark/40 py-2">No hay propuestas pendientes.</p>
      ) : (
        <div className="space-y-3">
          {pendientes.map((item) => (
            <div key={item.id} className="rounded-xl border border-itd-navy/10 p-4">
              <p className="font-semibold text-itd-navyDark">{item.curso}</p>
              {item.objetivo && <p className="text-sm text-itd-navyDark/60 mt-1">{item.objetivo}</p>}
              <p className="text-xs text-itd-navyDark/50 mt-2">
                {etiquetaPeriodo(item.periodo)}
                {item.duracion_horas && ` · ${item.duracion_horas} hrs`}
                {item.horario && ` · ${item.horario}`}
                {item.modalidad && ` · ${item.modalidad}`}
              </p>
              {item.nombre_jefe && (
                <p className="text-xs text-itd-navyDark/50">Jefe(a) de depto.: {item.nombre_jefe}</p>
              )}
              <p className="text-xs text-itd-navyDark/50 mt-1">
                Propuesto por: <strong>{item.docentes?.nombre_completo || 'Desconocido'}</strong>
                {item.docentes?.departamento && ` (${item.docentes.departamento})`}
              </p>

              {evaluaciones[item.id] && (
                <button
                  onClick={() => descargarCriteriosInstructor(evaluaciones[item.id])}
                  className="mt-2 text-xs font-medium text-itd-navy border border-itd-navy/20 rounded-lg px-3 py-1.5 hover:bg-itd-sand"
                >
                  📄 Descargar Criterios de Instructor
                  {' '}({evaluaciones[item.id].aceptado ? '✅ Aceptado' : '❌ Rechazado'})
                </button>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-itd-navy/5">
                <select
                  value={tipoSeleccionado[item.id] || ''}
                  onChange={(e) => setTipoSeleccionado({ ...tipoSeleccionado, [item.id]: e.target.value })}
                  className="rounded-lg border border-itd-navy/20 px-2 py-1.5 text-xs"
                >
                  <option value="">Tipo…</option>
                  <option value="Docente">Docente</option>
                  <option value="Profesional">Profesional</option>
                </select>
                <input
                  value={folioSeleccionado[item.id] || ''}
                  onChange={(e) => setFolioSeleccionado({ ...folioSeleccionado, [item.id]: e.target.value })}
                  placeholder="Folio…"
                  title="Folio del curso (TNM-054-XX-año)"
                  className="rounded-lg border border-itd-navy/20 px-2 py-1.5 text-xs w-36"
                />
                <button
                  onClick={() => aprobar(item)}
                  className="rounded-lg bg-itd-navy text-white px-3 py-1.5 text-xs font-medium hover:bg-itd-navyDark"
                >
                  Aprobar y crear curso →
                </button>
                <button onClick={() => borrar(item)} className="text-xs text-red-600 hover:underline ml-auto">
                  Borrar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {aprobados.length > 0 && (
        <div className="mt-8 border-t border-itd-navy/10 pt-4">
          <button onClick={() => setVerAprobados((v) => !v)} className="text-xs text-itd-navyDark/50 hover:underline">
            {verAprobados ? 'Ocultar' : 'Ver'} ya aprobados ({aprobados.length})
          </button>
          {verAprobados && (
            <div className="mt-3 space-y-1">
              {aprobados.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs text-itd-navyDark/50 py-1">
                  <span>
                    {item.curso} · {item.docentes?.nombre_completo} · {item.tipo}
                  </span>
                  <button onClick={() => borrar(item)} className="text-red-600 hover:underline">Borrar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
