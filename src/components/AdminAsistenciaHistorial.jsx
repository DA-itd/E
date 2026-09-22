import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AdminAsistenciaHistorial() {
  const [anios, setAnios] = useState([])
  const [anioSel, setAnioSel] = useState('')
  const [meses, setMeses] = useState([]) // meses con datos ese año
  const [mesSel, setMesSel] = useState('') // '' = todavía no elige, 'TODOS' = todo el año
  const [cursos, setCursos] = useState([]) // [{folio_curso, curso, fecha_curso_texto}]
  const [folioCursoSel, setFolioCursoSel] = useState('')
  const [inscritos, setInscritos] = useState([])
  const [cargando, setCargando] = useState(false)
  const [guardandoId, setGuardandoId] = useState(null)

  useEffect(() => {
    cargarAnios()
  }, [])

  useEffect(() => {
    setMesSel('')
    setCursos([])
    setFolioCursoSel('')
    setInscritos([])
    if (anioSel) cargarMeses(anioSel)
    else setMeses([])
  }, [anioSel])

  useEffect(() => {
    setFolioCursoSel('')
    setInscritos([])
    if (mesSel) cargarCursos(anioSel, mesSel)
    else setCursos([])
  }, [mesSel])

  useEffect(() => {
    if (folioCursoSel) cargarInscritos(folioCursoSel)
    else setInscritos([])
  }, [folioCursoSel])

  async function cargarAnios() {
    const { data, error } = await supabase.rpc('historial_anios')
    if (error) { console.error(error); return }
    setAnios((data || []).map((r) => r.anio))
  }

  async function cargarMeses(anio) {
    const { data, error } = await supabase.rpc('historial_meses', { p_anio: anio })
    if (error) { console.error(error); return }
    setMeses((data || []).map((r) => r.mes))
  }

  async function cargarCursos(anio, mes) {
    const { data, error } = await supabase.rpc('historial_cursos', { p_anio: anio, p_mes: mes })
    if (error) { console.error(error); return }
    setCursos(data || [])
  }

  async function cargarInscritos(folioCurso) {
    setCargando(true)
    const { data } = await supabase
      .from('inscripciones_historial')
      .select('*')
      .eq('folio_curso', folioCurso)
      .order('nombre_completo')
    setInscritos(data || [])
    setCargando(false)
  }

  async function marcarAsistencia(id, valor) {
    setGuardandoId(id)
    const { error } = await supabase
      .from('inscripciones_historial')
      .update({ asistencia_aprobada: valor })
      .eq('id', id)
    if (!error) {
      setInscritos((prev) => prev.map((i) => (i.id === id ? { ...i, asistencia_aprobada: valor } : i)))
    } else {
      alert('No se pudo guardar el cambio: ' + error.message)
    }
    setGuardandoId(null)
  }

  const cursoSeleccionado = cursos.find((c) => c.folio_curso === folioCursoSel)

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">
        Asistencia de Periodos Anteriores
      </h2>
      <p className="text-sm text-itd-navyDark/60 mb-6">
        Ajusta la asistencia de convocatorias ya cerradas y archivadas (por ejemplo, ante un
        reclamo entre un docente y el instructor). Esto edita directamente el historial, no la
        convocatoria activa.
      </p>

      <div className="grid sm:grid-cols-3 gap-4 mb-2">
        <div>
          <label className="block text-sm font-medium text-itd-navyDark/80 mb-1">Año</label>
          <select
            value={anioSel}
            onChange={(e) => setAnioSel(e.target.value)}
            className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm bg-white"
          >
            <option value="">-- Selecciona --</option>
            {anios.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-itd-navyDark/80 mb-1">Mes</label>
          <select
            value={mesSel}
            onChange={(e) => setMesSel(e.target.value)}
            disabled={!anioSel}
            className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm bg-white disabled:opacity-50"
          >
            <option value="">-- Selecciona --</option>
            <option value="TODOS">Todo el año</option>
            {meses.map((m) => (
              <option key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-itd-navyDark/80 mb-1">Curso</label>
          <select
            value={folioCursoSel}
            onChange={(e) => setFolioCursoSel(e.target.value)}
            disabled={!mesSel}
            className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm bg-white disabled:opacity-50"
          >
            <option value="">-- Selecciona --</option>
            {cursos.map((c) => (
              <option key={c.folio_curso} value={c.folio_curso}>{c.folio_curso} · {c.curso}</option>
            ))}
          </select>
        </div>
      </div>

      {cursoSeleccionado && (
        <p className="text-xs text-itd-navyDark/50 mb-4">{cursoSeleccionado.fecha_curso_texto}</p>
      )}

      {cargando ? (
        <p className="text-center text-itd-navyDark/50 py-8">Cargando…</p>
      ) : folioCursoSel && inscritos.length === 0 ? (
        <p className="text-center text-itd-navyDark/50 py-8">No hay registros para este curso.</p>
      ) : (
        <div className="space-y-2">
          {inscritos.map((ins) => (
            <div
              key={ins.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                ins.estado === 'Cancelado' ? 'border-gray-100 bg-gray-50 opacity-50' : 'border-itd-navy/10'
              }`}
            >
              <div>
                <p className="text-sm font-medium text-itd-navyDark">
                  {ins.nombre_completo}
                  {ins.estado === 'Cancelado' && (
                    <span className="ml-2 text-xs text-itd-guinda font-normal">(canceló)</span>
                  )}
                </p>
                <p className="text-xs text-itd-navyDark/50">
                  {ins.departamento} · Folio {ins.folio_personal}
                </p>
              </div>

              {ins.estado !== 'Cancelado' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => marcarAsistencia(ins.id, 'Sí')}
                    disabled={guardandoId === ins.id}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                      ins.asistencia_aprobada === 'Sí'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'border-green-600/30 text-green-700 hover:bg-green-50'
                    }`}
                  >
                    Activo
                  </button>
                  <button
                    onClick={() => marcarAsistencia(ins.id, 'No')}
                    disabled={guardandoId === ins.id}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                      ins.asistencia_aprobada === 'No'
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
