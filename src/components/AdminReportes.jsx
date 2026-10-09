import { useState, useEffect } from 'react'
import { calcularReporte } from '../lib/reportes'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import ReportesGraficas from './ReportesGraficas'
import { dibujarEncabezadoPDF } from '../lib/pdfEncabezado'
import { generarReporteEjecutivoTecNM_PDF } from '../lib/reporteEjecutivoTecNM'
import { supabase } from '../lib/supabaseClient'

const ANIO_ACTUAL = new Date().getFullYear()
const ANIOS = Array.from({ length: 6 }, (_, i) => ANIO_ACTUAL - i)

export default function AdminReportes() {
  const [tipoPeriodo, setTipoPeriodo] = useState('actual') // 'actual' | 'trimestre' | 'anio'
  const [anio, setAnio] = useState(ANIO_ACTUAL)
  const [trimestre, setTrimestre] = useState(1)
  const [cargando, setCargando] = useState(false)
  const [reporte, setReporte] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [generandoEjecutivoPDF, setGenerandoEjecutivoPDF] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')

  // Historial y registro de reportes ejecutivos generados (para persistencia en Vercel/Supabase)
  const [historialReportes, setHistorialReportes] = useState(() => {
    try {
      const guardado = localStorage.getItem('itd_historial_reportes_tecnm')
      return guardado ? JSON.parse(guardado) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    cargarHistorialSupabase()
  }, [])

  async function cargarHistorialSupabase() {
    try {
      const { data, error } = await supabase
        .from('historial_reportes_tecnm')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(25)

      if (!error && Array.isArray(data) && data.length > 0) {
        setHistorialReportes(data)
        try {
          localStorage.setItem('itd_historial_reportes_tecnm', JSON.stringify(data))
        } catch {}
      }
    } catch (err) {
      console.warn('Bitácora en Supabase aún no configurada, usando registro local persistente:', err)
    }
  }

  async function registrarReporteGenerado(registro) {
    const nuevoHistorial = [
      registro,
      ...historialReportes.filter((r) => r.folio !== registro.folio || r.fecha !== registro.fecha),
    ].slice(0, 30)
    setHistorialReportes(nuevoHistorial)
    try {
      localStorage.setItem('itd_historial_reportes_tecnm', JSON.stringify(nuevoHistorial))
    } catch {}

    // Intentar registrar en Supabase para sincronización entre dispositivos y despliegues Vercel
    try {
      await supabase.from('historial_reportes_tecnm').insert([
        {
          folio: registro.folio,
          tipo: registro.tipo,
          periodo: registro.periodo,
          anio: registro.anio,
          trimestre: registro.trimestre,
          total_inscripciones: registro.totalInscripciones,
          total_horas: registro.totalHoras,
          porcentaje_aprobacion: registro.porcentajeAprobacion,
          elaboro: registro.elaboro,
          created_at: new Date().toISOString(),
        },
      ])
    } catch (err) {
      console.warn('Guardado en registro local completado (Supabase opcional):', err)
    }
  }

  async function generar(periodoOverride = null) {
    setCargando(true)
    setErrorMsg('')
    try {
      // Ignorar si el argumento es un evento de click de React
      const esOverrideValido =
        periodoOverride &&
        typeof periodoOverride === 'object' &&
        typeof periodoOverride.tipo === 'string'

      const periodo = esOverrideValido
        ? periodoOverride
        : (tipoPeriodo === 'anio'
          ? { tipo: 'anio', anio }
          : tipoPeriodo === 'acumulado' || tipoPeriodo === 'acumulado_trimestre'
          ? { tipo: 'acumulado_trimestre', anio, trimestre }
          : tipoPeriodo === 'actual'
          ? { tipo: 'actual', anio }
          : { tipo: 'trimestre', anio, trimestre })

      const datos = await calcularReporte(periodo)
      setReporte(datos)
    } catch (err) {
      console.error(err)
      setErrorMsg('No se pudo generar el reporte: ' + err.message)
    }
    setCargando(false)
  }

  const [vista, setVista] = useState('tabla') // 'tabla' | 'graficas' | 'participantes' | 'ejecutivo'
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

  const NOMBRES_TRIMESTRE = { 1: 'Enero', 2: 'Junio', 3: 'Agosto', 4: 'Octubre - Diciembre' }

  function tituloPeriodo() {
    const esAcum = tipoPeriodo === 'anio' || tipoPeriodo === 'acumulado' || tipoPeriodo === 'acumulado_trimestre' || Boolean(reporte?.esAcumulado)
    if (tipoPeriodo === 'anio') return `Reporte Acumulado Anual ${anio}`
    if (esAcum) {
      const t = trimestre || reporte?.trimestre || 4
      return t >= 4
        ? `Reporte Acumulado Anual ${anio} (1°T al 4°T)`
        : `Reporte Acumulado al ${t}° Trimestre ${anio} (1°T al ${t}°T)`
    }
    if (tipoPeriodo === 'actual') return `Periodo actual (${NOMBRES_TRIMESTRE[trimestre || 4] || '4°T'} ${anio})`
    return `Trimestre ${trimestre} (${NOMBRES_TRIMESTRE[trimestre] || 'Actual'}) ${anio}`
  }

  async function exportarReporteEjecutivoTecNM() {
    if (!reporte) return
    setGenerandoEjecutivoPDF(true)
    setErrorMsg('')
    setMensajeExito('')
    try {
      const esAcum =
        tipoPeriodo === 'anio' ||
        tipoPeriodo === 'acumulado' ||
        tipoPeriodo === 'acumulado_trimestre' ||
        Boolean(reporte.esAcumulado)

      const resultado = await generarReporteEjecutivoTecNM_PDF(reporte, {
        tipoPeriodo,
        anio,
        trimestre,
        modalidad: esAcum ? 'acumulado' : 'trimestre',
        tituloPeriodo: tituloPeriodo(),
        descargar: true,
      })

      const tNum = trimestre || reporte?.trimestre || 4
      const folio = `ITD-CAD-REP-${
        esAcum
          ? (tipoPeriodo === 'anio' || tNum >= 4 ? 'Acumulado_Anual' : `Acumulado_${tNum}T`)
          : `${tNum}T`
      }/${anio}`

      await registrarReporteGenerado({
        id: `${folio}_${Date.now()}`,
        folio,
        tipo: esAcum ? 'Acumulado' : 'Trimestral',
        periodo: tituloPeriodo(),
        anio,
        trimestre: tNum,
        totalInscripciones: reporte.totalInscripciones || 0,
        totalHoras: reporte.totalHorasAcumuladas || 0,
        porcentajeAprobacion: reporte.resumenAprobacion?.porcentajeAprobacion || 100,
        elaboro: 'M.C. Alejandro Calderón Rentería',
        fecha: new Date().toLocaleString('es-MX', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
      })

      setMensajeExito(`¡Reporte Oficial ${folio} generado, registrado en bitácora y descargado con éxito!`)
      setTimeout(() => setMensajeExito(''), 7000)
    } catch (err) {
      console.error('Error al generar Reporte Ejecutivo TecNM:', err)
      setErrorMsg('No se pudo generar el Reporte Ejecutivo TecNM: ' + err.message)
    } finally {
      setGenerandoEjecutivoPDF(false)
    }
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

  async function exportarParticipantesPDF() {
    if (!reporte) return
    const lista = participantesFiltrados(reporte)
    const tituloDepto = filtroDepartamento || 'Todos los departamentos'
    const doc = new jsPDF()

    const startY = await dibujarEncabezadoPDF(doc, 'Listado de Participantes', [
      `Departamento: ${tituloDepto}`,
      `Periodo: ${tituloPeriodo()} (${reporte.rango.inicio} a ${reporte.rango.fin})`,
    ])

    autoTable(doc, {
      startY,
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

  async function exportarPDF() {
    if (!reporte) return
    const doc = new jsPDF()

    const tituloDoc = tipoPeriodo === 'anio' ? `Reporte Anual de Capacitación ${anio}` : 'Reporte de Inscripciones y Capacitación Docente'
    const startY = await dibujarEncabezadoPDF(doc, tituloDoc, [
      `Periodo: ${tituloPeriodo()} (${reporte.rango.inicio} a ${reporte.rango.fin})`,
      `Fecha de emisión: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    ])

    // Tabla con autoTable
    autoTable(doc, {
      startY,
      head: [['Indicador / Desglose', 'Total Registros']],
      body: filasPlanas(reporte).map(([a, b]) => [a || '', b === undefined ? '' : String(b)]),
      styles: { fontSize: 8.5, cellPadding: 2.2 },
      headStyles: { fillColor: [27, 57, 106], fontStyle: 'bold' },
      didParseCell: function (data) {
        // Resaltar títulos de sección
        if (
          data.row.raw[0] &&
          (data.row.raw[0].startsWith('TOTAL') ||
            data.row.raw[0].startsWith('LICENCIATURA') ||
            data.row.raw[0].startsWith('POSGRADO') ||
            data.row.raw[0].startsWith('DOCENTES ÚNICOS') ||
            data.row.raw[0].startsWith('SIN PARTICIPAR') ||
            data.row.raw[0].startsWith('DISTRIBUCIÓN') ||
            data.row.raw[0].startsWith('CURSOS MÁS') ||
            data.row.raw[0].startsWith('PARTICIPACIÓN'))
        ) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = [241, 245, 249]
          data.cell.styles.textColor = [27, 57, 106]
        }
      },
    })

    const nombreArchivo =
      tipoPeriodo === 'anio'
        ? `Reporte_Capacitacion_Anual_${anio}.pdf`
        : `Reporte_Inscripciones_${reporte.rango.inicio}_a_${reporte.rango.fin}.pdf`
    doc.save(nombreArchivo)
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
                <option value="actual">Periodo actual (4°T Octubre)</option>
                <option value="trimestre">Por Trimestre (individual)</option>
                <option value="acumulado">Acumulado al Trimestre</option>
                <option value="anio">Acumulado Anual (Año completo)</option>
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
                <label className="block text-xs font-medium text-itd-navyDark/60 mb-1">Trimestre específico</label>
                <select
                  value={trimestre}
                  onChange={(e) => setTrimestre(Number(e.target.value))}
                  className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
                >
                  <option value={1}>Trimestre 1 (Enero)</option>
                  <option value={2}>Trimestre 2 (Junio)</option>
                  <option value={3}>Trimestre 3 (Agosto)</option>
                  <option value={4}>Trimestre 4 (Octubre - Diciembre)</option>
                </select>
              </div>
            )}

            {tipoPeriodo === 'acumulado' && (
              <div>
                <label className="block text-xs font-medium text-itd-navyDark/60 mb-1">Corte Acumulado</label>
                <select
                  value={trimestre}
                  onChange={(e) => setTrimestre(Number(e.target.value))}
                  className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
                >
                  <option value={1}>Acumulado al 1° Trimestre (Enero)</option>
                  <option value={2}>Acumulado al 2° Trimestre (Enero a Junio)</option>
                  <option value={3}>Acumulado al 3° Trimestre (Enero a Agosto)</option>
                  <option value={4}>Acumulado al 4° Trimestre / Anual (Todo el año)</option>
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => generar()}
              disabled={cargando}
              className="rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-50 cursor-pointer"
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

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={exportarExcel}
                  className="rounded-lg bg-green-700 text-white px-4 py-2 text-sm font-semibold hover:bg-green-800"
                >
                  ⬇ Exportar Excel
                </button>
                <button
                  onClick={exportarPDF}
                  className="rounded-lg bg-itd-guinda text-white px-4 py-2 text-sm font-semibold hover:opacity-90 flex items-center gap-1.5"
                >
                  <span>⬇</span> Exportar PDF con Logos
                </button>
                <button
                  onClick={exportarReporteEjecutivoTecNM}
                  disabled={generandoEjecutivoPDF}
                  className="rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-semibold hover:bg-itd-navyDark disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                  title="Genera el reporte ejecutivo solicitado por TecNM en PDF membretado y ligero (<350KB)"
                >
                  <span>🏛️</span> {generandoEjecutivoPDF ? 'Generando PDF TecNM…' : '⬇ Reporte Ejecutivo TecNM (PDF)'}
                </button>
                <div className="ml-auto flex flex-wrap rounded-lg border border-itd-navy/20 overflow-hidden">
                  <button
                    onClick={() => setVista('tabla')}
                    className={`px-3 sm:px-4 py-2 text-sm font-medium ${vista === 'tabla' ? 'bg-itd-navy text-white' : 'bg-white text-itd-navyDark hover:bg-slate-50'}`}
                  >
                    Tabla
                  </button>
                  <button
                    onClick={() => setVista('graficas')}
                    className={`px-3 sm:px-4 py-2 text-sm font-medium ${vista === 'graficas' ? 'bg-itd-navy text-white' : 'bg-white text-itd-navyDark hover:bg-slate-50'}`}
                  >
                    Gráficas y Comparativos
                  </button>
                  <button
                    onClick={() => setVista('participantes')}
                    className={`px-3 sm:px-4 py-2 text-sm font-medium ${vista === 'participantes' ? 'bg-itd-navy text-white' : 'bg-white text-itd-navyDark hover:bg-slate-50'}`}
                  >
                    Participantes
                  </button>
                  <button
                    onClick={() => setVista('ejecutivo')}
                    className={`px-3 sm:px-4 py-2 text-sm font-medium flex items-center gap-1.5 ${vista === 'ejecutivo' ? 'bg-itd-guinda text-white' : 'bg-white text-itd-navyDark hover:bg-slate-50'}`}
                  >
                    <span>🏛️</span> Reporte Ejecutivo TecNM
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
                <ReportesGraficas reporte={reporte} anioSeleccionado={anio} tipoPeriodo={tipoPeriodo} />
              ) : vista === 'ejecutivo' ? (
                /* VISTA: REPORTE EJECUTIVO SOLICITADO POR EL TecNM */
                <div className="space-y-6 bg-slate-50/70 p-4 sm:p-6 rounded-2xl border border-slate-200">
                  {/* Encabezado Oficial Ejecutivo */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-itd-navy/10 text-itd-navy">
                          Formato Oficial TecNM
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                          Membrete Oficial: oficio_registro_blanco.pdf
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          reporte.esAcumulado || tipoPeriodo === 'acumulado' || tipoPeriodo === 'anio'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {reporte.esAcumulado || tipoPeriodo === 'acumulado' || tipoPeriodo === 'anio' ? '📈 Modalidad Acumulada' : '📅 Modalidad Trimestral'}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-itd-navy">
                        Informe Ejecutivo {reporte.esAcumulado || tipoPeriodo === 'acumulado' || tipoPeriodo === 'anio' ? 'Acumulado' : 'Trimestral'} de Formación y Actualización Docente (TecNM)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Instituto Tecnológico de Durango · Depto. de Desarrollo Académico · Coordinación de Actualización Docente
                      </p>
                      <p className="text-xs font-semibold text-itd-guinda mt-1">
                        Periodo Evaluado: {tituloPeriodo()} ({reporte.rango.inicio} al {reporte.rango.fin})
                      </p>

                      {/* Selector Rápido de Modalidad: Trimestral vs Acumulado */}
                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          Cambiar Modalidad:
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setTipoPeriodo('trimestre')
                            generar({ tipo: 'trimestre', anio, trimestre: trimestre || 4 })
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            tipoPeriodo === 'trimestre' || (tipoPeriodo === 'actual' && !reporte.esAcumulado)
                              ? 'bg-itd-navy text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <span>📅</span> Por Trimestre ({trimestre || 4}°T)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTipoPeriodo('acumulado')
                            generar({ tipo: 'acumulado_trimestre', anio, trimestre: trimestre || 4 })
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            tipoPeriodo === 'acumulado' || tipoPeriodo === 'anio' || reporte.esAcumulado
                              ? 'bg-itd-guinda text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <span>📈</span> Acumulado {trimestre >= 4 || tipoPeriodo === 'anio' ? `Anual (${anio})` : `al ${trimestre}°T (${anio})`}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={exportarReporteEjecutivoTecNM}
                      disabled={generandoEjecutivoPDF}
                      className="shrink-0 bg-itd-guinda hover:bg-itd-guinda/90 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <span>📄</span>
                      {generandoEjecutivoPDF ? 'Generando PDF TecNM…' : 'Descargar PDF Membretado Ligero'}
                    </button>
                  </div>

                  {/* Resumen de Métricas Clave TecNM */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <p className="text-xs text-slate-500 font-medium">Meta Cobertura TecNM</p>
                      <p className="text-2xl font-bold text-amber-600 mt-0.5">{reporte.porcentajeParticipacion}%</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {reporte.docentesUnicos} de {reporte.totalDocentesInstitucion} docentes activos
                      </p>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <p className="text-xs text-slate-500 font-medium">Inscripciones Totales</p>
                      <p className="text-2xl font-bold text-itd-navy mt-0.5">{reporte.totalInscripciones}</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Hombres: {reporte.porGenero.Hombre} · Mujeres: {reporte.porGenero.Mujer}
                      </p>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <p className="text-xs text-slate-500 font-medium">Enfoque Formativo</p>
                      <p className="text-sm font-bold text-slate-800 mt-1.5">
                        Docente: <span className="text-itd-navy">{reporte.porTipo.Docente}</span>
                      </p>
                      <p className="text-sm font-bold text-slate-800">
                        Profesional: <span className="text-green-700">{reporte.porTipo.Profesional}</span>
                      </p>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <p className="text-xs text-slate-500 font-medium">Ejes Prioritarios TecNM</p>
                      <p className="text-xs font-semibold text-slate-700 mt-1">
                        💻 Hab. Digitales: <span className="font-bold text-itd-navy">{reporte.licenciatura.habilidadesDigitales + reporte.posgrado.habilidadesDigitales}</span>
                      </p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">
                        🧠 Salud Emocional: <span className="font-bold text-itd-guinda">{reporte.licenciatura.saludEmocional + reporte.posgrado.saludEmocional}</span>
                      </p>
                    </div>
                  </div>

                  {/* Tabla 1: Indicadores Globales de Participación y Cobertura */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-sm text-itd-navy mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-itd-navy"></span>
                      1. Indicadores Globales de Cobertura y Participación Institucional
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border border-slate-200 text-left">
                        <thead className="bg-itd-navy text-white">
                          <tr>
                            <th className="p-2.5 font-bold">Indicador Solicitado (TecNM)</th>
                            <th className="p-2.5 font-bold text-center">Total Registrado</th>
                            <th className="p-2.5 font-bold text-center">Desglose / Observaciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          <tr className="hover:bg-slate-50">
                            <td className="p-2.5 font-medium text-slate-800">Total de Inscripciones Procesadas</td>
                            <td className="p-2.5 font-bold text-center text-itd-navy">{reporte.totalInscripciones}</td>
                            <td className="p-2.5 text-center text-slate-600">100% de participantes en cursos del ciclo</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                            <td className="p-2.5 font-medium text-slate-800">Docentes Únicos Capacitados</td>
                            <td className="p-2.5 font-bold text-center text-green-700">{reporte.docentesUnicos}</td>
                            <td className="p-2.5 text-center text-slate-600">Plantilla activa total: {reporte.totalDocentesInstitucion} docentes</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                            <td className="p-2.5 font-medium text-slate-800">Porcentaje de Cobertura de Plantilla</td>
                            <td className="p-2.5 font-bold text-center text-amber-600">{reporte.porcentajeParticipacion}%</td>
                            <td className="p-2.5 text-center text-slate-600">
                              {reporte.porcentajeParticipacion >= 50 ? 'Meta Institucional TecNM Superada' : 'En proceso de meta'}
                            </td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                            <td className="p-2.5 font-medium text-slate-800">Distribución por Género (Inscripciones)</td>
                            <td className="p-2.5 font-bold text-center text-slate-800">
                              Hombres: {reporte.porGenero.Hombre} · Mujeres: {reporte.porGenero.Mujer}
                            </td>
                            <td className="p-2.5 text-center text-slate-600">
                              {reporte.totalInscripciones ? ((reporte.porGenero.Hombre / reporte.totalInscripciones) * 100).toFixed(1) : 0}% H | {reporte.totalInscripciones ? ((reporte.porGenero.Mujer / reporte.totalInscripciones) * 100).toFixed(1) : 0}% M
                            </td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                            <td className="p-2.5 font-medium text-slate-800">Distribución por Tipo de Curso</td>
                            <td className="p-2.5 font-bold text-center text-slate-800">
                              Docente: {reporte.porTipo.Docente} · Profesional: {reporte.porTipo.Profesional}
                            </td>
                            <td className="p-2.5 text-center text-slate-600">Formación docente y actualización profesional</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                            <td className="p-2.5 font-medium text-slate-800">Docentes sin Participar en el Periodo</td>
                            <td className="p-2.5 font-bold text-center text-itd-guinda">{reporte.sinParticipar.total}</td>
                            <td className="p-2.5 text-center text-slate-600">
                              Hombres: {reporte.sinParticipar.porGenero.Hombre} · Mujeres: {reporte.sinParticipar.porGenero.Mujer}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Tabla 2: Desglose por Nivel de Estudios y Ejes Estratégicos */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-sm text-itd-guinda mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-itd-guinda"></span>
                      2. Clasificación por Nivel Académico y Ejes Prioritarios TecNM
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border border-slate-200 text-left">
                        <thead className="bg-itd-guinda text-white">
                          <tr>
                            <th className="p-2.5 font-bold">Nivel Educativo</th>
                            <th className="p-2.5 font-bold text-center">Total</th>
                            <th className="p-2.5 font-bold text-center">Hombres</th>
                            <th className="p-2.5 font-bold text-center">Mujeres</th>
                            <th className="p-2.5 font-bold text-center">T. Docente</th>
                            <th className="p-2.5 font-bold text-center">T. Profesional</th>
                            <th className="p-2.5 font-bold text-center">Hab. Digitales</th>
                            <th className="p-2.5 font-bold text-center">Salud Emocional / Tut.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          <tr className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-800">Licenciatura</td>
                            <td className="p-2.5 font-bold text-center text-itd-navy">{reporte.licenciatura.total}</td>
                            <td className="p-2.5 text-center">{reporte.licenciatura.porGenero.Hombre}</td>
                            <td className="p-2.5 text-center">{reporte.licenciatura.porGenero.Mujer}</td>
                            <td className="p-2.5 text-center">{reporte.licenciatura.porTipo.Docente}</td>
                            <td className="p-2.5 text-center">{reporte.licenciatura.porTipo.Profesional}</td>
                            <td className="p-2.5 text-center font-semibold text-blue-700">{reporte.licenciatura.habilidadesDigitales}</td>
                            <td className="p-2.5 text-center font-semibold text-purple-700">{reporte.licenciatura.saludEmocional}</td>
                          </tr>
                          <tr className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-800">Posgrado (Maestría / Doctorado)</td>
                            <td className="p-2.5 font-bold text-center text-itd-navy">{reporte.posgrado.total}</td>
                            <td className="p-2.5 text-center">{reporte.posgrado.porGenero.Hombre}</td>
                            <td className="p-2.5 text-center">{reporte.posgrado.porGenero.Mujer}</td>
                            <td className="p-2.5 text-center">{reporte.posgrado.porTipo.Docente}</td>
                            <td className="p-2.5 text-center">{reporte.posgrado.porTipo.Profesional}</td>
                            <td className="p-2.5 text-center font-semibold text-blue-700">{reporte.posgrado.habilidadesDigitales}</td>
                            <td className="p-2.5 text-center font-semibold text-purple-700">{reporte.posgrado.saludEmocional}</td>
                          </tr>
                          <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300">
                            <td className="p-2.5 text-itd-navy">TOTAL ACUMULADO</td>
                            <td className="p-2.5 text-center text-itd-navy">{reporte.licenciatura.total + reporte.posgrado.total}</td>
                            <td className="p-2.5 text-center">{reporte.licenciatura.porGenero.Hombre + reporte.posgrado.porGenero.Hombre}</td>
                            <td className="p-2.5 text-center">{reporte.licenciatura.porGenero.Mujer + reporte.posgrado.porGenero.Mujer}</td>
                            <td className="p-2.5 text-center">{reporte.licenciatura.porTipo.Docente + reporte.posgrado.porTipo.Docente}</td>
                            <td className="p-2.5 text-center">{reporte.licenciatura.porTipo.Profesional + reporte.posgrado.porTipo.Profesional}</td>
                            <td className="p-2.5 text-center text-blue-700">{reporte.licenciatura.habilidadesDigitales + reporte.posgrado.habilidadesDigitales}</td>
                            <td className="p-2.5 text-center text-purple-700">{reporte.licenciatura.saludEmocional + reporte.posgrado.saludEmocional}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Tabla 3: Distribución por Intensidad de Cursos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-sm text-itd-navy mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-itd-navy"></span>
                        3. Distribución por Cursos Tomados
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border border-slate-200 text-left">
                          <thead className="bg-slate-100 text-slate-700">
                            <tr>
                              <th className="p-2 font-bold">Carga de Cursos</th>
                              <th className="p-2 font-bold text-center">Docentes</th>
                              <th className="p-2 font-bold text-center">% Participantes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {[1, 2, 3, 4, 5, '6+'].map((num) => {
                              const cant = reporte.distribucionPorNumeroCursos[num] || 0
                              const porc = reporte.docentesUnicos
                                ? ((cant / reporte.docentesUnicos) * 100).toFixed(1)
                                : '0'
                              return (
                                <tr key={num} className="hover:bg-slate-50">
                                  <td className="p-2 text-slate-700">
                                    {num === '6+' ? '6 o más cursos' : `${num} curso${num > 1 ? 's' : ''}`}
                                  </td>
                                  <td className="p-2 font-bold text-center text-slate-900">{cant}</td>
                                  <td className="p-2 text-center text-slate-500">{porc}%</td>
                                </tr>
                              )
                            })}
                            <tr className="bg-slate-100/70 font-bold">
                              <td className="p-2 text-itd-navy">Total Docentes</td>
                              <td className="p-2 text-center text-itd-navy">{reporte.docentesUnicos}</td>
                              <td className="p-2 text-center text-itd-navy">100.0%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Tabla 4: Cursos con Mayor Demanda */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-sm text-itd-navy mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-itd-navy"></span>
                        4. Cursos con Mayor Demanda (Top)
                      </h4>
                      <div className="overflow-x-auto max-h-[220px]">
                        <table className="w-full text-xs border border-slate-200 text-left">
                          <thead className="bg-slate-100 text-slate-700 sticky top-0">
                            <tr>
                              <th className="p-2 font-bold">Curso</th>
                              <th className="p-2 font-bold text-center">Total</th>
                              <th className="p-2 font-bold text-center">H</th>
                              <th className="p-2 font-bold text-center">M</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {reporte.cursosMasDemandados.slice(0, 6).map((c, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="p-2 text-slate-800 font-medium truncate max-w-[220px]" title={c.nombre}>
                                  {c.nombre}
                                </td>
                                <td className="p-2 font-bold text-center text-itd-navy">{c.cantidad}</td>
                                <td className="p-2 text-center text-slate-600">{c.Hombre || 0}</td>
                                <td className="p-2 text-center text-slate-600">{c.Mujer || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Sección de Validación y Firmas Oficiales */}
                  <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <p className="text-center font-bold text-xs tracking-wider text-itd-navy uppercase mb-1">
                      A T E N T A M E N T E
                    </p>
                    <p className="text-center italic font-semibold text-[11px] text-itd-guinda mb-6">
                      Excelencia en Educación Tecnológica® · La Técnica al Servicio de la Patria
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                      <div className="border-t border-slate-300 pt-3">
                        <p className="font-bold text-xs text-slate-900">M.C. Alejandro Calderón Rentería</p>
                        <p className="text-[11px] text-slate-500">Coordinador de Actualización Docente</p>
                        <p className="text-[10px] text-slate-400 mt-1">Elaboró</p>
                      </div>

                      <div className="border-t border-slate-300 pt-3">
                        <p className="font-bold text-xs text-slate-900">M.C. Mónica Rosales Pérez</p>
                        <p className="text-[11px] text-slate-500">Jefa del Depto. de Desarrollo Académico</p>
                        <p className="text-[10px] text-slate-400 mt-1">Vo.Bo.</p>
                      </div>

                      <div className="border-t border-slate-300 pt-3">
                        <p className="font-bold text-xs text-slate-900">Dra. Adriana Eréndira Murillo</p>
                        <p className="text-[11px] text-slate-500">Subdirectora Académica</p>
                        <p className="text-[10px] text-slate-400 mt-1">Autorizó</p>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
                      <p>c.c.p. Dirección ITD · c.c.p. TecNM Dirección de Docencia · c.c.p. Archivo</p>
                      <button
                        onClick={exportarReporteEjecutivoTecNM}
                        disabled={generandoEjecutivoPDF}
                        className="text-itd-guinda font-bold hover:underline flex items-center gap-1 disabled:opacity-50"
                      >
                        <span>⬇</span> {generandoEjecutivoPDF ? 'Descargando...' : 'Descargar PDF Oficial con Membrete'}
                      </button>
                    </div>
                  </div>

                  {/* Mensaje de confirmación de registro y descarga */}
                  {mensajeExito && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between gap-3 text-sm animate-fade-in">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">✅</span>
                        <span className="font-semibold">{mensajeExito}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMensajeExito('')}
                        className="text-xs text-emerald-600 hover:text-emerald-900 font-bold"
                      >
                        Cerrar ✕
                      </button>
                    </div>
                  )}

                  {/* Sección: Bitácora y Registro Histórico Oficial */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-itd-navy flex items-center gap-1.5">
                            <span>📋</span> Bitácora y Registro de Reportes Generados
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            Vercel · Supabase Cloud
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Registro de oficios ejecutivos generados para auditoría TecNM y constancia institucional.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">
                          {historialReportes.length} {historialReportes.length === 1 ? 'registro' : 'registros'} guardados
                        </span>
                        <button
                          type="button"
                          onClick={cargarHistorialSupabase}
                          title="Sincronizar historial desde la base de datos de Supabase"
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1"
                        >
                          <span>🔄</span> Actualizar
                        </button>
                      </div>
                    </div>

                    {historialReportes.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                        <p className="text-xs font-medium">Aún no hay reportes registrados en la bitácora.</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Al hacer clic en &quot;Descargar Reporte Oficial (PDF)&quot;, se guardará automáticamente la constancia con su folio único.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="p-2.5">Folio Oficio</th>
                              <th className="p-2.5">Modalidad / Periodo</th>
                              <th className="p-2.5 text-center">Inscripciones</th>
                              <th className="p-2.5 text-center">Horas</th>
                              <th className="p-2.5">Fecha de Registro</th>
                              <th className="p-2.5">Elaboró</th>
                              <th className="p-2.5 text-right">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {historialReportes.map((item, idx) => (
                              <tr key={item.id || item.folio || idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-2.5 font-bold text-itd-navy flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                  {item.folio}
                                </td>
                                <td className="p-2.5">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mr-1.5 ${
                                    item.tipo === 'Acumulado'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {item.tipo}
                                  </span>
                                  <span className="text-slate-600 font-medium">{item.periodo}</span>
                                </td>
                                <td className="p-2.5 text-center font-bold text-slate-700">
                                  {item.total_inscripciones || item.totalInscripciones || '—'}
                                </td>
                                <td className="p-2.5 text-center text-slate-600">
                                  {item.total_horas || item.totalHoras || '—'} hrs
                                </td>
                                <td className="p-2.5 text-slate-500">
                                  {item.created_at
                                    ? new Date(item.created_at).toLocaleString('es-MX', {
                                        dateStyle: 'short',
                                        timeStyle: 'short',
                                      })
                                    : item.fecha || 'Reciente'}
                                </td>
                                <td className="p-2.5 text-slate-600 truncate max-w-[140px]" title={item.elaboro}>
                                  {item.elaboro || 'M.C. Alejandro Calderón'}
                                </td>
                                <td className="p-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={exportarReporteEjecutivoTecNM}
                                    disabled={generandoEjecutivoPDF}
                                    className="px-2 py-1 text-[11px] font-bold text-itd-guinda hover:bg-rose-50 rounded transition-colors"
                                  >
                                    ⬇ Re-descargar
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
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
