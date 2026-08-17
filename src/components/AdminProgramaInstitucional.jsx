// src/components/AdminProgramaInstitucional.jsx
// Pestaña de Administración: genera el "Programa Institucional de
// Formación y Actualización Docente y Profesional" (ITD-AD-PO-04-02)
// a partir de los cursos ya aprobados, filtrando por Periodo 1,
// Periodo 2 o ambos, en PDF o Word.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { descargarProgramaPDF, descargarProgramaWord } from '../lib/programaInstitucional'

export default function AdminProgramaInstitucional() {
  const [convocatorias, setConvocatorias] = useState([])
  const [convocatoriaId, setConvocatoriaId] = useState('')
  const [periodos, setPeriodos] = useState(['PERIODO_1']) // puede incluir ambos
  const [cursos, setCursos] = useState(null) // null = no generado aún
  const [cargando, setCargando] = useState(false)
  const [generando, setGenerando] = useState('') // '' | 'pdf' | 'word'
  const [error, setError] = useState('')

  useEffect(() => { cargarConvocatorias() }, [])

  async function cargarConvocatorias() {
    const { data } = await supabase
      .from('convocatorias')
      .select('*')
      .order('fecha_inicio', { ascending: false })
    setConvocatorias(data || [])
    if (data && data.length > 0) setConvocatoriaId(data[0].id)
  }

  function alternarPeriodo(p) {
    setPeriodos((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  const convocatoria = convocatorias.find((c) => c.id === convocatoriaId)

  function etiquetaPeriodo(p) {
    if (!convocatoria) return p === 'PERIODO_1' ? 'Periodo 1' : 'Periodo 2'
    const ini = p === 'PERIODO_1' ? convocatoria.periodo1_inicio : convocatoria.periodo2_inicio
    const fin = p === 'PERIODO_1' ? convocatoria.periodo1_fin : convocatoria.periodo2_fin
    const base = p === 'PERIODO_1' ? 'Periodo 1' : 'Periodo 2'
    return ini && fin ? `${base} (${ini} a ${fin})` : base
  }

  async function buscarCursos() {
    if (!convocatoriaId || periodos.length === 0) return
    setCargando(true)
    setError('')
    setCursos(null)
    const { data, error: err } = await supabase
      .from('cursos')
      .select('*')
      .eq('convocatoria_id', convocatoriaId)
      .in('semana', periodos)
      .in('status', ['activo', 'borrador'])
      .order('nombre')
    setCargando(false)
    if (err) {
      setError('No se pudo consultar: ' + err.message)
      return
    }
    setCursos(data || [])
  }

  function periodoLabelCompleto() {
    return periodos.map(etiquetaPeriodo).join('  ·  ')
  }

  async function generar(formato) {
    if (!cursos || cursos.length === 0) return
    setGenerando(formato)
    try {
      if (formato === 'pdf') await descargarProgramaPDF(cursos, periodoLabelCompleto())
      else await descargarProgramaWord(cursos, periodoLabelCompleto())
    } catch (e) {
      setError('No se pudo generar el documento: ' + e.message)
    } finally {
      setGenerando('')
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 p-6">
      <h2 className="font-display text-xl font-semibold text-itd-navy">Programa Institucional</h2>
      <p className="text-sm text-itd-navyDark/60 mt-1 mb-5">
        Genera el Programa Institucional de Formación (ITD-AD-PO-04-02) con los cursos ya
        aprobados de un periodo, ambos periodos, en PDF o Word.
      </p>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">❌ {error}</div>}

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Convocatoria</label>
          <select
            value={convocatoriaId}
            onChange={(e) => { setConvocatoriaId(e.target.value); setCursos(null) }}
            className="w-full rounded-lg border p-2 text-sm"
          >
            {convocatorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre} · {c.anio}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Periodo(s)</label>
          <div className="flex gap-4 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={periodos.includes('PERIODO_1')} onChange={() => { alternarPeriodo('PERIODO_1'); setCursos(null) }} />
              {etiquetaPeriodo('PERIODO_1')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={periodos.includes('PERIODO_2')} onChange={() => { alternarPeriodo('PERIODO_2'); setCursos(null) }} />
              {etiquetaPeriodo('PERIODO_2')}
            </label>
          </div>
        </div>
      </div>

      <button
        onClick={buscarCursos}
        disabled={!convocatoriaId || periodos.length === 0 || cargando}
        className="px-5 py-2 rounded-lg bg-itd-navy text-white text-sm font-semibold disabled:opacity-50"
      >
        {cargando ? 'Buscando…' : 'Buscar cursos'}
      </button>

      {cursos !== null && (
        <div className="mt-5">
          {cursos.length === 0 ? (
            <p className="text-sm text-itd-navyDark/60">
              No hay cursos aprobados para {periodoLabelCompleto()} en esta convocatoria.
            </p>
          ) : (
            <>
              <p className="text-sm text-itd-navyDark/70 mb-3">
                <strong>{cursos.length}</strong> curso(s) encontrados para {periodoLabelCompleto()}.
              </p>
              <ul className="text-xs text-itd-navyDark/50 mb-4 space-y-0.5 max-h-40 overflow-y-auto">
                {cursos.map((c) => <li key={c.id}>• {c.nombre}{!c.objetivo && ' — (sin objetivo capturado)'}</li>)}
              </ul>
              <div className="flex gap-3">
                <button
                  onClick={() => generar('pdf')}
                  disabled={generando !== ''}
                  className="px-5 py-2.5 rounded-lg bg-itd-navy text-white text-sm font-semibold hover:bg-itd-navyDark disabled:opacity-50"
                >
                  {generando === 'pdf' ? 'Generando…' : '📄 Descargar PDF'}
                </button>
                <button
                  onClick={() => generar('word')}
                  disabled={generando !== ''}
                  className="px-5 py-2.5 rounded-lg border border-itd-navy/30 text-itd-navy text-sm font-semibold hover:bg-itd-sand disabled:opacity-50"
                >
                  {generando === 'word' ? 'Generando…' : '📝 Descargar Word'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
