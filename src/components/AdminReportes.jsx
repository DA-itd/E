import { useState } from 'react'
import { calcularReporte } from '../lib/reportes'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import ReportesGraficas from './ReportesGraficas'

const ANIO_ACTUAL = new Date().getFullYear()
const ANIOS = Array.from({ length: 6 }, (_, i) => ANIO_ACTUAL - i)

export default function AdminReportes() {
  const [tipoPeriodo, setTipoPeriodo] = useState('actual') // 'actual' | 'trimestre' | 'anio'
  const [anio, setAnio] = useState(ANIO_ACTUAL)
  const [trimestre, setTrimestre] = useState(1)
  const [cargando, setCargando] = useState(false)
  const [reporte, setReporte] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  async function generar() {
    setCargando(true)
    setErrorMsg('')
    try {
      const periodo =
        tipoPeriodo === 'anio'
          ? { tipo: 'anio', anio }
          : tipoPeriodo === 'actual'
          ? { tipo: 'actual' }
          : { tipo: 'trimestre', anio, trimestre }
      const datos = await calcularReporte(periodo)
      setReporte(datos)
    } catch (err) {
      console.error(err)
      setErrorMsg('No se pudo generar el reporte: ' + err.message)
    }
    setCargando(false)
  }

  const [vista, setVista] = useState('tabla') // 'tabla' | 'graficas' | 'participantes'
  const [filtroDepartamento, setFiltroDepartamento] = useState('')
  const [busquedaNombre, setBusquedaNombre] = useState('')

  function filasPlanas(r) {
    return [
      ['TOTAL DE INSCRIPCIONES', r.totalInscripciones],
      ['Hombres', r.porGenero.Hombre],
      ['Mujeres', r.porGenero.Mujer],
      ['Tipo Docente', r.porTipo.Docente],
      ['Tipo Profesional', r.porTipo.Profesional],
      [],
      ['LICENCIATURA', r.licenciatura.total],
      ['  Hombres', r.licenciatura.porGenero.Hombre],
      ['  Mujeres', r.licenciatura.porGenero.Mujer],
      ['  Tipo Docente', r.licenciatura.porTipo.Docente],
      ['  Tipo Profesional', r.licenciatura.porTipo.Profesional],
      ['  Habilidades Digitales', r.licenciatura.habilidadesDigitales],
      ['  Estrategias Tutoriales / Salud Emocional', r.licenciatura.saludEmocional],
      [],
      ['POSGRADO (Maestría/Doctorado)', r.posgrado.total],
      ['  Hombres', r.posgrado.porGenero.Hombre],
      ['  Mujeres', r.posgrado.porGenero.Mujer],
      ['  Tipo Docente', r.posgrado.porTipo.Docente],
      ['  Tipo Profesional', r.posgrado.porTipo.Profesional],
      ['  Habilidades Digitales', r.posgrado.habilidadesDigitales],
      ['  Estrategias Tutoriales / Salud Emocional', r.posgrado.saludEmocional],
      [],
      ['DOCENTES ÚNICOS EN EL PERIODO', r.docentesUnicos],
      ['  Hombres', r.docentesUnicosPorGenero.Hombre],
      ['  Mujeres', r.docentesUnicosPorGenero.Mujer],
      ['  Tipo Docente', r.docentesUnicosPorTipo.Docente],
      ['  Tipo Profesional', r.docentesUnicosPorTipo.Profesional],
      ['Total de docentes en la institución (plantilla activa)', r.totalDocentesInstitucion],
      ['% de participación (cobertura de plantilla)', `${r.porcentajeParticipacion}%`],
      [],
      ['SIN PARTICIPAR EN EL PERIODO', r.sinParticipar.total],
      ['  Hombres', r.sinParticipar.porGenero.Hombre],
      ['  Mujeres', r.sinParticipar.porGenero.Mujer],
      [],
      ['DISTRIBUCIÓN POR NÚMERO DE CURSOS TOMADOS', ''],
      ['1 curso', r.distribucionPorNumeroCursos[1]],
      ['2 cursos', r.distribucionPorNumeroCursos[2]],
      ['3 cursos', r.distribucionPorNumeroCursos[3]],
      ['4 cursos', r.distribucionPorNumeroCursos[4]],
      ['5 cursos', r.distribucionPorNumeroCursos[5]],
      ['6 o más cursos', r.distribucionPorNumeroCursos['6+']],
      [],
      ['CURSOS MÁS DEMANDADOS', ''],
      ...r.cursosMasDemandados.map((c) => [`  ${c.nombre}`, c.cantidad]),
      [],
      ['PARTICIPACIÓN POR DEPARTAMENTO', ''],
      ...r.porDepartamento.map((d) => [`  ${d.nombre}`, d.cantidad]),
    ]
  }

  const NOMBRES_TRIMESTRE = { 1: 'Enero', 2: 'Junio', 3: 'Agosto' }

  function tituloPeriodo() {
    if (tipoPeriodo === 'anio') return `Año ${anio}`
    if (tipoPeriodo === 'actual') return 'Periodo actual'
    return `Trimestre ${trimestre} (${NOMBRES_TRIMESTRE[trimestre]}) ${anio}`
  }

  function participantesFiltrados(r) {
    return r.detalleParticipantes.filter((p) => {
      const coincideDepto = !filtroDepartamento || p.departamento === filtroDepartamento
      const coincideNombre = !busquedaNombre || p.nombre.toLowerCase().includes(busquedaNombre.toLowerCase())
      return coincideDepto && coincideNombre
    })
  }

  function exportarParticipantesExcel() {
    if (!reporte) return
    const lista = participantesFiltrados(reporte)
    const tituloDepto = filtroDepartamento || 'Todos los departamentos'
    const ws = XLSX.utils.aoa_to_sheet([
      [`Departamento: ${tituloDepto}`],
      [`Periodo: ${tituloPeriodo()} (${reporte.rango.inicio} a ${reporte.rango.fin})`],
      [],
      ['Folio', 'Nombre', 'Curso', 'Departamento oferente'],
      ...lista.map((p) => [p.folio, p.nombre, p.curso, p.departamentoOferente]),
    ])
    ws['!cols'] = [{ wch: 22 }, { wch: 32 }, { wch: 60 }, { wch: 30 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Participantes')
    const sufijo = filtroDepartamento ? `_${filtroDepartamento}` : ''
    XLSX.writeFile(wb, `Participantes_${reporte.rango.inicio}_a_${reporte.rango.fin}${sufijo}.xlsx`)
  }

  function exportarParticipantesPDF() {
    if (!reporte) return
    const lista = participantesFiltrados(reporte)
    const tituloDepto = filtroDepartamento || 'Todos los departamentos'
    const doc = new jsPDF()
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('Listado de Participantes', 14, 16)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Departamento: ${tituloDepto}`, 14, 23)
    doc.text(`Periodo: ${tituloPeriodo()} (${reporte.rango.inicio} a ${reporte.rango.fin})`, 14, 29)

    autoTable(doc, {
      startY: 35,
      head: [['Folio', 'Nombre', 'Curso', 'Departamento oferente']],
      body: lista.map((p) => [p.folio, p.nombre, p.curso, p.departamentoOferente]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [27, 57, 106] },
    })

    const sufijo = filtroDepartamento ? `_${filtroDepartamento}` : ''
    doc.save(`Participantes_${reporte.rango.inicio}_a_${reporte.rango.fin}${sufijo}.pdf`)
  }

  function exportarExcel() {
    if (!reporte) return
    const ws = XLSX.utils.aoa_to_sheet([
      ['Reporte de Inscripciones', `${reporte.rango.inicio} a ${reporte.rango.fin}`],
      [],
      ...filasPlanas(reporte),
    ])
    ws['!cols'] = [{ wch: 38 }, { wch: 16 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
    XLSX.writeFile(wb, `Reporte_${reporte.rango.inicio}_a_${reporte.rango.fin}.xlsx`)
  }

  function exportarPDF() {
    if (!reporte) return
    const doc = new jsPDF()
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Reporte Trimestral de Inscripciones', 14, 18)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Periodo: ${reporte.rango.inicio} a ${reporte.rango.fin}`, 14, 26)

    autoTable(doc, {
      startY: 32,
      head: [['Indicador', 'Valor']],
      body: filasPlanas(reporte).map(([a, b]) => [a || '', b === undefined ? '' : String(b)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [27, 57, 106] },
    })

    doc.save(`Reporte_Trimestral_${reporte.rango.inicio}_a_${reporte.rango.fin}.pdf`)
  }

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8 space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">Reportes</h2>
        <p className="text-sm text-itd-navyDark/60">
          Estadísticas de inscripciones por periodo de capacitación.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-itd-navyDark/60 mb-1">Periodo</label>
          <select
            value={tipoPeriodo}
            onChange={(e) => setTipoPeriodo(e.target.value)}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          >
            <option value="actual">Periodo actual</option>
            <option value="trimestre">Trimestre específico</option>
            <option value="anio">Año completo</option>
          </select>
        </div>

        {tipoPeriodo !== 'actual' && (
          <div>
            <label className="block text-xs font-medium text-itd-navyDark/60 mb-1">Año</label>
            <select
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
            >
              {ANIOS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        )}

        {tipoPeriodo === 'trimestre' && (
          <div>
            <label className="block text-xs font-medium text-itd-navyDark/60 mb-1">Trimestre</label>
            <select
              value={trimestre}
              onChange={(e) => setTrimestre(Number(e.target.value))}
              className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
            >
              <option value={1}>Trimestre 1 (Enero)</option>
              <option value={2}>Trimestre 2 (Junio)</option>
              <option value={3}>Trimestre 3 (Agosto)</option>
            </select>
          </div>
        )}

        <button
          onClick={generar}
          disabled={cargando}
          className="rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-50"
        >
          {cargando ? 'Generando…' : 'Generar reporte'}
        </button>
      </div>

      {errorMsg && <p className="text-sm text-itd-guinda">{errorMsg}</p>}

      {reporte && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-itd-navy/10 p-4">
              <p className="text-2xl font-bold text-itd-navy">{reporte.totalInscripciones}</p>
              <p className="text-xs text-itd-navyDark/60">Total inscripciones</p>
            </div>
            <div className="rounded-xl border border-itd-navy/10 p-4">
              <p className="text-2xl font-bold text-green-700">{reporte.docentesUnicos}</p>
              <p className="text-xs text-itd-navyDark/60">Docentes únicos</p>
            </div>
            <div className="rounded-xl border border-itd-navy/10 p-4">
              <p className="text-2xl font-bold text-amber-600">{reporte.porcentajeParticipacion}%</p>
              <p className="text-xs text-itd-navyDark/60">Cobertura de plantilla</p>
            </div>
            <div className="rounded-xl border border-itd-navy/10 p-4">
              <p className="text-2xl font-bold text-itd-guinda">{reporte.sinParticipar.total}</p>
              <p className="text-xs text-itd-navyDark/60">
                Sin participar (H:{reporte.sinParticipar.porGenero.Hombre} M:{reporte.sinParticipar.porGenero.Mujer})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportarExcel}
              className="rounded-lg bg-green-700 text-white px-4 py-2 text-sm font-semibold hover:bg-green-800"
            >
              ⬇ Exportar Excel
            </button>
            <button
              onClick={exportarPDF}
              className="rounded-lg bg-itd-guinda text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
            >
              ⬇ Exportar PDF (trimestral)
            </button>
            <div className="ml-auto flex rounded-lg border border-itd-navy/20 overflow-hidden">
              <button
                onClick={() => setVista('tabla')}
                className={`px-4 py-2 text-sm font-medium ${vista === 'tabla' ? 'bg-itd-navy text-white' : 'bg-white text-itd-navyDark'}`}
              >
                Tabla
              </button>
              <button
                onClick={() => setVista('graficas')}
                className={`px-4 py-2 text-sm font-medium ${vista === 'graficas' ? 'bg-itd-navy text-white' : 'bg-white text-itd-navyDark'}`}
              >
                Gráficas
              </button>
              <button
                onClick={() => setVista('participantes')}
                className={`px-4 py-2 text-sm font-medium ${vista === 'participantes' ? 'bg-itd-navy text-white' : 'bg-white text-itd-navyDark'}`}
              >
                Participantes
              </button>
            </div>
          </div>

          {vista === 'tabla' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {filasPlanas(reporte).map(([label, valor], i) => (
                    <tr key={i} className={label ? 'border-b border-itd-navy/10' : ''}>
                      <td className="py-1.5 pr-4 text-itd-navyDark/80">{label}</td>
                      <td className="py-1.5 font-semibold text-itd-navyDark">{valor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : vista === 'graficas' ? (
            <ReportesGraficas reporte={reporte} />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-medium text-itd-navyDark/60 mb-1">Departamento</label>
                  <select
                    value={filtroDepartamento}
                    onChange={(e) => setFiltroDepartamento(e.target.value)}
                    className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm min-w-[220px]"
                  >
                    <option value="">Todos los departamentos</option>
                    {reporte.porDepartamento.map((d) => (
                      <option key={d.nombre} value={d.nombre}>{d.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-itd-navyDark/60 mb-1">Buscar por nombre</label>
                  <input
                    type="text"
                    value={busquedaNombre}
                    onChange={(e) => setBusquedaNombre(e.target.value)}
                    placeholder="Nombre del docente…"
                    className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={exportarParticipantesExcel}
                  className="rounded-lg bg-green-700 text-white px-4 py-2 text-sm font-semibold hover:bg-green-800"
                >
                  ⬇ Excel
                </button>
                <button
                  onClick={exportarParticipantesPDF}
                  className="rounded-lg bg-itd-guinda text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
                >
                  ⬇ PDF
                </button>
                <p className="text-sm text-itd-navyDark/60 ml-auto">
                  {participantesFiltrados(reporte).length} de {reporte.detalleParticipantes.length} registros
                </p>
              </div>

              <p className="text-xs text-itd-navyDark/50">
                Departamento: <strong>{filtroDepartamento || 'Todos los departamentos'}</strong> · Periodo: <strong>{tituloPeriodo()}</strong>
              </p>

              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-itd-navy/20">
                      <th className="text-left py-2 pr-4 text-itd-navyDark/70">Folio</th>
                      <th className="text-left py-2 pr-4 text-itd-navyDark/70">Nombre</th>
                      {!filtroDepartamento && <th className="text-left py-2 pr-4 text-itd-navyDark/70">Departamento (docente)</th>}
                      <th className="text-left py-2 pr-4 text-itd-navyDark/70">Curso</th>
                      <th className="text-left py-2 text-itd-navyDark/70">Departamento oferente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participantesFiltrados(reporte).map((p, i) => (
                      <tr key={i} className="border-b border-itd-navy/10">
                        <td className="py-1.5 pr-4 text-itd-navyDark/70 whitespace-nowrap">{p.folio}</td>
                        <td className="py-1.5 pr-4 text-itd-navyDark">{p.nombre}</td>
                        {!filtroDepartamento && <td className="py-1.5 pr-4 text-itd-navyDark/70">{p.departamento}</td>}
                        <td className="py-1.5 pr-4 text-itd-navyDark/70">{p.curso}</td>
                        <td className="py-1.5 text-itd-navyDark/70">{p.departamentoOferente}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
