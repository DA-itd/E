import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatearRangoFechas } from '../lib/formatoFechas'

export default function AdminAsistencia() {
  const [convocatorias, setConvocatorias] = useState([])
  const [convocatoriaId, setConvocatoriaId] = useState('')
  const [cursos, setCursos] = useState([])
  const [cursoId, setCursoId] = useState('')
  const [inscritos, setInscritos] = useState([])
  const [cargando, setCargando] = useState(false)
  const [guardandoId, setGuardandoId] = useState(null)

  useEffect(() => {
    cargarConvocatorias()
  }, [])

  useEffect(() => {
    if (convocatoriaId) cargarCursos(convocatoriaId)
    else setCursos([])
    setCursoId('')
    setInscritos([])
  }, [convocatoriaId])

  useEffect(() => {
    if (cursoId) cargarInscritos(cursoId)
    else setInscritos([])
  }, [cursoId])

  async function cargarConvocatorias() {
    const { data } = await supabase
      .from('convocatorias')
      .select('*')
      .eq('activo', true)
      .order('fecha_inicio', { ascending: false })
    setConvocatorias(data || [])
    if (data && data.length === 1) setConvocatoriaId(data[0].id)
  }

  async function cargarCursos(convId) {
    const { data } = await supabase
      .from('cursos')
      .select('*')
      .eq('convocatoria_id', convId)
      .order('folio')
    setCursos(data || [])
  }

  async function cargarInscritos(cId) {
    setCargando(true)
    const { data } = await supabase
      .from('inscripciones')
      .select('id, estado, folio_personal, asistencia_aprobada, docentes(nombre_completo, email, departamento)')
      .eq('curso_id', cId)
      .order('docentes(nombre_completo)')
    setInscritos(data || [])
    setCargando(false)
  }

  async function marcarAsistencia(insId, valor) {
    setGuardandoId(insId)
    await supabase.from('inscripciones').update({ asistencia_aprobada: valor }).eq('id', insId)
    setInscritos((prev) => prev.map((i) => (i.id === insId ? { ...i, asistencia_aprobada: valor } : i)))
    setGuardandoId(null)
  }

  const cursoSeleccionado = cursos.find((c) => c.id === cursoId)

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">
        Revisión de Asistencia
      </h2>
      <p className="text-sm text-itd-navyDark/60 mb-6">
        Marca qué docentes acreditaron el curso según tu lista de asistencia. Esto habilita su
        constancia y se contabiliza en las estadísticas.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-itd-navyDark/80 mb-1">Convocatoria</label>
          <select
            value={convocatoriaId}
            onChange={(e) => setConvocatoriaId(e.target.value)}
            className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm bg-white"
          >
            <option value="">-- Selecciona --</option>
            {convocatorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-itd-navyDark/80 mb-1">Curso</label>
          <select
            value={cursoId}
            onChange={(e) => setCursoId(e.target.value)}
            disabled={!convocatoriaId}
            className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm bg-white disabled:opacity-50"
          >
            <option value="">-- Selecciona --</option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>{c.folio} · {c.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {cursoSeleccionado && (
        <p className="text-xs text-itd-navyDark/50 mb-4">
          {formatearRangoFechas(cursoSeleccionado.fecha_inicio, cursoSeleccionado.fecha_fin)} ·{' '}
          {cursoSeleccionado.semana}
        </p>
      )}

      {cargando ? (
        <p className="text-center text-itd-navyDark/50 py-8">Cargando…</p>
      ) : cursoId && inscritos.length === 0 ? (
        <p className="text-center text-itd-navyDark/50 py-8">
          Nadie se ha inscrito a este curso todavía.
        </p>
      ) : (
        <div className="space-y-2">
          {inscritos.map((ins) => (
            <div
              key={ins.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                ins.estado === 'cancelado' ? 'border-gray-100 bg-gray-50 opacity-50' : 'border-itd-navy/10'
              }`}
            >
              <div>
                <p className="text-sm font-medium text-itd-navyDark">
                  {ins.docentes?.nombre_completo}
                  {ins.estado === 'cancelado' && (
                    <span className="ml-2 text-xs text-itd-guinda font-normal">(canceló)</span>
                  )}
                </p>
                <p className="text-xs text-itd-navyDark/50">
                  {ins.docentes?.departamento} · Folio {ins.folio_personal}
                </p>
              </div>

              {ins.estado === 'activo' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => marcarAsistencia(ins.id, true)}
                    disabled={guardandoId === ins.id}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                      ins.asistencia_aprobada
                        ? 'bg-green-600 text-white border-green-600'
                        : 'border-green-600/30 text-green-700 hover:bg-green-50'
                    }`}
                  >
                    Activo
                  </button>
                  <button
                    onClick={() => marcarAsistencia(ins.id, false)}
                    disabled={guardandoId === ins.id}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                      ins.asistencia_aprobada === false
                        ? 'bg-itd-guinda text-white border-itd-guinda'
                        : 'border-itd-guinda/30 text-itd-guinda hover:bg-itd-guinda/5'
                    }`}
                  >
                    No Activo
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
