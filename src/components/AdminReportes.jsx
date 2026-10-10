import { useState, useEffect } from 'react'
import { calcularReporte } from '../lib/reportes'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import ReportesGraficas from './ReportesGraficas'
import { dibujarEncabezadoPDF, opcionesTablaMembrete, crearDocumentoCarta } from '../lib/pdfEncabezado'
import { generarOficioDOC, generarOficioPDF, obtenerFilasIndicadores } from '../lib/oficioOficialITD'
import { HEADER_OFICIO_BASE64, FOOTER_OFICIO_BASE64 } from '../lib/plantillaMembrete'
import { supabase } from '../lib/supabaseClient'

const ANIO_ACTUAL = new Date().getFullYear()
const ANIOS = Array.from({ length: 6 }, (_, i) => ANIO_ACTUAL - i)

function formatearFechaSegura(fechaRaw, fallback = 'Reciente') {
  if (!fechaRaw) return fallback
  try {
    const d = new Date(fechaRaw)
    if (isNaN(d.getTime())) return String(fechaRaw)
    return d.toLocaleString('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return String(fechaRaw || fallback)
  }
}

export default function AdminReportes() {
  const [tipoPeriodo, setTipoPeriodo] = useState('actual') // 'actual' | 'trimestre' | 'anio' | 'acumulado'
  const [anio, setAnio] = useState(ANIO_ACTUAL)
  const [trimestre, setTrimestre] = useState(4)
  const [cargando, setCargando] = useState(false)
  const [reporte, setReporte] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [mensajeExito, setMensajeExito] = useState('')

  // Configuración personalizada para el Oficio Oficial Institucional (editable)
  const [numOficio, setNumOficio] = useState('416')
  const [fechaOficio, setFechaOficio] = useState(() => {
    return `Durango, Dgo., ${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`
  })
  const [nombreJefe, setNombreJefe] = useState('M.C. MÓNICA ROSALES PÉREZ')
  const [cargoJefe, setCargoJefe] = useState('JEFA DEL DEPTO. DESARROLLO ACADÉMICO')
  const [nombreFirma, setNombreFirma] = useState('M.C. Alejandro Calderón Rentería')
  const [cargoFirma, setCargoFirma] = useState('Coordinador de Actualización Docente')
  const [modoConteo, setModoConteo] = useState('unicos') // 'unicos' (solo docentes únicos) | 'registros'

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
    // Generar reporte inicial al cargar
    generar()
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
      const esOverrideValido =
        periodoOverride &&
        typeof periodoOverride === 'object' &&
        typeof periodoOverride.tipo === 'string'

      const periodo = esOverrideValido
        ? periodoOverride
        : tipoPeriodo === 'anio'
        ? { tipo: 'anio', anio }
        : tipoPeriodo === 'acumulado' || tipoPeriodo === 'acumulado_trimestre'
        ? { tipo: 'acumulado_trimestre', anio, trimestre: trimestre || 4 }
        : tipoPeriodo === 'actual'
        ? { tipo: 'actual', anio }
        : { tipo: 'trimestre', anio, trimestre: trimestre || 4 }

      const datos = await calcularReporte(periodo)
      setReporte(datos)
      if (datos.trimestre && !periodoOverride) {
        setTrimestre(datos.trimestre)
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('No se pudo generar el reporte: ' + err.message)
    }
    setCargando(false)
  }

  const [vista, setVista] = useState('oficio') // 'oficio' | 'tabla' | 'graficas' | 'participantes' | 'ejecutivo'
  const [filtroDepartamento, setFiltroDepartamento] = useState('')
  const [busquedaNombre, setBusquedaNombre] = useState('')

  function filasPlanas(r) {
    if (!r) return []
    return [
      ['TOTAL DE INSCRIPCIONES', r.totalInscripciones],
      ['Hombres', r.porGenero?.Hombre || 0],
      ['Mujeres', r.porGenero?.Mujer || 0],
      ['Tipo Docente', r.porTipo?.Docente || 0],
      ['Tipo Profesional', r.porTipo?.Profesional || 0],
      [],
      ['LICENCIATURA', r.licenciatura?.total || 0],
      ['  Hombres', r.licenciatura?.porGenero?.Hombre || 0],
      ['  Mujeres', r.licenciatura?.porGenero?.Mujer || 0],
      ['  Tipo Docente', r.licenciatura?.porTipo?.Docente || 0],
      ['  Tipo Profesional', r.licenciatura?.porTipo?.Profesional || 0],
      ['  Habilidades Digitales', r.licenciatura?.habilidadesDigitales || 0],
      ['  Estrategias Tutoriales / Salud Emocional', r.licenciatura?.saludEmocional || 0],
      [],
      ['POSGRADO (Maestría/Doctorado)', r.posgrado?.total || 0],
      ['  Hombres', r.posgrado?.porGenero?.Hombre || 0],
      ['  Mujeres', r.posgrado?.porGenero?.Mujer || 0],
      ['  Tipo Docente', r.posgrado?.porTipo?.Docente || 0],
      ['  Tipo Profesional', r.posgrado?.porTipo?.Profesional || 0],
      ['  Habilidades Digitales', r.posgrado?.habilidadesDigitales || 0],
      ['  Estrategias Tutoriales / Salud Emocional', r.posgrado?.saludEmocional || 0],
      [],
      ['DOCENTES ÚNICOS EN EL PERIODO', r.docentesUnicos || 0],
      ['  Hombres', r.docentesUnicosPorGenero?.Hombre || 0],
      ['  Mujeres', r.docentesUnicosPorGenero?.Mujer || 0],
      ['  Tipo Docente', r.docentesUnicosPorTipo?.Docente || 0],
      ['  Tipo Profesional', r.docentesUnicosPorTipo?.Profesional || 0],
      ['Total de docentes en la institución (plantilla activa)', r.totalDocentesInstitucion || 417],
      ['% de participación (cobertura de plantilla)', `${r.porcentajeParticipacion || 0}%`],
      [],
      ['SIN PARTICIPAR EN EL PERIODO', r.sinParticipar?.total || 0],
      ['  Hombres', r.sinParticipar?.porGenero?.Hombre || 0],
      ['  Mujeres', r.sinParticipar?.porGenero?.Mujer || 0],
      [],
      ['DISTRIBUCIÓN POR NÚMERO DE CURSOS TOMADOS', ''],
      ['1 curso', r.distribucionPorNumeroCursos?.[1] || 0],
      ['2 cursos', r.distribucionPorNumeroCursos?.[2] || 0],
      ['3 cursos', r.distribucionPorNumeroCursos?.[3] || 0],
      ['4 cursos', r.distribucionPorNumeroCursos?.[4] || 0],
      ['5 cursos', r.distribucionPorNumeroCursos?.[5] || 0],
      ['6 o más cursos', r.distribucionPorNumeroCursos?.['6+'] || 0],
      [],
      ['CURSOS MÁS DEMANDADOS', ''],
      ...(r.cursosMasDemandados || []).map((c) => [`  ${c.nombre}`, c.cantidad]),
      [],
      ['PARTICIPACIÓN POR DEPARTAMENTO', ''],
      ...(r.porDepartamento || []).map((d) => [`  ${d.nombre}`, d.cantidad]),
    ]
  }

  const NOMBRES_TRIMESTRE = { 1: 'Enero', 2: 'Junio', 3: 'Agosto', 4: 'Octubre - Diciembre' }

  function tituloPeriodo() {
    const t = reporte?.trimestre || trimestre || 4
    const esAcum = tipoPeriodo === 'anio' || tipoPeriodo === 'acumulado' || tipoPeriodo === 'acumulado_trimestre' || Boolean(reporte?.esAcumulado)
    if (tipoPeriodo === 'anio') return `Reporte Acumulado Anual ${anio}`
    if (esAcum) {
      return t >= 4
        ? `Reporte Acumulado Anual ${anio} (1°T al 4°T)`
        : `Reporte Acumulado al ${t}° Trimestre ${anio} (1°T al ${t}°T)`
    }
    if (tipoPeriodo === 'actual') return `Periodo actual (${NOMBRES_TRIMESTRE[t] || '4°T'} ${anio})`
    return `Trimestre ${t} (${NOMBRES_TRIMESTRE[t] || 'Actual'}) ${anio}`
  }

  function periodoTextoOficio() {
    const t = reporte?.trimestre || trimestre || 4
    if (tipoPeriodo === 'anio') return `el Año Completo ${anio}`
    if (tipoPeriodo === 'acumulado' || Boolean(reporte?.esAcumulado)) {
      return t >= 4 ? `el Periodo Anual Acumulado ${anio}` : `el Periodo Acumulado al ${t}° Trimestre ${anio}`
    }
    return `el ${t}° Trimestre ${anio}`
  }

  async function descargarOficioWord() {
    if (!reporte) return
    const ind = modoConteo === 'unicos'
      ? (reporte.indicadoresOficio || {})
      : (reporte.indicadoresRegistros || {})
    generarOficioDOC({
      numOficio,
      anio,
      fechaTexto: fechaOficio,
      nombreJefe,
      cargoJefe,
      periodoTexto: periodoTextoOficio().replace(/^el\s+/i, ''),
      nombreFirma,
      cargoFirma,
      indicadores: ind,
    })
    const folio = `Oficio No. ${numOficio}/${anio}`
    await registrarReporteGenerado({
      id: `${folio}_${Date.now()}`,
      folio,
      tipo: 'Formato .DOC (Word)',
      periodo: periodoTextoOficio(),
      anio,
      trimestre: reporte?.trimestre || trimestre || 4,
      totalInscripciones: ind.totalRegistros || 0,
      totalHoras: 40,
      porcentajeAprobacion: ind.coberturaPorcentaje || 100,
      elaboro: nombreFirma,
      fecha: new Date().toISOString(),
    })
    setMensajeExito(`¡${folio} generado, registrado en bitácora y descargado en .DOC (Word) con éxito!`)
    setTimeout(() => setMensajeExito(''), 7000)
  }

  async function descargarOficioPDF() {
    if (!reporte) return
    const ind = modoConteo === 'unicos'
      ? (reporte.indicadoresOficio || {})
      : (reporte.indicadoresRegistros || {})
    await generarOficioPDF({
      numOficio,
      anio,
      fechaTexto: fechaOficio,
      nombreJefe,
      cargoJefe,
      periodoTexto: periodoTextoOficio().replace(/^el\s+/i, ''),
      nombreFirma,
      cargoFirma,
      indicadores: ind,
      descargar: true,
    })
    const folio = `Oficio No. ${numOficio}/${anio}`
    await registrarReporteGenerado({
      id: `${folio}_${Date.now()}`,
      folio,
      tipo: 'Formato Oficial PDF',
      periodo: periodoTextoOficio(),
      anio,
      trimestre: reporte?.trimestre || trimestre || 4,
      totalInscripciones: ind.totalRegistros || 0,
      totalHoras: 40,
      porcentajeAprobacion: ind.coberturaPorcentaje || 100,
      elaboro: nombreFirma,
      fecha: new Date().toISOString(),
    })
    setMensajeExito(`¡${folio} generado, registrado en bitácora y descargado en PDF oficial con éxito!`)
    setTimeout(() => setMensajeExito(''), 7000)
  }

  function participantesFiltrados(r) {
    if (!r?.detalleParticipantes) return []
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
    const doc = crearDocumentoCarta(jsPDF)

    const startY = await dibujarEncabezadoPDF(doc, 'Listado de Participantes', [
      `Departamento: ${tituloDepto}`,
      `Periodo: ${tituloPeriodo()} (${reporte.rango.inicio} a ${reporte.rango.fin})`,
    ])

    autoTable(doc, {
      startY,
      ...opcionesTablaMembrete(doc),
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
    const doc = crearDocumentoCarta(jsPDF)

    const tituloDoc = tipoPeriodo === 'anio' ? `Reporte Anual de Capacitación ${anio}` : 'Reporte de Inscripciones y Capacitación Docente'
    const startY = await dibujarEncabezadoPDF(doc, tituloDoc, [
      `Periodo: ${tituloPeriodo()} (${reporte.rango.inicio} a ${reporte.rango.fin})`,
      `Fecha de emisión: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    ])

    autoTable(doc, {
      startY,
      ...opcionesTablaMembrete(doc),
      head: [['Indicador / Desglose', 'Total Registros']],
      body: filasPlanas(reporte).map(([a, b]) => [a || '', b === undefined ? '' : String(b)]),
      styles: { fontSize: 8.5, cellPadding: 2.2 },
      headStyles: { fillColor: [27, 57, 106], fontStyle: 'bold' },
      didParseCell: function (data) {
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-bold text-slate-500 tracking-wide uppercase">Módulo de Administración</span>
          </div>
          <h2 className="text-2xl font-bold text-itd-navy">Reportes de Capacitación y Actualización</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Estadísticas consolidadas e indicadores institucionales del TecNM / ITD.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-blue-50 text-itd-navy border border-blue-200">
            Ciclo Institucional {anio}
          </span>
        </div>
      </div>

      {/* Controles de Selección de Periodo */}
      <div className="flex flex-wrap items-end gap-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Periodo</label>
          <select
            value={tipoPeriodo}
            onChange={(e) => setTipoPeriodo(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-2xs focus:ring-2 focus:ring-itd-navy focus:outline-hidden"
          >
            <option value="actual">Periodo actual (Automático)</option>
            <option value="trimestre">Por Trimestre (individual)</option>
            <option value="acumulado">Acumulado al Trimestre</option>
            <option value="anio">Acumulado Anual (Año completo)</option>
          </select>
        </div>

        {tipoPeriodo !== 'actual' && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Año</label>
            <select
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-2xs focus:ring-2 focus:ring-itd-navy focus:outline-hidden"
            >
              {ANIOS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        )}

        {tipoPeriodo === 'trimestre' && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Trimestre específico</label>
            <select
              value={trimestre}
              onChange={(e) => setTrimestre(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-2xs focus:ring-2 focus:ring-itd-navy focus:outline-hidden"
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
            <label className="block text-xs font-semibold text-slate-600 mb-1">Corte Acumulado</label>
            <select
              value={trimestre}
              onChange={(e) => setTrimestre(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-2xs focus:ring-2 focus:ring-itd-navy focus:outline-hidden"
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
          className="rounded-lg bg-itd-navy text-white px-5 py-2 text-sm font-semibold hover:bg-itd-navyDark transition-colors disabled:opacity-50 cursor-pointer shadow-xs flex items-center gap-1.5"
        >
          {cargando ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>Generando…</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>Generar reporte</span>
            </>
          )}
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {reporte && (
        <div className="space-y-5">
          {/* Métricas Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <p className="text-2xl font-bold text-itd-navy">{reporte.totalInscripciones}</p>
              <p className="text-xs font-medium text-slate-500 mt-0.5">Total inscripciones</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <p className="text-2xl font-bold text-green-700">{reporte.docentesUnicos}</p>
              <p className="text-xs font-medium text-slate-500 mt-0.5">Docentes únicos</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <p className="text-2xl font-bold text-amber-600">{reporte.porcentajeParticipacion}%</p>
              <p className="text-xs font-medium text-slate-500 mt-0.5">Cobertura de plantilla</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <p className="text-2xl font-bold text-itd-guinda">{reporte.sinParticipar?.total || 0}</p>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Sin participar (H:{reporte.sinParticipar?.porGenero?.Hombre || 0} M:{reporte.sinParticipar?.porGenero?.Mujer || 0})
              </p>
            </div>
          </div>

          {/* Barra de Acciones y Pestañas */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={descargarOficioWord}
                className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white px-3.5 py-2 text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Descargar oficio oficial en formato editable de Microsoft Word (.DOC)"
              >
                <span>📝</span> Oficio (.DOC Word)
              </button>
              <button
                onClick={descargarOficioPDF}
                className="rounded-lg bg-itd-guinda hover:bg-itd-guinda/90 text-white px-3.5 py-2 text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Descargar oficio oficial en formato PDF idéntico al documento institucional (Hoja membretada oficial)"
              >
                <span>📜</span> Descargar Oficio (PDF)
              </button>
              <button
                onClick={exportarExcel}
                className="rounded-lg bg-green-700 hover:bg-green-800 text-white px-3.5 py-2 text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <span>📊</span> Excel
              </button>
              <button
                onClick={exportarPDF}
                className="rounded-lg bg-slate-700 hover:bg-slate-800 text-white px-3.5 py-2 text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Descargar reporte estadístico desglosado"
              >
                <span>📄</span> Reporte Detallado (PDF)
              </button>
            </div>

            <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-100 p-0.5">
              <button
                onClick={() => setVista('oficio')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  vista === 'oficio' ? 'bg-itd-navy text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>📜</span> Oficio Oficial ITD
              </button>
              <button
                onClick={() => setVista('tabla')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  vista === 'tabla' ? 'bg-white text-itd-navy shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tabla
              </button>
              <button
                onClick={() => setVista('graficas')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  vista === 'graficas' ? 'bg-white text-itd-navy shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Gráficas
              </button>
              <button
                onClick={() => setVista('participantes')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  vista === 'participantes' ? 'bg-white text-itd-navy shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Participantes
              </button>
            </div>
          </div>

          {/* VISTAS */}
          {vista === 'oficio' ? (
            <div className="space-y-6 animate-fade-in">
              {/* Panel de configuración de parámetros del Oficio Oficial */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-itd-navy flex items-center gap-2">
                      <span>⚙️</span> Parámetros del Oficio Institucional (Personalización en tiempo real)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Personaliza número de oficio, fecha en encabezado, nombre de la jefa/jefe y firmante.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={descargarOficioWord}
                      className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white px-3.5 py-1.5 text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <span>📝</span> Descargar .DOC (Word)
                    </button>
                    <button
                      onClick={descargarOficioPDF}
                      className="rounded-lg bg-itd-guinda hover:bg-itd-guinda/90 text-white px-3.5 py-1.5 text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <span>📄</span> Descargar PDF Oficial
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {/* Número de Oficio */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Número de Oficio (Oficio No. XXX/{anio})
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-300 px-2.5 py-2 rounded-lg">Oficio No.</span>
                      <input
                        type="text"
                        value={numOficio}
                        onChange={(e) => setNumOficio(e.target.value)}
                        placeholder="Ej. 416"
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-itd-navy focus:ring-2 focus:ring-itd-navy focus:outline-hidden"
                      />
                      <span className="text-xs font-bold text-slate-600">/{anio}</span>
                    </div>
                  </div>

                  {/* Fecha de Emisión */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Fecha en Encabezado Superior Derecho
                    </label>
                    <input
                      type="text"
                      value={fechaOficio}
                      onChange={(e) => setFechaOficio(e.target.value)}
                      placeholder="Durango, Dgo., 8 de octubre de 2026"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-itd-navy focus:outline-hidden"
                    />
                  </div>

                  {/* Modo de Conteo */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cálculo de Indicadores
                    </label>
                    <select
                      value={modoConteo}
                      onChange={(e) => setModoConteo(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-itd-navy focus:outline-hidden"
                    >
                      <option value="unicos">Docentes Únicos (1 docente = 1 conteo · Recomendado)</option>
                      <option value="registros">Total de Registros / Inscripciones</option>
                    </select>
                  </div>

                  {/* Nombre Jefe/a */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nombre de Jefa/Jefe de Depto. Desarrollo Académico
                    </label>
                    <input
                      type="text"
                      value={nombreJefe}
                      onChange={(e) => setNombreJefe(e.target.value)}
                      placeholder="M.C. MÓNICA ROSALES PÉREZ"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-itd-navy focus:outline-hidden"
                    />
                  </div>

                  {/* Cargo Jefe/a */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cargo del Destinatario
                    </label>
                    <input
                      type="text"
                      value={cargoJefe}
                      onChange={(e) => setCargoJefe(e.target.value)}
                      placeholder="JEFA DEL DEPTO. DESARROLLO ACADÉMICO"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-itd-navy focus:outline-hidden"
                    />
                  </div>

                  {/* Quien Firma (Nombre) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Quien Firma (Nombre)
                    </label>
                    <input
                      type="text"
                      value={nombreFirma}
                      onChange={(e) => setNombreFirma(e.target.value)}
                      placeholder="M.C. Alejandro Calderón Rentería"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-itd-navy focus:outline-hidden"
                    />
                  </div>

                  {/* Quien Firma (Cargo) */}
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cargo de Quien Firma
                    </label>
                    <input
                      type="text"
                      value={cargoFirma}
                      onChange={(e) => setCargoFirma(e.target.value)}
                      placeholder="Coordinador de Actualización Docente"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-itd-navy focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Vista Previa en Vivo de la Hoja Membretada (Idéntica al Formato Oficial PDF) */}
              <div className="bg-slate-200/80 p-4 sm:p-8 rounded-2xl flex justify-center overflow-x-auto shadow-inner">
                <div className="bg-white text-slate-900 shadow-2xl border border-slate-300 w-full max-w-[760px] text-xs sm:text-sm font-sans relative overflow-hidden flex flex-col justify-between min-h-[920px]">
                  {/* Membrete Superior Oficial Institucional (Extraído directamente de plantilla oficial) */}
                  <div className="w-full bg-white select-none">
                    <img
                      src={HEADER_OFICIO_BASE64}
                      alt="Membrete Superior Oficial TecNM / ITD"
                      className="w-full h-auto block pointer-events-none"
                    />
                  </div>

                  <div className="p-8 sm:p-12 pt-5 pb-4 flex-1">
                    {/* Encabezado superior derecho: Instituto Tecnológico de Durango, Depto., Fecha y Oficio No. */}
                    <div className="text-right mb-6 space-y-0.5">
                      <p className="font-bold text-slate-900 text-xs sm:text-sm">Instituto Tecnológico de Durango</p>
                      <p className="text-slate-700 text-[11px] sm:text-xs mb-1.5">Departamento de desarrollo académico</p>
                      <p className="text-slate-800 text-xs sm:text-sm">{fechaOficio}</p>
                      <p className="font-bold text-slate-900 text-xs sm:text-sm">Oficio No. {numOficio}/{anio}</p>
                    </div>

                    {/* Destinatario */}
                    <div className="mb-5 space-y-0.5 font-bold text-slate-900 text-xs sm:text-sm">
                      <p className="tracking-wide">{nombreJefe.toUpperCase()}</p>
                      <p>{cargoJefe.toUpperCase()}</p>
                      <p>PRESENTE</p>
                    </div>

                    {/* Párrafo de apertura */}
                    <p className="text-justify text-slate-800 text-xs sm:text-sm mb-4 leading-relaxed">
                      Sirva la presente para informarle que durante {periodoTextoOficio()}, el programa de Formación y Actualización Docente presenta los siguientes resultados:
                    </p>

                    {/* Tabla con los 14 Indicadores Oficiales */}
                    <div className="border border-slate-300 rounded-xs overflow-hidden mb-4 shadow-2xs">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100/90 text-slate-800 border-b border-slate-300 font-bold">
                            <th className="text-left py-2 px-3">Indicador / Concepto</th>
                            <th className="text-right py-2 px-3 w-36">Valor / Cantidad</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {obtenerFilasIndicadores(
                            modoConteo === 'unicos'
                              ? (reporte.indicadoresOficio || {})
                              : (reporte.indicadoresRegistros || {})
                          ).map((row, i) => (
                            <tr key={i} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                              <td className="py-1.5 px-3 text-slate-800">{row.concepto}</td>
                              <td className="py-1.5 px-3 text-right font-bold text-slate-900">{row.valor}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Párrafo de conclusión */}
                    <p className="text-justify text-slate-800 text-xs sm:text-sm mb-8 leading-relaxed">
                      Los indicadores muestran una participación en las actividades de actualización docente, alcanzando una cobertura del{' '}
                      <strong className="text-slate-900 font-bold">
                        {(modoConteo === 'unicos'
                          ? reporte.indicadoresOficio?.coberturaPorcentaje
                          : reporte.indicadoresRegistros?.coberturaPorcentaje) || reporte.porcentajeParticipacion}%
                      </strong>
                      .
                    </p>

                    {/* Bloque de firma */}
                    <div className="space-y-0.5 mb-8 text-xs sm:text-sm">
                      <p className="font-bold tracking-widest text-slate-900">A T E N T A M E N T E</p>
                      <p className="italic text-slate-700 text-[11px]">Excelencia en Educación Tecnológica®</p>
                      <p className="italic text-slate-700 text-[11px] mb-8">La Técnica al Servicio de la Patria</p>

                      <div className="pt-8">
                        <p className="font-bold text-slate-900">{nombreFirma}</p>
                        <p className="font-bold text-slate-700 text-[11px]">{cargoFirma}</p>
                      </div>
                    </div>

                    {/* c.c.p Archivo */}
                    <p className="text-[11px] text-slate-500 mb-6">c.c.p Archivo</p>
                  </div>

                  {/* Membrete Inferior Oficial Institucional (Pie de Página extraído de plantilla oficial) */}
                  <div className="w-full mt-auto bg-white select-none">
                    <img
                      src={FOOTER_OFICIO_BASE64}
                      alt="Pie de Página Oficial ITD"
                      className="w-full h-auto block pointer-events-none"
                    />
                  </div>
                </div>
              </div>

              {/* Bitácora y Registro de Oficios Oficiales Generados */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
                  <div>
                    <h4 className="font-bold text-xs text-itd-navy uppercase tracking-wider flex items-center gap-1.5">
                      <span>📋</span> Bitácora de Oficios Oficiales Emitidos
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Registro de oficios generados para archivo institucional y constancia.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={cargarHistorialSupabase}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    <span>🔄</span> Sincronizar
                  </button>
                </div>

                {historialReportes.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                    <p className="text-xs">No hay oficios registrados en la bitácora todavía.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Al presionar &quot;Descargar .DOC (Word)&quot; o &quot;Descargar PDF Oficial&quot;, el oficio se registrará aquí automáticamente.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-2">Folio Oficio</th>
                          <th className="p-2">Periodo</th>
                          <th className="p-2 text-center">Registros</th>
                          <th className="p-2">Fecha Emisión</th>
                          <th className="p-2">Elaboró</th>
                          <th className="p-2 text-right">Descargar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {historialReportes.map((item, idx) => (
                          <tr key={item.id || item.folio || idx} className="hover:bg-slate-50/80">
                            <td className="p-2 font-bold text-itd-navy flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                              {item.folio}
                            </td>
                            <td className="p-2 text-slate-700">{item.periodo}</td>
                            <td className="p-2 text-center font-bold">{item.total_inscripciones || item.totalInscripciones || '—'}</td>
                            <td className="p-2 text-slate-500">
                              {formatearFechaSegura(item.created_at || item.fecha)}
                            </td>
                            <td className="p-2 text-slate-600 truncate max-w-[150px]">{item.elaboro || nombreFirma}</td>
                            <td className="p-2 text-right space-x-1.5">
                              <button
                                type="button"
                                onClick={descargarOficioPDF}
                                className="text-itd-guinda font-bold hover:underline text-[11px] cursor-pointer"
                              >
                                PDF
                              </button>
                              <span className="text-slate-300">·</span>
                              <button
                                type="button"
                                onClick={descargarOficioWord}
                                className="text-blue-700 font-bold hover:underline text-[11px] cursor-pointer"
                              >
                                Word
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
          ) : vista === 'tabla' ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {filasPlanas(reporte).map(([label, valor], i) => (
                    <tr key={i} className={label ? 'border-b border-slate-100 hover:bg-slate-50/70' : 'h-3 bg-slate-50/40'}>
                      <td className="py-2 px-4 text-slate-700 font-medium">{label}</td>
                      <td className="py-2 px-4 font-bold text-slate-900 text-right">{valor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : vista === 'graficas' ? (
            <ReportesGraficas reporte={reporte} anioSeleccionado={anio} tipoPeriodo={tipoPeriodo} />
          ) : (
            /* VISTA PARTICIPANTES */
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Departamento</label>
                  <select
                    value={filtroDepartamento}
                    onChange={(e) => setFiltroDepartamento(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
                  >
                    <option value="">Todos los departamentos</option>
                    {reporte.porDepartamento.map((d) => (
                      <option key={d.nombre} value={d.nombre}>{d.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Buscar por nombre</label>
                  <input
                    type="text"
                    value={busquedaNombre}
                    onChange={(e) => setBusquedaNombre(e.target.value)}
                    placeholder="Nombre del docente…"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800"
                  />
                </div>
                <button
                  onClick={exportarParticipantesExcel}
                  className="rounded-lg bg-green-700 hover:bg-green-800 text-white px-3 py-1.5 text-xs font-semibold shadow-xs"
                >
                  ⬇ Excel
                </button>
                <button
                  onClick={exportarParticipantesPDF}
                  className="rounded-lg bg-itd-guinda hover:bg-itd-guinda/90 text-white px-3 py-1.5 text-xs font-semibold shadow-xs"
                >
                  ⬇ PDF
                </button>
                <p className="text-xs text-slate-500 ml-auto">
                  {participantesFiltrados(reporte).length} de {reporte.detalleParticipantes.length} participantes
                </p>
              </div>

              <div className="overflow-x-auto max-h-[500px] overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="text-left py-2 px-3">Folio</th>
                      <th className="text-left py-2 px-3">Nombre</th>
                      {!filtroDepartamento && <th className="text-left py-2 px-3">Departamento</th>}
                      <th className="text-left py-2 px-3">Curso</th>
                      <th className="text-left py-2 px-3">Departamento Oferente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {participantesFiltrados(reporte).map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">{p.folio}</td>
                        <td className="py-2 px-3 font-semibold text-slate-800">{p.nombre}</td>
                        {!filtroDepartamento && <td className="py-2 px-3 text-slate-600">{p.departamento}</td>}
                        <td className="py-2 px-3 text-slate-700">{p.curso}</td>
                        <td className="py-2 px-3 text-slate-500">{p.departamentoOferente}</td>
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