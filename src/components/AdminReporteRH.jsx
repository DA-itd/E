import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { obtenerLigaConstancia } from '../lib/constancias'
import * as XLSX from 'xlsx'

// Reporte para Recursos Humanos: nombre del docente, código (folio), curso,
// horas y liga directa al PDF de la constancia -- incluye a todo docente
// con asistencia aprobada, aunque todavía no haya descargado su constancia
// (en ese caso se genera al vuelo, sin que el docente tenga que hacer nada).
export default function AdminReporteRH() {
  const [filas, setFilas] = useState(null) // null = cargando
  const [generandoTodas, setGenerandoTodas] = useState(false)
  const [generandoId, setGenerandoId] = useState(null)

  const anioActual = new Date().getFullYear()
  const [periodo, setPeriodo] = useState('todos') // 'todos' | '1' | '2' | '3' | 'rango'
  const [anio, setAnio] = useState(anioActual)
  const [rangoDesde, setRangoDesde] = useState('')
  const [rangoHasta, setRangoHasta] = useState('')

  const RANGOS_CUATRIMESTRE = {
    1: ['-01-01', '-04-30'],
    2: ['-05-01', '-08-31'],
    3: ['-09-01', '-12-31'],
  }

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setFilas(null)
    const { data } = await supabase
      .from('inscripciones')
      .select(
        'folio_personal, docente_id, docentes(nombre_completo), curso_id, cursos(nombre, horas, fecha_inicio, fecha_fin, departamento, tipo)'
      )
      .eq('asistencia_aprobada', true)
      .neq('estado', 'cancelado')
      .order('folio_personal')

    const base = (data || []).map((i) => ({
      docenteId: i.docente_id,
      cursoId: i.curso_id,
      nombre: i.docentes?.nombre_completo || '',
      codigo: i.folio_personal || '',
      curso: i.cursos?.nombre || '',
      horas: i.cursos?.horas || '',
      fechaInicio: i.cursos?.fecha_inicio || null,
      fechaFin: i.cursos?.fecha_fin || null,
      departamento: i.cursos?.departamento || '',
      tipo: i.cursos?.tipo || '',
      liga: undefined, // undefined = aún no se reviso; null = no generada
    }))
    setFilas(base)

    // Revisa en paralelo cuáles ya tienen liga generada (sin generar las
    // que falten -- eso es explícito, con el botón de abajo).
    const conLiga = await Promise.all(
      base.map(async (fila) => {
        const { data: r } = await supabase.functions.invoke('constancia-drive', {
          body: { accion: 'liga', tipo: 'constancia', docenteId: fila.docenteId, cursoId: fila.cursoId },
        })
        return { ...fila, liga: r?.existe ? r.url : null }
      })
    )
    setFilas(conLiga)
  }

  async function generarLiga(fila) {
    const key = fila.docenteId + fila.cursoId
    setGenerandoId(key)
    try {
      const url = await obtenerLigaConstancia('constancia', {
        docenteId: fila.docenteId,
        cursoId: fila.cursoId,
        nombreCompleto: fila.nombre,
        curso: fila.curso,
        horas: fila.horas,
        folioPersonal: fila.codigo,
        fechaInicio: fila.fechaInicio,
        fechaFin: fila.fechaFin,
        departamento: fila.departamento,
        tipo: fila.tipo,
      })
      setFilas((prev) => prev.map((f) => (f.docenteId === fila.docenteId && f.cursoId === fila.cursoId ? { ...f, liga: url } : f)))
    } catch (err) {
      console.error(err)
      alert('No se pudo generar la constancia: ' + err.message)
    }
    setGenerandoId(null)
  }

  async function generarTodasLasFaltantes() {
    setGenerandoTodas(true)
    const faltantesLista = filasFiltradas.filter((f) => !f.liga)
    for (const fila of faltantesLista) {
      await generarLiga(fila)
    }
    setGenerandoTodas(false)
  }

  function exportarExcel() {
    const datos = filasFiltradas.map((f) => ({
      'Nombre del docente': f.nombre,
      Código: f.codigo,
      Curso: f.curso,
      Horas: f.horas,
      'Liga de la constancia': f.liga || 'No generada',
    }))
    const hoja = XLSX.utils.json_to_sheet(datos)
    hoja['!cols'] = [{ wch: 32 }, { wch: 20 }, { wch: 45 }, { wch: 8 }, { wch: 60 }]
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Reporte RH')
    XLSX.writeFile(libro, `reporte_constancias_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function dentroDelFiltro(fila) {
    if (periodo === 'todos') return true
    if (!fila.fechaInicio) return false
    if (periodo === 'rango') {
      if (rangoDesde && fila.fechaInicio < rangoDesde) return false
      if (rangoHasta && fila.fechaInicio > rangoHasta) return false
      return true
    }
    const [desde, hasta] = RANGOS_CUATRIMESTRE[periodo]
    return fila.fechaInicio >= `${anio}${desde}` && fila.fechaInicio <= `${anio}${hasta}`
  }

  const filasFiltradas = filas ? filas.filter(dentroDelFiltro) : null
  const faltantes = filasFiltradas ? filasFiltradas.filter((f) => f.liga === null).length : 0

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">Reporte para Recursos Humanos</h2>
      <p className="text-sm text-itd-navyDark/60 mb-6">
        Nombre, código, curso, horas y liga directa al PDF de cada constancia -- incluye a todos los
        docentes con asistencia aprobada, aunque aún no hayan descargado su constancia.
      </p>

      <div className="flex flex-wrap items-end gap-3 mb-4 rounded-lg bg-itd-sand/60 p-4">
        <div>
          <label className="block text-xs text-itd-navyDark/50 mb-1">Periodo</label>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm bg-white"
          >
            <option value="todos">Todos</option>
            <option value="1">1er cuatrimestre (ene-abr)</option>
            <option value="2">2do cuatrimestre (may-ago)</option>
            <option value="3">3er cuatrimestre (sep-dic)</option>
            <option value="rango">Rango de fechas…</option>
          </select>
        </div>

        {(periodo === '1' || periodo === '2' || periodo === '3') && (
          <div>
            <label className="block text-xs text-itd-navyDark/50 mb-1">Año</label>
            <input
              type="number"
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="w-24 rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
            />
          </div>
        )}

        {periodo === 'rango' && (
          <>
            <div>
              <label className="block text-xs text-itd-navyDark/50 mb-1">Desde</label>
              <input
                type="date"
                value={rangoDesde}
                onChange={(e) => setRangoDesde(e.target.value)}
                className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-itd-navyDark/50 mb-1">Hasta</label>
              <input
                type="date"
                value={rangoHasta}
                onChange={(e) => setRangoHasta(e.target.value)}
                className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
              />
            </div>
          </>
        )}

        {filasFiltradas && (
          <p className="text-xs text-itd-navyDark/50 pb-2">{filasFiltradas.length} registro(s)</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={exportarExcel}
          disabled={!filasFiltradas || filasFiltradas.length === 0}
          className="rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-50"
        >
          ⬇ Descargar Excel
        </button>
        {faltantes > 0 && (
          <button
            onClick={generarTodasLasFaltantes}
            disabled={generandoTodas}
            className="rounded-lg border border-itd-navy/20 text-itd-navy px-4 py-2 text-sm font-medium hover:bg-itd-sand disabled:opacity-50"
          >
            {generandoTodas ? 'Generando…' : `Generar las ${faltantes} constancias faltantes`}
          </button>
        )}
      </div>

      {!filasFiltradas ? (
        <p className="text-center text-itd-navyDark/50 py-8">Cargando…</p>
      ) : filasFiltradas.length === 0 ? (
        <p className="text-center text-itd-navyDark/50 py-8">Sin registros en este periodo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-itd-navyDark/50 border-b border-itd-navy/10">
                <th className="py-2 pr-3">Docente</th>
                <th className="py-2 pr-3">Código</th>
                <th className="py-2 pr-3">Curso</th>
                <th className="py-2 pr-3">Horas</th>
                <th className="py-2 pr-3">Liga</th>
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.map((f) => {
                const key = f.docenteId + f.cursoId
                return (
                  <tr key={key} className="border-b border-itd-navy/5">
                    <td className="py-2 pr-3 text-itd-navyDark">{f.nombre}</td>
                    <td className="py-2 pr-3 text-itd-navyDark/70">{f.codigo}</td>
                    <td className="py-2 pr-3 text-itd-navyDark/70">{f.curso}</td>
                    <td className="py-2 pr-3 text-itd-navyDark/70">{f.horas}</td>
                    <td className="py-2 pr-3">
                      {f.liga === undefined ? (
                        <span className="text-itd-navyDark/30">…</span>
                      ) : f.liga ? (
                        <a href={f.liga} target="_blank" rel="noreferrer" className="text-itd-navy underline hover:text-itd-navyDark">
                          Ver PDF
                        </a>
                      ) : (
                        <button
                          onClick={() => generarLiga(f)}
                          disabled={generandoId === key}
                          className="text-xs rounded-lg border border-itd-navy/20 text-itd-navy px-2 py-1 hover:bg-itd-sand disabled:opacity-50"
                        >
                          {generandoId === key ? 'Generando…' : 'Generar'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
