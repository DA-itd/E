// src/components/AdminPreregistro.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { descargarCriteriosInstructor } from '../lib/criteriosInstructor'
import { descargarOficioRegistro } from '../lib/oficio'

function etiquetaPeriodo(p) {
  if (p === 'PERIODO_1') return 'Periodo 1'
  if (p === 'PERIODO_2') return 'Periodo 2'
  return p || 'Sin periodo'
}

export default function AdminPreregistro({ onAprobar }) {
  const [lista, setLista] = useState(null)
  const [tipoSeleccionado, setTipoSeleccionado] = useState({})
  const [folioSeleccionado, setFolioSeleccionado] = useState({})
  const [anioFolio, setAnioFolio] = useState(new Date().getFullYear())
  const [mostrarAnioFolio, setMostrarAnioFolio] = useState(false)
  const [verAprobados, setVerAprobados] = useState(false)
  const [evaluaciones, setEvaluaciones] = useState({})
  const [convActiva, setConvActiva] = useState(null)

  useEffect(() => {
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
    // 1. Cargar la convocatoria para poder generar el oficio
    const { data: conv } = await supabase
      .from('convocatorias')
      .select('*')
      .eq('activo', true)
      .order('fecha_inicio', { ascending: true })
      .limit(1)
      .maybeSingle()
    setConvActiva(conv)

    // 2. Cargar preregistros
    const { data } = await supabase
      .from('preregistro_cursos')
      .select('*, docentes(nombre_completo, email, departamento)')
      .order('created_at', { ascending: false })
    setLista(data || [])

    // 3. Cargar evaluaciones (Criterios llenados por el Jefe)
    const { data: evalData } = await supabase.from('evaluaciones_instructores').select('*')
    const mapa = {}
    ;(evalData || []).forEach((ev) => { mapa[ev.preregistro_id] = ev })
    setEvaluaciones(mapa)
  }

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
    setFolioSeleccionado({})
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

    if (!convActiva) {
      alert('No hay una convocatoria activa para asignar este curso.')
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
      status: 'borrador',
    })

    if (errorCurso) {
      alert('No se pudo crear el curso: ' + errorCurso.message)
      return
    }

    await supabase.from('preregistro_cursos').update({ estado: 'aprobado', tipo }).eq('id', item.id)
    cargar()
  }

  // Genera URL pública para abrir PDFs subidos a Storage
  function obtenerUrlArchivo(registroId, nombreArchivo) {
    const { data } = supabase.storage
      .from('documentos_preregistro')
      .getPublicUrl(`${registroId}/${nombreArchivo}`);
    return data.publicUrl;
  }

  const pendientes = lista ? lista.filter((i) => i.estado !== 'aprobado') : []
  const aprobados = lista ? lista.filter((i) => i.estado === 'aprobado') : []

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">Revisión de Propuestas (Preregistros)</h2>
      <p className="text-sm text-itd-navyDark/60 mb-6">
        Aquí revisas que los Jefes hayan llenado correctamente la información. Puedes abrir los 4 documentos finales para validar. Si todo está bien, asigna Tipo y aprueba el curso.
      </p>

      <h3 className="text-sm font-semibold text-itd-navyDark/70 mb-3">
        Pendientes de revisar {lista && `(${pendientes.length})`}
      </h3>

      {mostrarAnioFolio && pendientes.length > 0 && (
        <div className="flex items-center gap-2 mb-4 text-xs text-itd-navyDark/60">
          <span>Año del folio para estos cursos:</span>
          <select value={anioFolio} onChange={(e) => cambiarAnioFolio(Number(e.target.value))} className="rounded-lg border border-itd-navy/20 px-2 py-1 text-xs">
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
              <p className="text-xs text-itd-navyDark/50 mt-1">
                {etiquetaPeriodo(item.periodo)} · {item.duracion_horas && `${item.duracion_horas} hrs`}
              </p>
              <p className="text-xs text-itd-navyDark/50 mt-1">
                Jefe Propuso: <strong>{item.docentes?.nombre_completo}</strong>
              </p>

              {/* ===== DOCUMENTOS PARA REVISIÓN DEL ADMIN ===== */}
              <div className="mt-4 p-3 bg-itd-sand/20 rounded-lg border border-itd-navy/5">
                <p className="text-xs font-semibold text-itd-navyDark/70 mb-2">Documentos del Instructor:</p>
                
                <div className="flex flex-wrap gap-2">
                  <a href={obtenerUrlArchivo(item.id, '1_cvu_instructor.pdf')} target="_blank" rel="noreferrer" className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition">
                    📄 Ver CVU (PDF Subido)
                  </a>
                  <a href={obtenerUrlArchivo(item.id, '2_ficha_tecnica.pdf')} target="_blank" rel="noreferrer" className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition">
                    📄 Ver Ficha Técnica (PDF Subido)
                  </a>

                  {item.oficio_no && convActiva && (
                    <button onClick={() => descargarOficioRegistro(item, convActiva)} className="text-xs text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition">
                      📄 Descargar Oficio Generado
                    </button>
                  )}

                  {evaluaciones[item.id] ? (
                    <button onClick={() => descargarCriteriosInstructor(evaluaciones[item.id])} className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 transition">
                      📄 Descargar Criterios Evaluados
                    </button>
                  ) : (
                    <span className="text-xs text-red-500 font-medium px-2 py-1.5 bg-red-50 rounded-lg border border-red-100">
                      ⚠️ El jefe aún no evalúa los criterios
                    </span>
                  )}
                </div>
              </div>
              {/* ==================================================== */}

              <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-itd-navy/10">
                <select value={tipoSeleccionado[item.id] || ''} onChange={(e) => setTipoSeleccionado({ ...tipoSeleccionado, [item.id]: e.target.value })} className="rounded-lg border border-itd-navy/20 px-2 py-1.5 text-xs">
                  <option value="">Tipo…</option>
                  <option value="Docente">Docente</option>
                  <option value="Profesional">Profesional</option>
                </select>
                <input value={folioSeleccionado[item.id] || ''} onChange={(e) => setFolioSeleccionado({ ...folioSeleccionado, [item.id]: e.target.value })} placeholder="Folio…" className="rounded-lg border border-itd-navy/20 px-2 py-1.5 text-xs w-36" />
                
                <button
                  onClick={() => aprobar(item)}
                  disabled={!evaluaciones[item.id]} // No te deja aprobar si el jefe no ha hecho la rúbrica
                  title={!evaluaciones[item.id] ? 'El jefe debe llenar la evaluación de criterios primero' : ''}
                  className="rounded-lg bg-itd-navy text-white px-3 py-1.5 text-xs font-medium hover:bg-itd-navyDark disabled:opacity-50"
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
                  <span>{item.curso} · {item.docentes?.nombre_completo} · {item.tipo}</span>
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