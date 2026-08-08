import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

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
  const [verAprobados, setVerAprobados] = useState(false)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const { data } = await supabase
      .from('preregistro_cursos')
      .select('*, docentes(nombre_completo, email, departamento)')
      .order('created_at', { ascending: false })
    setLista(data || [])
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
    await supabase.from('preregistro_cursos').update({ estado: 'aprobado', tipo }).eq('id', item.id)
    cargar()
    onAprobar?.({
      nombre: item.curso,
      instructor: item.docentes?.nombre_completo || '',
      departamento: item.dirigido_a || item.docentes?.departamento || '',
      semana: item.periodo || '',
      horas: item.duracion_horas || '',
      tipo,
    })
  }

  const pendientes = lista ? lista.filter((i) => i.estado !== 'aprobado') : []
  const aprobados = lista ? lista.filter((i) => i.estado === 'aprobado') : []

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">Preregistro de Cursos</h2>
      <p className="text-sm text-itd-navyDark/60 mb-6">
        Propuestas de curso capturadas por los docentes. Asigna el tipo y aprueba para pasarlas a
        Convocatorias y cursos.
      </p>

      <h3 className="text-sm font-semibold text-itd-navyDark/70 mb-3">
        Pendientes de revisar {lista && `(${pendientes.length})`}
      </h3>

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
                {item.modalidad && ` · ${item.modalidad}`}
              </p>
              {item.nombre_jefe && (
                <p className="text-xs text-itd-navyDark/50">Jefe(a) de depto.: {item.nombre_jefe}</p>
              )}
              <p className="text-xs text-itd-navyDark/50 mt-1">
                Propuesto por: <strong>{item.docentes?.nombre_completo || 'Desconocido'}</strong>
                {item.docentes?.departamento && ` (${item.docentes.departamento})`}
              </p>

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
                <button
                  onClick={() => aprobar(item)}
                  className="rounded-lg bg-itd-navy text-white px-3 py-1.5 text-xs font-medium hover:bg-itd-navyDark"
                >
                  Aprobar y pasar →
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
