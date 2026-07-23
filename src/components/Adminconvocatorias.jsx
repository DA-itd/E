import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const TIPOS_CURSO = ['Docente', 'Profesional']

function formVacioConvocatoria() {
  return { nombre: '', anio: new Date().getFullYear(), mes: 1, fecha_inicio: '', fecha_fin: '' }
}

function formVacioCurso(convocatoriaId) {
  return {
    convocatoria_id: convocatoriaId,
    folio: '',
    semana: '',
    nombre: '',
    instructor: '',
    departamento: '',
    fecha_inicio: '',
    fecha_fin: '',
    horas: '',
    tipo: 'Docente',
    cupo_maximo: 30,
  }
}

export default function AdminConvocatorias() {
  const [convocatorias, setConvocatorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [expandidaId, setExpandidaId] = useState(null)
  const [cursosPorConvocatoria, setCursosPorConvocatoria] = useState({})

  const [formConvocatoria, setFormConvocatoria] = useState(null) // null = cerrado; objeto = editando/creando
  const [formCurso, setFormCurso] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    cargarConvocatorias()
  }, [])

  const [mostrarHistoricas, setMostrarHistoricas] = useState(false)

  async function cargarConvocatorias() {
    setCargando(true)
    const { data } = await supabase
      .from('convocatorias')
      .select('*')
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
    setConvocatorias(data || [])
    setCargando(false)
  }

  async function cargarCursos(convocatoriaId) {
    const { data } = await supabase
      .from('cursos')
      .select('*')
      .eq('convocatoria_id', convocatoriaId)
      .order('nombre')
    setCursosPorConvocatoria((prev) => ({ ...prev, [convocatoriaId]: data || [] }))
  }

  async function alExpandir(convocatoriaId) {
    if (expandidaId === convocatoriaId) {
      setExpandidaId(null)
      return
    }
    setExpandidaId(convocatoriaId)
    if (!cursosPorConvocatoria[convocatoriaId]) await cargarCursos(convocatoriaId)
  }

  async function alternarActivoConvocatoria(conv) {
    setErrorMsg('')
    const { error } = await supabase
      .from('convocatorias')
      .update({ activo: !conv.activo })
      .eq('id', conv.id)
    if (error) {
      setErrorMsg('No se pudo actualizar: ' + error.message)
      return
    }
    cargarConvocatorias()
  }

  async function guardarConvocatoria(e) {
    e.preventDefault()
    setGuardando(true)
    setErrorMsg('')
    const datos = { ...formConvocatoria, anio: Number(formConvocatoria.anio), mes: Number(formConvocatoria.mes) }
    const esNueva = !datos.id

    const query = esNueva
      ? supabase.from('convocatorias').insert({ ...datos, activo: true })
      : supabase.from('convocatorias').update(datos).eq('id', datos.id)

    const { error } = await query
    setGuardando(false)
    if (error) {
      setErrorMsg('No se pudo guardar la convocatoria: ' + error.message)
      return
    }
    setFormConvocatoria(null)
    cargarConvocatorias()
  }

  async function eliminarConvocatoria(conv) {
    if (!confirm(`¿Eliminar la convocatoria "${conv.nombre}"? Esto solo funciona si no tiene cursos asociados.`)) return
    setErrorMsg('')
    const { error } = await supabase.from('convocatorias').delete().eq('id', conv.id)
    if (error) {
      setErrorMsg('No se pudo eliminar (probablemente ya tiene cursos asociados): ' + error.message)
      return
    }
    cargarConvocatorias()
  }

  async function guardarCurso(e) {
    e.preventDefault()
    setGuardando(true)
    setErrorMsg('')
    const datos = { ...formCurso, horas: Number(formCurso.horas), cupo_maximo: Number(formCurso.cupo_maximo) }
    const esNuevo = !datos.id

    const query = esNuevo
      ? supabase.from('cursos').insert(datos)
      : supabase.from('cursos').update(datos).eq('id', datos.id)

    const { error } = await query
    setGuardando(false)
    if (error) {
      setErrorMsg('No se pudo guardar el curso: ' + error.message)
      return
    }
    setFormCurso(null)
    cargarCursos(datos.convocatoria_id)
  }

  async function eliminarCurso(curso) {
    if (!confirm(`¿Eliminar el curso "${curso.nombre}"? Esto solo funciona si no tiene inscripciones.`)) return
    setErrorMsg('')
    const { error } = await supabase.from('cursos').delete().eq('id', curso.id)
    if (error) {
      setErrorMsg('No se pudo eliminar (probablemente ya tiene inscripciones): ' + error.message)
      return
    }
    cargarCursos(curso.convocatoria_id)
  }

  async function alternarCierreCurso(curso) {
    setErrorMsg('')
    const { error } = await supabase
      .from('cursos')
      .update({ cerrado_manualmente: !curso.cerrado_manualmente })
      .eq('id', curso.id)
    if (error) {
      setErrorMsg('No se pudo actualizar el cierre: ' + error.message)
      return
    }
    cargarCursos(curso.convocatoria_id)
  }

  if (cargando) return <p className="text-center text-itd-navyDark/50 py-12">Cargando…</p>

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-xl font-semibold text-itd-navy">Convocatorias y Cursos</h2>
          <button
            onClick={() => setFormConvocatoria(formVacioConvocatoria())}
            className="rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark"
          >
            + Nueva convocatoria
          </button>
        </div>
        <p className="text-sm text-itd-navyDark/60 mb-4">
          Da de alta/baja convocatorias, agrega o edita cursos, y cierra inscripciones manualmente.
        </p>

        <label className="flex items-center gap-2 text-sm text-itd-navyDark/70 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={mostrarHistoricas}
            onChange={(e) => setMostrarHistoricas(e.target.checked)}
          />
          Mostrar convocatorias históricas (inactivas)
        </label>

        {errorMsg && <p className="text-sm text-itd-guinda mb-4">{errorMsg}</p>}

        {formConvocatoria && (
          <form onSubmit={guardarConvocatoria} className="rounded-xl border border-itd-navy/20 bg-itd-sand/40 p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              required
              placeholder="Nombre de la convocatoria"
              value={formConvocatoria.nombre}
              onChange={(e) => setFormConvocatoria({ ...formConvocatoria, nombre: e.target.value })}
              className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              required type="number" placeholder="Año"
              value={formConvocatoria.anio}
              onChange={(e) => setFormConvocatoria({ ...formConvocatoria, anio: e.target.value })}
              className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
            />
            <select
              value={formConvocatoria.mes}
              onChange={(e) => setFormConvocatoria({ ...formConvocatoria, mes: e.target.value })}
              className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
            >
              <option value={1}>Enero (Trimestre 1)</option>
              <option value={6}>Junio (Trimestre 2)</option>
              <option value={8}>Agosto (Trimestre 3)</option>
            </select>
            <label className="text-xs text-itd-navyDark/60">
              Fecha inicio
              <input
                required type="date"
                value={formConvocatoria.fecha_inicio}
                onChange={(e) => setFormConvocatoria({ ...formConvocatoria, fecha_inicio: e.target.value })}
                className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm mt-1"
              />
            </label>
            <label className="text-xs text-itd-navyDark/60">
              Fecha fin
              <input
                required type="date"
                value={formConvocatoria.fecha_fin}
                onChange={(e) => setFormConvocatoria({ ...formConvocatoria, fecha_fin: e.target.value })}
                className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm mt-1"
              />
            </label>
            <div className="sm:col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setFormConvocatoria(null)} className="rounded-lg px-4 py-2 text-sm text-itd-navyDark/60">
                Cancelar
              </button>
              <button type="submit" disabled={guardando} className="rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {convocatorias
            .filter((conv) => mostrarHistoricas || conv.activo)
            .map((conv) => (
            <div key={conv.id} className="rounded-xl border border-itd-navy/10 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 bg-white">
                <button onClick={() => alExpandir(conv.id)} className="text-left flex-1">
                  <p className="font-medium text-sm text-itd-navyDark">
                    {expandidaId === conv.id ? '▾' : '▸'} {conv.nombre}
                    {!conv.activo && <span className="ml-2 text-xs text-itd-guinda">(inactiva)</span>}
                  </p>
                  <p className="text-xs text-itd-navyDark/60 mt-0.5">
                    {conv.anio} · {conv.fecha_inicio} a {conv.fecha_fin}
                  </p>
                </button>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setFormConvocatoria(conv)}
                    className="text-xs rounded-lg border border-itd-navy/20 px-3 py-1.5 hover:bg-itd-sand"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => alternarActivoConvocatoria(conv)}
                    className="text-xs rounded-lg border border-itd-navy/20 px-3 py-1.5 hover:bg-itd-sand"
                  >
                    {conv.activo ? 'Dar de baja' : 'Dar de alta'}
                  </button>
                  <button
                    onClick={() => eliminarConvocatoria(conv)}
                    className="text-xs rounded-lg border border-itd-guinda/30 text-itd-guinda px-3 py-1.5 hover:bg-itd-guinda/5"
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              {expandidaId === conv.id && (
                <div className="border-t border-itd-navy/10 bg-itd-sand/30 p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-itd-navyDark/70">Cursos de esta convocatoria</h3>
                    <button
                      onClick={() => setFormCurso(formVacioCurso(conv.id))}
                      className="text-xs rounded-lg bg-itd-navy text-white px-3 py-1.5"
                    >
                      + Nuevo curso
                    </button>
                  </div>

                  {formCurso && formCurso.convocatoria_id === conv.id && (
                    <form onSubmit={guardarCurso} className="rounded-xl border border-itd-navy/20 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input required placeholder="Folio" value={formCurso.folio} onChange={(e) => setFormCurso({ ...formCurso, folio: e.target.value })} className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm" />
                      <input placeholder="Semana" value={formCurso.semana} onChange={(e) => setFormCurso({ ...formCurso, semana: e.target.value })} className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm" />
                      <input required placeholder="Nombre del curso" value={formCurso.nombre} onChange={(e) => setFormCurso({ ...formCurso, nombre: e.target.value })} className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm sm:col-span-2" />
                      <input placeholder="Instructor" value={formCurso.instructor} onChange={(e) => setFormCurso({ ...formCurso, instructor: e.target.value })} className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm" />
                      <input placeholder="Departamento" value={formCurso.departamento} onChange={(e) => setFormCurso({ ...formCurso, departamento: e.target.value })} className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm" />
                      <label className="text-xs text-itd-navyDark/60">
                        Fecha inicio
                        <input required type="date" value={formCurso.fecha_inicio} onChange={(e) => setFormCurso({ ...formCurso, fecha_inicio: e.target.value })} className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm mt-1" />
                      </label>
                      <label className="text-xs text-itd-navyDark/60">
                        Fecha fin
                        <input required type="date" value={formCurso.fecha_fin} onChange={(e) => setFormCurso({ ...formCurso, fecha_fin: e.target.value })} className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm mt-1" />
                      </label>
                      <input required type="number" placeholder="Horas" value={formCurso.horas} onChange={(e) => setFormCurso({ ...formCurso, horas: e.target.value })} className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm" />
                      <input required type="number" placeholder="Cupo máximo" value={formCurso.cupo_maximo} onChange={(e) => setFormCurso({ ...formCurso, cupo_maximo: e.target.value })} className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm" />
                      <select value={formCurso.tipo} onChange={(e) => setFormCurso({ ...formCurso, tipo: e.target.value })} className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm sm:col-span-2">
                        {TIPOS_CURSO.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <div className="sm:col-span-2 flex gap-2 justify-end">
                        <button type="button" onClick={() => setFormCurso(null)} className="rounded-lg px-4 py-2 text-sm text-itd-navyDark/60">Cancelar</button>
                        <button type="submit" disabled={guardando} className="rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
                          {guardando ? 'Guardando…' : 'Guardar'}
                        </button>
                      </div>
                    </form>
                  )}

                  {(cursosPorConvocatoria[conv.id] || []).map((curso) => (
                    <div key={curso.id} className="rounded-lg border border-itd-navy/10 bg-white p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-itd-navyDark">
                          {curso.nombre}
                          {curso.cerrado_manualmente && <span className="ml-2 text-xs text-itd-guinda">(inscripciones cerradas)</span>}
                        </p>
                        <p className="text-xs text-itd-navyDark/60">
                          Folio {curso.folio} · {curso.tipo} · {curso.horas} hrs · cupo {curso.cupo_maximo}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => setFormCurso(curso)} className="text-xs rounded-lg border border-itd-navy/20 px-3 py-1.5 hover:bg-itd-sand">Editar</button>
                        <button onClick={() => alternarCierreCurso(curso)} className="text-xs rounded-lg border border-itd-navy/20 px-3 py-1.5 hover:bg-itd-sand">
                          {curso.cerrado_manualmente ? 'Reabrir' : 'Cerrar inscripciones'}
                        </button>
                        <button onClick={() => eliminarCurso(curso)} className="text-xs rounded-lg border border-itd-guinda/30 text-itd-guinda px-3 py-1.5 hover:bg-itd-guinda/5">Eliminar</button>
                      </div>
                    </div>
                  ))}

                  {(cursosPorConvocatoria[conv.id] || []).length === 0 && (
                    <p className="text-sm text-itd-navyDark/50 text-center py-4">Sin cursos todavía.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
