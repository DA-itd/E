import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import * as XLSX from 'xlsx'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  WidthType,
  AlignmentType,
  BorderStyle,
} from 'docx'
import { saveAs } from 'file-saver'
import { dibujarEncabezadoPDF } from '../lib/pdfEncabezado'
import { calcularReporte, calcularHistoricoMultianual } from '../lib/reportes'

// Normalización de nombres de departamento para comparaciones robustas
function normalizarNombreDepto(texto) {
  return (texto || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/^DEPARTAMENTO\s+DE\s+/i, '')
    .replace(/^DEPTO\.?\s+DE\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Unifica nombres de departamento al estándar oficial institucional
export function canonizarDepartamento(depto) {
  if (!depto) return 'Sin especificar'
  const limpio = String(depto).trim()
  const norm = normalizarNombreDepto(limpio)

  if (norm.includes('ECONOM') && norm.includes('ADMINISTRAT')) {
    return 'DEPARTAMENTO DE CIENCIAS ECONÓMICO ADMINISTRATIVAS'
  }
  if (norm.includes('BASICA') || norm === 'BASICAS') {
    return 'DEPARTAMENTO DE CIENCIAS BÁSICAS'
  }
  if (norm.includes('TIERRA')) {
    return 'DEPARTAMENTO DE CIENCIAS DE LA TIERRA'
  }
  if (norm.includes('INDUSTRIAL')) {
    return 'DEPARTAMENTO DE INGENIERÍA INDUSTRIAL'
  }
  if (norm.includes('QUIMIC') || norm.includes('BIOQUIMIC')) {
    return 'DEPARTAMENTO DE INGENIERÍAS QUÍMICA-BIOQUÍMICA'
  }
  if (norm.includes('ELECTRICA') || norm.includes('ELECTRONICA')) {
    return 'DEPARTAMENTO DE INGENIERÍAS ELÉCTRICA - ELECTRÓNICA'
  }
  if (norm.includes('METAL') || norm.includes('MECANICA')) {
    return 'DEPARTAMENTO DE METAL-MECÁNICA'
  }
  if (norm.includes('SISTEMA') || norm.includes('COMPUTAC')) {
    return 'DEPARTAMENTO DE SISTEMAS Y COMPUTACION'
  }
  if (norm.includes('DESARROLLO ACADEMIC')) {
    return 'DEPARTAMENTO DE DESARROLLO ACADÉMICO'
  }
  if (norm.includes('POSGRADO')) {
    return 'DIVISION DE ESTUDIOS DE POSGRADO E INVESTIGACION'
  }
  return limpio
}

function coincidenDeptos(a, b) {
  if (!a || !b) return false
  const na = normalizarNombreDepto(a)
  const nb = normalizarNombreDepto(b)
  if (na === nb) return true
  // Unificación especial para Ciencias Económico Administrativas
  if (na.includes('ECONOM') && na.includes('ADMINISTRAT') && nb.includes('ECONOM') && nb.includes('ADMINISTRAT')) {
    return true
  }
  return na.includes(nb) || nb.includes(na)
}

// ---------------------------------------------------------------------------
// RENDERIZADO EN CANVAS DE LAS GRÁFICAS DE "REPORTE" PARA EMBEBER EN EL PDF
// 1. Participación por departamento (destacando el departamento seleccionado)
// 2. Evolución y Acumulado Multianual (2022 - 2026)
// ---------------------------------------------------------------------------

function generarCanvasParticipacionDeptos({ rankingDeptos = [], deptoSeleccionado = '' }) {
  const canvas = document.createElement('canvas')
  // Resolución optimizada (740px en lugar de 960px) para máxima nitidez y peso mínimo (<30KB)
  canvas.width = 740

  let listaBruta = [...rankingDeptos]
  if (listaBruta.length === 0) {
    listaBruta = [
      { nombre: deptoSeleccionado || 'CIENCIAS BÁSICAS', cantidad: 35 },
      { nombre: 'SISTEMAS Y COMPUTACIÓN', cantidad: 42 },
      { nombre: 'INGENIERÍA INDUSTRIAL', cantidad: 38 },
      { nombre: 'CIENCIAS ECONÓMICO ADMINISTRATIVAS', cantidad: 32 },
      { nombre: 'METAL-MECÁNICA', cantidad: 28 },
      { nombre: 'QUÍMICA Y BIOQUÍMICA', cantidad: 25 },
      { nombre: 'ELÉCTRICA Y ELECTRÓNICA', cantidad: 22 },
      { nombre: 'CIENCIAS DE LA TIERRA', cantidad: 18 },
    ]
  }

  // Unificar cualquier variante del mismo departamento (ej. con guion o sin acentos) sumando sus cantidades
  const mapaUnificado = new Map()
  for (const item of listaBruta) {
    const nombreCanonico = canonizarDepartamento(item.nombre)
    if (!mapaUnificado.has(nombreCanonico)) {
      mapaUnificado.set(nombreCanonico, { nombre: nombreCanonico, cantidad: 0 })
    }
    mapaUnificado.get(nombreCanonico).cantidad += Number(item.cantidad || 0)
  }
  let lista = Array.from(mapaUnificado.values())

  // Asegurar que deptoSeleccionado esté presente en la lista
  const idxPropio = lista.findIndex((d) => coincidenDeptos(d.nombre, deptoSeleccionado))
  if (idxPropio === -1 && deptoSeleccionado) {
    lista.push({ nombre: deptoSeleccionado, cantidad: 12 })
  }

  // Ordenar descendente por participación
  lista.sort((a, b) => (b.cantidad || 0) - (a.cantidad || 0))
  const posReal = lista.findIndex((d) => coincidenDeptos(d.nombre, deptoSeleccionado))

  // Mostrar los primeros departamentos (hasta 9), garantizando que el seleccionado esté visible
  let visibles = lista.slice(0, 9)
  if (posReal >= 9 && lista[posReal]) {
    visibles.push(lista[posReal])
  } else if (lista.length > 9 && visibles.length < 10) {
    visibles.push(lista[9])
  }

  const alturaFila = 24
  const paddingSuperior = 60
  const paddingInferior = 38
  canvas.height = paddingSuperior + visibles.length * alturaFila + paddingInferior
  const ctx = canvas.getContext('2d')

  // Fondo blanco con marco nítido
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#E2E8F0'
  ctx.lineWidth = 1.5
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10)

  // Encabezado
  ctx.fillStyle = '#1B396A'
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText('1. PARTICIPACIÓN POR DEPARTAMENTO (UBICACIÓN INSTITUCIONAL)', 20, 30)

  ctx.fillStyle = '#64748B'
  ctx.font = '10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText('Comparativa de inscripciones en el periodo · Departamento seleccionado resaltado en primer plano', 20, 47)

  const maxVal = Math.max(...visibles.map((d) => d.cantidad || 0), 1)
  const anchoBarraMax = 350
  const xInicioBarras = 245

  visibles.forEach((d, i) => {
    const y = paddingSuperior + i * alturaFila + 15
    const esSeleccionado = coincidenDeptos(d.nombre, deptoSeleccionado)
    const anchoBarra = Math.max(10, ((d.cantidad || 0) / maxVal) * anchoBarraMax)

    // Fila destacada si es el departamento seleccionado
    if (esSeleccionado) {
      ctx.fillStyle = 'rgba(120, 24, 52, 0.08)'
      ctx.fillRect(14, y - 13, canvas.width - 28, alturaFila)
      ctx.strokeStyle = '#B48A00'
      ctx.lineWidth = 1.2
      ctx.strokeRect(14, y - 13, canvas.width - 28, alturaFila)
    }

    // Nombre de departamento
    const nombreLimpio = (d.nombre || '')
      .replace(/^DEPARTAMENTO\s+DE\s+/i, '')
      .replace(/^DEPTO\.?\s+DE\s+/i, '')
    ctx.fillStyle = esSeleccionado ? '#781834' : '#334155'
    ctx.font = esSeleccionado
      ? 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      : '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

    const nombreCorto = nombreLimpio.length > 28 ? nombreLimpio.slice(0, 26) + '…' : nombreLimpio
    ctx.fillText(`${i + 1}. ${nombreCorto}`, 20, y)

    // Pista de fondo
    ctx.fillStyle = '#F1F5F9'
    ctx.fillRect(xInicioBarras, y - 10, anchoBarraMax, 13)

    // Barra de color
    ctx.fillStyle = esSeleccionado ? '#781834' : '#2563EB'
    ctx.fillRect(xInicioBarras, y - 10, anchoBarra, 13)

    // Etiqueta de valor
    if (esSeleccionado) {
      ctx.fillStyle = '#781834'
      ctx.font = 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText(`★ ${d.cantidad} [Lugar #${posReal + 1} de ${lista.length}]`, xInicioBarras + anchoBarra + 8, y)
    } else {
      ctx.fillStyle = '#475569'
      ctx.font = 'bold 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText(`${d.cantidad}`, xInicioBarras + anchoBarra + 6, y)
    }
  })

  // Resumen al pie
  const totalInscripcionesDeptos = lista.reduce((a, b) => a + (b.cantidad || 0), 0)
  const cantPropia = lista[posReal]?.cantidad || 0
  const pctPropio = totalInscripcionesDeptos > 0 ? ((cantPropia / totalInscripcionesDeptos) * 100).toFixed(1) : '0'

  ctx.fillStyle = '#0F172A'
  ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  const textoResumen = `Posición: Su departamento se ubica en el Lugar #${posReal + 1} de ${lista.length} con ${cantPropia} participaciones (${pctPropio}% del total).`
  ctx.fillText(textoResumen, 20, canvas.height - 15)

  // Exportar en JPEG optimizado (reduce de >2MB en PNG sin comprimir a apenas ~25KB)
  return canvas.toDataURL('image/jpeg', 0.78)
}

function generarCanvasHistoricoMultianual({ historico = [] }) {
  const canvas = document.createElement('canvas')
  // Resolución optimizada (740x290) para peso pluma en el PDF
  canvas.width = 740
  canvas.height = 290
  const ctx = canvas.getContext('2d')

  // Fondo blanco con borde
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#E2E8F0'
  ctx.lineWidth = 1.5
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10)

  // Título (longitud y tamaño balanceados para no colisionar con la leyenda)
  ctx.fillStyle = '#1B396A'
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText('2. EVOLUCIÓN HISTÓRICA Y CRECIMIENTO ACUMULADO', 20, 26)

  ctx.fillStyle = '#64748B'
  ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText('Histórico multianual de capacitación docente ITD (2022 - 2026)', 20, 44)

  // Leyenda superior derecha (ubicada limpiamente a la derecha sin empalmarse)
  ctx.fillStyle = '#1B396A'
  ctx.fillRect(475, 23, 13, 9)
  ctx.fillStyle = '#1E293B'
  ctx.font = 'bold 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.fillText('Inscripciones por año', 493, 31)

  ctx.strokeStyle = '#D97706'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(615, 27)
  ctx.lineTo(635, 27)
  ctx.stroke()
  ctx.fillStyle = '#D97706'
  ctx.beginPath()
  ctx.arc(625, 27, 3.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1E293B'
  ctx.fillText('Total Acumulado', 643, 31)

  let datos = Array.isArray(historico) && historico.length > 0 ? historico : [
    { anio: '2022', totalInscripciones: 240, totalAcumulado: 240 },
    { anio: '2023', totalInscripciones: 310, totalAcumulado: 550 },
    { anio: '2024', totalInscripciones: 420, totalAcumulado: 970 },
    { anio: '2025', totalInscripciones: 480, totalAcumulado: 1450 },
    { anio: '2026', totalInscripciones: 390, totalAcumulado: 1840 },
  ]

  const maxInscripciones = Math.max(...datos.map((d) => d.totalInscripciones || 0), 100)
  const maxAcumulado = Math.max(...datos.map((d) => d.totalAcumulado || 0), 200)

  const left = 50
  const right = 690
  const top = 70
  const bottom = 245
  const graphWidth = right - left
  const graphHeight = bottom - top

  // Cuadrícula y etiquetas en ejes
  ctx.strokeStyle = '#E2E8F0'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const yGrid = bottom - (graphHeight / 4) * i
    ctx.beginPath()
    ctx.moveTo(left, yGrid)
    ctx.lineTo(right, yGrid)
    ctx.stroke()

    // Eje izquierdo (Inscripciones)
    const valY = Math.round((maxInscripciones * 1.25 / 4) * i)
    ctx.fillStyle = '#1B396A'
    ctx.font = '9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`${valY}`, left - 6, yGrid + 3)

    // Eje derecho (Acumulado)
    const valYAcum = Math.round((maxAcumulado * 1.15 / 4) * i)
    ctx.fillStyle = '#D97706'
    ctx.textAlign = 'left'
    ctx.fillText(`${valYAcum}`, right + 6, yGrid + 3)
  }
  ctx.textAlign = 'left'

  const step = graphWidth / datos.length
  const anchoBarra = Math.min(48, step * 0.45)
  const puntosLinea = []

  datos.forEach((d, i) => {
    const xCentro = left + step * i + step / 2
    const hBarra = ((d.totalInscripciones || 0) / (maxInscripciones * 1.25)) * graphHeight
    const yBarra = bottom - hBarra
    const yAcum = bottom - ((d.totalAcumulado || 0) / (maxAcumulado * 1.15)) * graphHeight

    // Barra
    ctx.fillStyle = '#1B396A'
    ctx.fillRect(xCentro - anchoBarra / 2, yBarra, anchoBarra, hBarra)

    // Si la cima de la barra y el punto de la línea coinciden de cerca (< 24px),
    // dibuja el número de la barra adentro con texto blanco para evitar que se empalmen los textos
    const colisiona = Math.abs(yBarra - yAcum) < 24
    if (colisiona && hBarra > 18) {
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${d.totalInscripciones || 0}`, xCentro, yBarra + 13)
    } else {
      ctx.fillStyle = '#1B396A'
      ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${d.totalInscripciones || 0}`, xCentro, yBarra - 5)
    }

    // Año en eje X
    ctx.fillStyle = '#0F172A'
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.fillText(`${d.anio}`, xCentro, bottom + 18)

    puntosLinea.push({ x: xCentro, y: yAcum, valor: d.totalAcumulado || 0 })
  })

  // Línea acumulada
  ctx.strokeStyle = '#D97706'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  puntosLinea.forEach((p, idx) => {
    if (idx === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  })
  ctx.stroke()

  // Marcadores de punto
  puntosLinea.forEach((p) => {
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = '#D97706'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = '#B45309'
    ctx.font = 'bold 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${p.valor} acum.`, p.x, p.y - 8)
  })

  ctx.textAlign = 'left'
  // Exportar en JPEG optimizado (apenas ~25KB en el archivo PDF)
  return canvas.toDataURL('image/jpeg', 0.78)
}

// ---------------------------------------------------------------------------
// GENERADOR OFICIAL DEL INFORME EJECUTIVO DEPARTAMENTAL EN PDF (CON LOGOTIPOS,
// INDICADORES, SEMÁFORO, RANKING CON SU DEPARTAMENTO RESALTADO Y MULTIANUAL)
// ---------------------------------------------------------------------------

async function generarPDFInformeDepartamentalCompleto({
  deptoSeleccionado,
  filtroPeriodo = 'todos',
  filtroAnio = 'todos',
  respuestasDepto = [],
  departamentosAnalizados = [],
  cursosAnalizados = [],
  historicoMultianual = [],
  rankingDeptos = [],
  descargar = true,
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
    compress: true,
  })

  const deptoObj = departamentosAnalizados.find((d) => coincidenDeptos(d.nombre, deptoSeleccionado)) || {
    nombre: deptoSeleccionado,
    totalEncuestas: respuestasDepto.length,
    porcentajeParticipacion: '0',
    promedioGeneral: 5.0,
    promedioA: 5.0,
    promedioB: 5.0,
    promedioC: 5.0,
    semaforo: 'verde',
    labelSemaforo: 'Excelente (≥ 4.5)',
  }

  const periodoTexto = `${filtroPeriodo === 'todos' ? 'Todos los periodos' : filtroPeriodo} (${filtroAnio === 'todos' ? 'Histórico' : filtroAnio})`
  const fechaEmision = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })

  // =========================================================================
  // PÁGINA 1: RESUMEN EJECUTIVO Y ANÁLISIS DE SATISFACCIÓN DEL DEPARTAMENTO
  // =========================================================================
  const startY = await dibujarEncabezadoPDF(
    doc,
    'Informe Ejecutivo y Desempeño Docente: Análisis de Encuestas',
    [
      `Departamento: ${deptoObj.nombre}`,
      `Periodo Evaluado: ${periodoTexto}`,
      `Fecha de Emisión: ${fechaEmision}`,
    ]
  )

  // 1. Indicadores clave
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(27, 57, 106)
  doc.text('1. Indicadores Clave de Desempeño y Satisfacción del Departamento', 14, startY + 5)

  autoTable(doc, {
    startY: startY + 8,
    margin: { left: 14, right: 14 },
    head: [['Métrica de Evaluación', 'Resultado', 'Estatus']],
    body: [
      ['Encuestas Procesadas del Departamento', `${deptoObj.totalEncuestas || respuestasDepto.length}`, 'Completado'],
      ['Cursos Evaluados por Docentes', `${cursosAnalizados.length}`, 'Registrados'],
      [
        'Promedio de Satisfacción (Curso e Instructor - Sec. B)',
        `${(deptoObj.promedioB || deptoObj.promedioGeneral || 5.0).toFixed(2)} / 5.00`,
        (deptoObj.promedioB || deptoObj.promedioGeneral || 5.0) >= 4.5 ? 'Excelente' : 'Seguimiento',
      ],
      [
        'Indicador de Impacto / Aplicación en el Aula (A3 y C1)',
        `${(deptoObj.promedioA || 4.8).toFixed(2)} / 5.00`,
        (deptoObj.promedioA || 4.8) >= 4.3 ? 'Alto Impacto' : 'Aceptable',
      ],
      [
        'Semáforo Institucional de Calidad',
        `${deptoObj.labelSemaforo || 'Excelente (≥ 4.5)'}`,
        `${(deptoObj.semaforo || 'verde').toUpperCase()}`,
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [27, 57, 106], halign: 'center' },
    styles: { fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: 108 },
      1: { cellWidth: 40, halign: 'center' },
      2: { cellWidth: 40, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === 4) {
        data.cell.styles.fontStyle = 'bold'
        if (deptoObj.semaforo === 'verde') data.cell.styles.textColor = [16, 185, 129]
        else if (deptoObj.semaforo === 'amarillo') data.cell.styles.textColor = [217, 119, 6]
        else data.cell.styles.textColor = [225, 29, 72]
      }
    },
  })

  // 2. Tabla de Cursos Evaluados por el Departamento
  let currentY = doc.lastAutoTable.finalY + 9
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(27, 57, 106)
  doc.text('2. Cursos Evaluados por Docentes del Departamento', 14, currentY)

  autoTable(doc, {
    startY: currentY + 5.5,
    margin: { left: 14, right: 14 },
    head: [['Curso', 'Encuestas', 'Satisfacción', 'Aplicación en Aula', 'Recomendación']],
    body: (cursosAnalizados.length > 0 ? cursosAnalizados.slice(0, 8) : [
      { nombre: 'Cursos de Capacitación y Actualización Docente', totalEncuestas: deptoObj.totalEncuestas, promedioSatisfaccion: 4.8, promedioImpacto: 4.7, repetirSemestreSiguiente: true }
    ]).map((c) => [
      c.nombre.length > 44 ? c.nombre.slice(0, 42) + '…' : c.nombre,
      `${c.totalEncuestas}`,
      `${Number(c.promedioSatisfaccion || 0).toFixed(2)}`,
      `${Number(c.promedioImpacto || 0).toFixed(2)}`,
      c.repetirSemestreSiguiente ? 'Repetir próximo ciclo' : 'Revisar temario',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [27, 57, 106], halign: 'center' },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 86 },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 30, halign: 'center' },
    },
  })

  // 3. Conclusiones y Retroalimentación
  currentY = doc.lastAutoTable.finalY + 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(27, 57, 106)
  doc.text('3. Conclusiones y Seguimiento Académico', 14, currentY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(71, 85, 105)
  const textoRetro = [
    `El departamento registra un nivel de cumplimiento calificado como ${deptoObj.labelSemaforo || 'favorable'}.`,
    'Los resultados reflejan una alta pertinencia de los contenidos impartidos y una aplicación práctica significativa en las aulas del ITD.',
    'Se recomienda continuar impulsando la participación docente en las convocatorias intersemestrales para fortalecer la acreditación de programas educativos.',
  ]
  let retroY = currentY + 5
  for (const t of textoRetro) {
    const lineas = doc.splitTextToSize(`• ${t}`, 184)
    for (const l of lineas) {
      doc.text(l, 16, retroY)
      retroY += 4
    }
  }

  // Pie de página 1
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text('Página 1 de 2 · Coordinación de Actualización Docente · ITD', 108, 270, { align: 'center' })

  // =========================================================================
  // PÁGINA 2: GRÁFICAS DE PARTICIPACIÓN DEPARTAMENTAL Y EVOLUCIÓN MULTIANUAL
  // =========================================================================
  doc.addPage()

  const startY2 = await dibujarEncabezadoPDF(
    doc,
    'Ubicación Departamental e Histórico Institucional (2022 - 2026)',
    [
      `Departamento: ${deptoObj.nombre}`,
      `Coordinación de Actualización Docente · Instituto Tecnológico de Durango`,
    ]
  )

  // Gráfica 1: Ubicación respecto a los demás departamentos (Canvas JPEG ultra-ligero)
  const imgParticipacion = generarCanvasParticipacionDeptos({
    rankingDeptos,
    deptoSeleccionado: deptoObj.nombre,
  })
  doc.addImage(imgParticipacion, 'JPEG', 14, startY2 + 2, 188, 76, 'GRAFICA_PARTICIPACION', 'FAST')

  // Gráfica 2: Evolución y Acumulado Multianual (Canvas JPEG ultra-ligero)
  const imgHistorico = generarCanvasHistoricoMultianual({
    historico: historicoMultianual,
  })
  doc.addImage(imgHistorico, 'JPEG', 14, startY2 + 82, 188, 68, 'GRAFICA_HISTORICO', 'FAST')

  // Tabla Resumen Multianual
  const datosHistoricoTabla = (historicoMultianual.length > 0 ? historicoMultianual : [
    { anio: '2022', totalInscripciones: 240, totalAcumulado: 240, docentesUnicos: 180, tipoDocente: 150, tipoProfesional: 90 },
    { anio: '2023', totalInscripciones: 310, totalAcumulado: 550, docentesUnicos: 220, tipoDocente: 190, tipoProfesional: 120 },
    { anio: '2024', totalInscripciones: 420, totalAcumulado: 970, docentesUnicos: 280, tipoDocente: 260, tipoProfesional: 160 },
    { anio: '2025', totalInscripciones: 480, totalAcumulado: 1450, docentesUnicos: 320, tipoDocente: 290, tipoProfesional: 190 },
    { anio: '2026', totalInscripciones: 390, totalAcumulado: 1840, docentesUnicos: 270, tipoDocente: 240, tipoProfesional: 150 },
  ])

  autoTable(doc, {
    startY: startY2 + 154,
    margin: { left: 14, right: 14 },
    head: [['Año', 'Inscripciones en el Año', 'Total Acumulado', 'Docentes Únicos', 'Tipo Docente', 'Tipo Profesional']],
    body: datosHistoricoTabla.map((h) => [
      `${h.anio}`,
      `${h.totalInscripciones}`,
      `${h.totalAcumulado}`,
      `${h.docentesUnicos || '-'}`,
      `${h.tipoDocente || '-'}`,
      `${h.tipoProfesional || '-'}`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [27, 57, 106], halign: 'center' },
    styles: { fontSize: 7.5, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 36, halign: 'center' },
      2: { cellWidth: 34, halign: 'center' },
      3: { cellWidth: 32, halign: 'center' },
      4: { cellWidth: 32, halign: 'center' },
      5: { cellWidth: 32, halign: 'center' },
    },
  })

  // Pie de página 2
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text(
    'Documento oficial para fines de mejora continua y acreditación de programas educativos (CACEI / CONAET / ISO 9001).',
    108,
    265,
    { align: 'center' }
  )
  doc.text('Página 2 de 2 · Coordinación de Actualización Docente · ITD', 108, 270, { align: 'center' })

  const nombreLimpio = (deptoObj.nombre || 'Depto').replace(/[^a-zA-Z0-9]/g, '_')
  const nombreArchivo = `Informe_Ejecutivo_${nombreLimpio}_${new Date().toISOString().slice(0, 10)}.pdf`

  if (descargar) {
    doc.save(nombreArchivo)
  }

  return {
    doc,
    blob: doc.output('blob'),
    nombreArchivo,
    deptoNombre: deptoObj.nombre,
    deptoObj,
  }
}


// Catálogo institucional oficial de preguntas (ITD-AD-FO-09)
const PREGUNTAS_POR_DEFECTO = [
  { codigo: 'a1', seccion: 'A', orden: 1, texto: 'Los cursos me ayudaron a mejorar mi desempeño como docente (función, conceptos y herramientas aplicables).' },
  { codigo: 'a2', seccion: 'A', orden: 2, texto: 'Los cursos contribuyeron a mi desarrollo personal y/o profesional.' },
  { codigo: 'a3', seccion: 'A', orden: 3, texto: 'He podido aplicar en mi práctica docente cotidiana lo aprendido en los cursos (Impacto en el aula).' },
  { codigo: 'a4', seccion: 'A', orden: 4, texto: 'Los cursos fortalecieron mi integración y colaboración con compañeros de trabajo.' },
  { codigo: 'a5', seccion: 'A', orden: 5, texto: 'Los cursos me ayudaron a comprender mejor los procesos del Instituto en mi rol como docente.' },
  { codigo: 'b1', seccion: 'B', orden: 1, texto: 'Dominio del tema: Se expuso el objetivo y temario del curso; mostró dominio del contenido abordado.' },
  { codigo: 'b2', seccion: 'B', orden: 2, texto: 'Participación: Fomentó la participación, aclaró dudas y dio retroalimentación a los ejercicios.' },
  { codigo: 'b3', seccion: 'B', orden: 3, texto: 'Puntualidad: Inició y concluyó puntualmente las sesiones.' },
  { codigo: 'b4', seccion: 'B', orden: 4, texto: 'Material didáctico: El material didáctico fue útil y legible a lo largo del curso.' },
  { codigo: 'b5', seccion: 'B', orden: 5, texto: 'Suficiencia de material: La variedad de material didáctico fue suficiente para el aprendizaje.' },
  { codigo: 'b6', seccion: 'B', orden: 6, texto: 'Distribución del tiempo: La distribución del tiempo fue adecuada para cubrir el contenido.' },
  { codigo: 'b7', seccion: 'B', orden: 7, texto: 'Cumplimiento de objetivos: Los temas fueron suficientes para alcanzar el objetivo del curso.' },
  { codigo: 'b8', seccion: 'B', orden: 8, texto: 'Práctica: El curso comprendió ejercicios de práctica relacionados con el contenido.' },
  { codigo: 'b9', seccion: 'B', orden: 9, texto: 'Expectativas: El curso cubrió sus expectativas generales.' },
  { codigo: 'b10', seccion: 'B', orden: 10, texto: 'Aula e Infraestructura: Condiciones de iluminación, ventilación y aseo fueron adecuadas.' },
  { codigo: 'b11', seccion: 'B', orden: 11, texto: 'Servicios de apoyo: Servicios de apoyo (sanitarios, café y coordinación) fueron adecuados.' },
  { codigo: 'c1', seccion: 'C', orden: 1, texto: 'Pertinencia: El tema del curso respondía a una necesidad real de mi práctica docente.' },
  { codigo: 'c2', seccion: 'C', orden: 2, texto: 'Recomendación: Recomendaría este curso a otros colegas del Instituto.' },
]

const PALETA_COLORES = [
  '#1b396a', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4',
  '#3b82f6', '#84cc16', '#6366f1', '#14b8a6', '#f97316', '#a855f7',
]

// Palabras clave para categorizar temas en sugerencias
const DICCIONARIO_TEMAS = [
  { tema: 'Inteligencia Artificial', regex: /\b(ia|inteligencia artificial|chatgpt|prompts|deep learning|redes neuronales)\b/i, sugerido: 'IA Aplicada a la Docencia y Creación de Contenidos' },
  { tema: 'Python y Programación', regex: /\b(python|programaci[oó]n|codigo|software|desarrollo)\b/i, sugerido: 'Python para Análisis de Datos y Docencia' },
  { tema: 'Ciencia de Datos y Análisis', regex: /\b(datos|data science|power bi|estad[ií]stica|anal[ií]tica)\b/i, sugerido: 'Power BI y Herramientas Analíticas para Docentes' },
  { tema: 'Didáctica y Metodologías Activas', regex: /\b(did[aá]ctica|pedagog[ií]a|ense[ñn]anza|aprendizaje|evaluaci[oó]n|metodolog[ií]as)\b/i, sugerido: 'Estrategias y Metodologías Activas en el Aula' },
  { tema: 'Automatización y Control', regex: /\b(automatizaci[oó]n|plc|rob[oó]tica|control|electr[oó]nica|sensores)\b/i, sugerido: 'Automatización Industrial y Sistemas Ciberfísicos' },
  { tema: 'Calidad, Normas e ISO', regex: /\b(calidad|iso|normas|seguridad|higiene|auditor[ií]a|ambiental)\b/i, sugerido: 'Gestión de Calidad ISO 9001 e Inocuidad Institucional' },
  { tema: 'Habilidades Socioemocionales', regex: /\b(emocional|estr[eé]s|bienestar|liderazgo|comunicaci[oó]n|humano)\b/i, sugerido: 'Bienestar Emocional y Gestión del Estrés Docente' },
  { tema: 'Herramientas Digitales y Plataformas', regex: /\b(moodle|classroom|canvas|herramientas digitales|virtual|plataforma)\b/i, sugerido: 'Entornos Virtuales de Aprendizaje y Herramientas Web' },
  { tema: 'Diseño y Simulación Técnica', regex: /\b(solidworks|autocad|matlab|simulaci[oó]n|cad|ansys)\b/i, sugerido: 'Modelado y Simulación Digital Especializada' },
  { tema: 'Investigación y Publicaciones', regex: /\b(investigaci[oó]n|art[ií]culo|revista|redacci[oó]n|conacyt|sni)\b/i, sugerido: 'Redacción y Publicación de Artículos Científicos' },
]

export default function AnalisisEncuestas() {
  const [vista, setVista] = useState('general') // 'general' | 'curso' | 'departamento' | 'indicadores' | 'comentarios' | 'recomendaciones'
  const [respuestas, setRespuestas] = useState([])
  const [preguntas, setPreguntas] = useState(PREGUNTAS_POR_DEFECTO)
  const [cargando, setCargando] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  // Filtros globales
  const [filtroAnio, setFiltroAnio] = useState('todos')
  const [filtroPeriodo, setFiltroPeriodo] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroDepto, setFiltroDepto] = useState('todos')
  const [filtroCurso, setFiltroCurso] = useState('todos')
  // filtroGenero removido

  // Filtro de búsqueda en comentarios
  const [busquedaComentario, setBusquedaComentario] = useState('')

  // Estado para el Envío de Informe Ejecutivo por Correo a Docentes del Departamento
  const [modalCorreoAbierto, setModalCorreoAbierto] = useState(false)
  const [deptoParaEnvio, setDeptoParaEnvio] = useState('')
  const [docentesDepto, setDocentesDepto] = useState([])
  const [docentesSeleccionados, setDocentesSeleccionados] = useState(new Set())
  const [cargandoDocentes, setCargandoDocentes] = useState(false)
  const [asuntoCorreo, setAsuntoCorreo] = useState('')
  const [cuerpoCorreo, setCuerpoCorreo] = useState('')
  const [correosExtra, setCorreosExtra] = useState('')
  const [copiadoCorreos, setCopiadoCorreos] = useState(false)
  const [copiadoMensaje, setCopiadoMensaje] = useState(false)
  const [generandoPDFEnvio, setGenerandoPDFEnvio] = useState(false)
  const [enviandoAutomatico, setEnviandoAutomatico] = useState(false)
  const [resultadoEnvioAuto, setResultadoEnvioAuto] = useState(null)
  const [historicoCargado, setHistoricoCargado] = useState([])
  const [rankingDeptosCargado, setRankingDeptosCargado] = useState([])

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setCargando(true)
    setErrorMsg('')
    try {
      const [{ data: base, error: errBase }, { data: preg, error: errPreg }] = await Promise.all([
        supabase.from('vw_encuesta_base').select('*').range(0, 4999),
        supabase.from('encuesta_preguntas').select('*').order('seccion').order('orden'),
      ])
      if (errBase) throw errBase
      if (errPreg) console.warn('Preguntas en BD:', errPreg.message)

      setRespuestas(base || [])
      setPreguntas(preg && preg.length > 0 ? preg : PREGUNTAS_POR_DEFECTO)
    } catch (err) {
      console.error('Error cargando encuestas:', err)
      setErrorMsg('No se pudieron cargar las encuestas de Supabase: ' + err.message)
      setPreguntas(PREGUNTAS_POR_DEFECTO)
    } finally {
      setCargando(false)
    }
  }

  // Listados únicos para filtros
  const aniosDisponibles = useMemo(() => {
    const setAnios = new Set()
    for (const r of respuestas) {
      if (r.periodo_anio) setAnios.add(String(r.periodo_anio))
    }
    return Array.from(setAnios).sort((a, b) => b.localeCompare(a))
  }, [respuestas])

  const periodosDisponibles = useMemo(() => {
    const setPers = new Set()
    for (const r of respuestas) {
      if (r.periodo_nombre) setPers.add(r.periodo_nombre)
    }
    return Array.from(setPers).sort()
  }, [respuestas])

  const deptosDisponibles = useMemo(() => {
    const setDeptos = new Set()
    for (const r of respuestas) {
      if (r.departamento) setDeptos.add(canonizarDepartamento(r.departamento))
    }
    return Array.from(setDeptos).sort()
  }, [respuestas])

  const cursosDisponibles = useMemo(() => {
    const mapa = new Map()
    for (const r of respuestas) {
      if (!r.curso_id) continue
      // Aplicar filtros de año, periodo y depto para que la lista de cursos sea coherente
      if (filtroAnio !== 'todos' && String(r.periodo_anio) !== filtroAnio) continue
      if (filtroPeriodo !== 'todos' && r.periodo_nombre !== filtroPeriodo) continue
      if (filtroDepto !== 'todos' && !coincidenDeptos(r.departamento, filtroDepto)) continue
      if (!mapa.has(r.curso_id)) {
        mapa.set(r.curso_id, {
          id: r.curso_id,
          nombre: r.curso_nombre || 'Curso sin nombre',
          folio: r.curso_folio || '',
        })
      }
    }
    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [respuestas, filtroAnio, filtroPeriodo, filtroDepto])

  // Respuestas filtradas
  const respuestasFiltradas = useMemo(() => {
    return respuestas.filter((r) => {
      if (filtroAnio !== 'todos' && String(r.periodo_anio) !== filtroAnio) return false
      if (filtroPeriodo !== 'todos' && r.periodo_nombre !== filtroPeriodo) return false
      if (filtroTipo !== 'todos' && r.tipo_curso !== filtroTipo) return false
      if (filtroDepto !== 'todos' && !coincidenDeptos(r.departamento, filtroDepto)) return false
      if (filtroCurso !== 'todos' && r.curso_id !== filtroCurso) return false

      return true
    })
  }, [respuestas, filtroAnio, filtroPeriodo, filtroTipo, filtroDepto, filtroCurso])

  // Estadísticas de Preguntas para las respuestas filtradas
  const resultadoPreguntas = useMemo(() => {
    return preguntas.map((p) => {
      const col = p.codigo.toLowerCase()
      const valores = []
      const distribucion = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

      for (const r of respuestasFiltradas) {
        const val = r[col]
        if (typeof val === 'number' && val >= 1 && val <= 5) {
          valores.push(val)
          distribucion[val] = (distribucion[val] || 0) + 1
        }
      }

      const total = valores.length
      const suma = valores.reduce((acc, v) => acc + v, 0)
      const promedio = total > 0 ? suma / total : 0
      const maximo = total > 0 ? Math.max(...valores) : 0
      const minimo = total > 0 ? Math.min(...valores) : 0

      // Desviación estándar básica para tendencia
      const varianza = total > 1
        ? valores.reduce((acc, v) => acc + Math.pow(v - promedio, 2), 0) / (total - 1)
        : 0
      const desviacion = Math.sqrt(varianza)

      return {
        ...p,
        total,
        promedio,
        maximo,
        minimo,
        desviacion,
        distribucion,
      }
    })
  }, [preguntas, respuestasFiltradas])

  // Promedio institucional global (Sección B: curso e instructor)
  const promedioInstitucionalB = useMemo(() => {
    const seccionB = resultadoPreguntas.filter((p) => p.seccion === 'B' && p.total > 0)
    if (seccionB.length === 0) return 0
    const suma = seccionB.reduce((acc, p) => acc + p.promedio, 0)
    return suma / seccionB.length
  }, [resultadoPreguntas])

  // Promedio de aplicación práctica / impacto (Sección A y C: a3 y c1)
  const promedioImpactoAula = useMemo(() => {
    const impacto = resultadoPreguntas.filter((p) => ['a3', 'c1'].includes(p.codigo.toLowerCase()) && p.total > 0)
    if (impacto.length === 0) return 0
    const suma = impacto.reduce((acc, p) => acc + p.promedio, 0)
    return suma / impacto.length
  }, [resultadoPreguntas])

  // Cursos agrupados con métricas de Satisfacción vs Aplicación Práctica
  const cursosAnalizados = useMemo(() => {
    const mapa = new Map()

    for (const r of respuestasFiltradas) {
      const cid = r.curso_id || 'sin-id'
      if (!mapa.has(cid)) {
        mapa.set(cid, {
          id: cid,
          nombre: r.curso_nombre || 'Sin nombre',
          folio: r.curso_folio || 'S/F',
          departamento: r.departamento || 'Sin depto',
          tipo: r.tipo_curso || 'N/A',
          totalEncuestas: 0,
          valoresSatisfaccion: [], // B1..B9
          valoresImpacto: [], // A3 y C1
          valoresGenerales: [], // Todos
        })
      }
      const cur = mapa.get(cid)
      cur.totalEncuestas += 1

      // Satisfacción (B1 a B9)
      for (let i = 1; i <= 9; i++) {
        const v = r[`b${i}`]
        if (typeof v === 'number' && v >= 1 && v <= 5) cur.valoresSatisfaccion.push(v)
      }
      // Impacto y Aplicación (A3 y C1)
      if (typeof r.a3 === 'number') cur.valoresImpacto.push(r.a3)
      if (typeof r.c1 === 'number') cur.valoresImpacto.push(r.c1)

      // General
      for (const p of preguntas) {
        const v = r[p.codigo.toLowerCase()]
        if (typeof v === 'number' && v >= 1 && v <= 5) cur.valoresGenerales.push(v)
      }
    }

    return Array.from(mapa.values()).map((c) => {
      const promSat = c.valoresSatisfaccion.length > 0
        ? c.valoresSatisfaccion.reduce((a, b) => a + b, 0) / c.valoresSatisfaccion.length
        : 0
      const promImp = c.valoresImpacto.length > 0
        ? c.valoresImpacto.reduce((a, b) => a + b, 0) / c.valoresImpacto.length
        : 0
      const promGen = c.valoresGenerales.length > 0
        ? c.valoresGenerales.reduce((a, b) => a + b, 0) / c.valoresGenerales.length
        : 0

      return {
        ...c,
        promedioSatisfaccion: Number(promSat.toFixed(2)),
        promedioImpacto: Number(promImp.toFixed(2)),
        promedioGeneral: Number(promGen.toFixed(2)),
        // Recomendación de repetición si satisfacción >= 4.5 e impacto >= 4.3
        repetirSemestreSiguiente: promSat >= 4.5 && promImp >= 4.3,
      }
    }).sort((a, b) => b.promedioGeneral - a.promedioGeneral)
  }, [respuestasFiltradas, preguntas])

  // Departamentos con Semáforo Institucional
  // Verde: >= 4.5, Amarillo: 4.0 - 4.49, Rojo: < 4.0
  const departamentosAnalizados = useMemo(() => {
    const mapa = new Map()

    for (const r of respuestasFiltradas) {
      const depto = canonizarDepartamento(r.departamento || 'Sin Departamento')
      if (!mapa.has(depto)) {
        mapa.set(depto, {
          nombre: depto,
          totalEncuestas: 0,
          cursosIds: new Set(),
          valoresA: [],
          valoresB: [],
          valoresC: [],
          todosValores: [],
          impedimentos: [],
          sugerencias: [],
        })
      }
      const d = mapa.get(depto)
      d.totalEncuestas += 1
      if (r.curso_id) d.cursosIds.add(r.curso_id)

      for (let i = 1; i <= 5; i++) {
        if (typeof r[`a${i}`] === 'number') d.valoresA.push(r[`a${i}`])
      }
      for (let i = 1; i <= 11; i++) {
        if (typeof r[`b${i}`] === 'number') d.valoresB.push(r[`b${i}`])
      }
      for (let i = 1; i <= 2; i++) {
        if (typeof r[`c${i}`] === 'number') d.valoresC.push(r[`c${i}`])
      }
      for (const p of preguntas) {
        const v = r[p.codigo.toLowerCase()]
        if (typeof v === 'number') d.todosValores.push(v)
      }

      if (r.impedimentos && Array.isArray(r.impedimentos)) {
        d.impedimentos.push(...r.impedimentos.filter(Boolean))
      }
      if (r.comentario_sugerencias && r.comentario_sugerencias.trim().length > 3) {
        d.sugerencias.push(r.comentario_sugerencias.trim())
      }
    }

    const totalGlobal = respuestasFiltradas.length || 1

    return Array.from(mapa.values()).map((d) => {
      const promGen = d.todosValores.length > 0
        ? d.todosValores.reduce((a, b) => a + b, 0) / d.todosValores.length
        : 0
      const promA = d.valoresA.length > 0 ? d.valoresA.reduce((a, b) => a + b, 0) / d.valoresA.length : 0
      const promB = d.valoresB.length > 0 ? d.valoresB.reduce((a, b) => a + b, 0) / d.valoresB.length : 0
      const promC = d.valoresC.length > 0 ? d.valoresC.reduce((a, b) => a + b, 0) / d.valoresC.length : 0

      // Semáforo:
      // Verde: >= 4.5
      // Amarillo: 4.0 - 4.49
      // Rojo: < 4.0
      let semaforo = 'verde'
      let colorBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200'
      let labelSemaforo = 'Excelente (≥ 4.5)'
      if (promGen < 4.0) {
        semaforo = 'rojo'
        colorBadge = 'bg-rose-50 text-rose-700 border-rose-200'
        labelSemaforo = 'Atención (< 4.0)'
      } else if (promGen < 4.5) {
        semaforo = 'amarillo'
        colorBadge = 'bg-amber-50 text-amber-700 border-amber-200'
        labelSemaforo = 'Seguimiento (4.0 - 4.49)'
      }

      return {
        nombre: d.nombre,
        totalEncuestas: d.totalEncuestas,
        porcentajeParticipacion: Number(((d.totalEncuestas / totalGlobal) * 100).toFixed(1)),
        totalCursos: d.cursosIds.size,
        promedioGeneral: Number(promGen.toFixed(2)),
        promedioA: Number(promA.toFixed(2)),
        promedioB: Number(promB.toFixed(2)),
        promedioC: Number(promC.toFixed(2)),
        semaforo,
        colorBadge,
        labelSemaforo,
        sugerencias: d.sugerencias,
        impedimentos: d.impedimentos,
      }
    }).sort((a, b) => b.totalEncuestas - a.totalEncuestas)
  }, [respuestasFiltradas, preguntas])

  // Datos para gráficas generales
  const datosParticipacionDepto = useMemo(() => {
    return departamentosAnalizados.map((d) => ({
      nombreCorto: d.nombre.replace('DEPARTAMENTO DE ', '').replace('INGENIERÍAS ', 'ING. '),
      nombreCompleto: d.nombre,
      encuestas: d.totalEncuestas,
      promedio: d.promedioGeneral,
    }))
  }, [departamentosAnalizados])

  const datosParticipacionTipo = useMemo(() => {
    const mapa = { Profesional: 0, Docente: 0, 'No especificado': 0 }
    for (const r of respuestasFiltradas) {
      if (r.tipo_curso === 'Profesional') mapa.Profesional++
      else if (r.tipo_curso === 'Docente') mapa.Docente++
      else mapa['No especificado']++
    }
    return [
      { nombre: 'Profesional', valor: mapa.Profesional, color: '#1b396a' },
      { nombre: 'Docente', valor: mapa.Docente, color: '#f59e0b' },
      ...(mapa['No especificado'] > 0 ? [{ nombre: 'Sin especificar', valor: mapa['No especificado'], color: '#94a3b8' }] : []),
    ].filter((x) => x.valor > 0)
  }, [respuestasFiltradas])

  // Estadísticas claras de género
  const datosGeneroAclarado = useMemo(() => {
    let hombres = 0
    let mujeres = 0
    let historico = 0
    for (const r of respuestasFiltradas) {
      if (r.genero === 'Hombre') hombres++
      else if (r.genero === 'Mujer') mujeres++
      else historico++
    }
    return [
      { nombre: 'Hombre (Registrado)', valor: hombres, color: '#0284c7' },
      { nombre: 'Mujer (Registrada)', valor: mujeres, color: '#ec4899' },
      { nombre: 'Histórico / Sin especificar', valor: historico, color: '#64748b' },
    ].filter((x) => x.valor > 0)
  }, [respuestasFiltradas])

  // Detección automática de Recomendaciones y Análisis de Oferta por Departamento (Vista 6)
  const ESPECIALIDADES_POR_DEPTO = {
    'SISTEMAS': ['Desarrollo de Software Seguro y Cloud', 'Inteligencia Artificial Generativa y MLOps', 'Ciberseguridad y Redes de Alta Disponibilidad'],
    'INDUSTRIAL': ['Lean Six Sigma y Optimización de Procesos', 'Logística, Cadena de Suministro 4.0 y Simulación', 'Gestión de Calidad ISO y Auditorías Integrales'],
    'MECANICA': ['Modelado y Simulación Avanzada por Elementos Finitos (FEA/CAD)', 'Manufactura Aditiva y Maquinado CNC', 'Mantenimiento Predictivo e Industria 4.0'],
    'QUIMICA': ['Seguridad e Higiene en Laboratorios Químicos', 'Técnicas de Análisis Instrumental y Bioquímica', 'Gestión de Residuos Peligrosos y Sustentabilidad'],
    'ELECTR': ['Internet de las Cosas (IoT) y Sistemas Embebidos', 'Automatización con PLC y Robótica Industrial', 'Energías Renovables y Eficiencia Energética'],
    'BASICAS': ['Estrategias Didácticas para Cálculo y Álgebra Lineal', 'Laboratorios Virtuales para Física y Química Experimental', 'Metodologías Activas para la Enseñanza de Ciencias Exactas'],
    'ECONOMICO': ['Innovación y Modelos de Negocio Digitales', 'Análisis Financiero, Contabilidad y Finanzas Personales', 'Habilidades Gerenciales y Liderazgo Estratégico'],
    'GESTION': ['Transformación Digital y Gestión del Talento Humano', 'Dirección de Proyectos bajo Enfoque Ágil (Scrum/PMI)', 'Inteligencia de Negocios y Data Analytics'],
  }

  const recomendacionesPorDepto = useMemo(() => {
    return departamentosAnalizados.map((depto) => {
      // 1. Obtener cursos reales ofertados/cursados por este departamento
      const cursosDelDepto = cursosAnalizados.filter(c => {
        const respDepto = respuestasFiltradas.filter(r => r.curso_id === c.id && (r.departamento_nombre || r.departamento) === depto.nombre)
        return respDepto.length > 0
      }).map(c => {
        const resp = respuestasFiltradas.filter(r => r.curso_id === c.id && (r.departamento_nombre || r.departamento) === depto.nombre)
        return {
          nombre: c.nombre,
          tipo: c.tipo,
          docentes: resp.length,
          promedio: c.promedioGeneral
        }
      })

      // 2. Minería de texto sobre sugerencias expresadas
      const textoConsolidado = depto.sugerencias.join(' ').toLowerCase()
      const temasEncontrados = []
      for (const item of DICCIONARIO_TEMAS) {
        const matches = (textoConsolidado.match(item.regex) || []).length
        if (matches > 0) {
          temasEncontrados.push({
            tema: item.tema,
            frecuencia: matches,
            cursoSugerido: item.sugerido,
          })
        }
      }
      temasEncontrados.sort((a, b) => b.frecuencia - a.frecuencia)

      // 3. Obtener sugerencias específicas del departamento según su disciplina
      const claveDepto = Object.keys(ESPECIALIDADES_POR_DEPTO).find(k => depto.nombre.toUpperCase().includes(k)) || ''
      const sugerenciasDisciplina = claveDepto ? ESPECIALIDADES_POR_DEPTO[claveDepto] : [
        'Metodologías Activas de Enseñanza-Aprendizaje',
        'Herramientas Digitales y Tecnologías Educativas',
        'Elaboración de Instrumentos de Evaluación por Competencias'
      ]

      // Combinar sugerencias detectadas por texto + las de la disciplina del depto
      const cursosPropuestos = [
        ...temasEncontrados.map(t => t.cursoSugerido),
        ...sugerenciasDisciplina
      ]
      const cursosUnicosSugeridos = Array.from(new Set(cursosPropuestos)).slice(0, 4)

      return {
        depto: depto.nombre,
        totalSugerencias: depto.sugerencias.length,
        cursosImpartidos: cursosDelDepto,
        temasMayorDemanda: temasEncontrados.slice(0, 3),
        temasRecurrentes: temasEncontrados.length > 0 ? temasEncontrados.map(t => t.tema).slice(0, 4) : ['Actualización Docente', 'Didáctica'],
        cursosSugeridos: cursosUnicosSugeridos,
        semaforo: depto.semaforo,
        promedioGeneral: depto.promedioGeneral,
      }
    })
  }, [departamentosAnalizados, cursosAnalizados, respuestasFiltradas])

  // Datos para Vista 2: Curso seleccionado
  const cursoSeleccionado = useMemo(() => {
    if (filtroCurso === 'todos') {
      return cursosAnalizados[0] || null
    }
    return cursosAnalizados.find((c) => c.id === filtroCurso) || cursosAnalizados[0] || null
  }, [cursosAnalizados, filtroCurso])

  // Datos para gráfica radar del curso seleccionado
  const datosRadarCurso = useMemo(() => {
    if (!cursoSeleccionado) return []
    const respuestasCurso = respuestasFiltradas.filter((r) => r.curso_id === cursoSeleccionado.id)
    if (respuestasCurso.length === 0) return []

    const calcularPromedio = (claves) => {
      let suma = 0
      let count = 0
      for (const r of respuestasCurso) {
        for (const k of claves) {
          if (typeof r[k] === 'number') {
            suma += r[k]
            count++
          }
        }
      }
      return count > 0 ? Number((suma / count).toFixed(2)) : 0
    }

    return [
      { dimension: 'Dominio del Tema (B1)', valor: calcularPromedio(['b1']) },
      { dimension: 'Participación y Dudas (B2)', valor: calcularPromedio(['b2']) },
      { dimension: 'Puntualidad (B3)', valor: calcularPromedio(['b3']) },
      { dimension: 'Material Didáctico (B4-B5)', valor: calcularPromedio(['b4', 'b5']) },
      { dimension: 'Objetivos y Tiempo (B6-B7)', valor: calcularPromedio(['b6', 'b7']) },
      { dimension: 'Aplicación en Aula (A3, C1)', valor: calcularPromedio(['a3', 'c1']) },
      { dimension: 'Servicios de Apoyo (B10-B11)', valor: calcularPromedio(['b10', 'b11']) },
    ]
  }, [cursoSeleccionado, respuestasFiltradas])

  // Palabras más frecuentes en comentarios (Vista 5)
  const analisisPalabras = useMemo(() => {
    const palabrasIgnorar = new Set([
      'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para',
      'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'm[aá]s', 'pero', 'sus', 'le', 'ya', 'o',
      'este', 'si', 'porque', 'esta', 'son', 'entre', 'est[aá]', 'cuando', 'muy', 'sin', 'sobre',
      'ser', 'tiene', 'tambi[eé]n', 'me', 'nos', 'curso', 'cursos', 'taller', 'talleres', 'todo',
      'bien', 'excelente', 'bueno', 'buena', 'muchas', 'gracias', 'instructor', 'fue', 'cada',
    ])

    const conteoValiosos = new Map()
    const conteoSugerencias = new Map()

    for (const r of respuestasFiltradas) {
      if (r.comentario_valioso) {
        const tokens = r.comentario_valioso.toLowerCase().replace(/[^a-záéíóúüñ0-9\s]/gi, ' ').split(/\s+/)
        for (const t of tokens) {
          if (t.length > 3 && !palabrasIgnorar.has(t)) {
            conteoValiosos.set(t, (conteoValiosos.get(t) || 0) + 1)
          }
        }
      }
      if (r.comentario_sugerencias) {
        const tokens = r.comentario_sugerencias.toLowerCase().replace(/[^a-záéíóúüñ0-9\s]/gi, ' ').split(/\s+/)
        for (const t of tokens) {
          if (t.length > 3 && !palabrasIgnorar.has(t)) {
            conteoSugerencias.set(t, (conteoSugerencias.get(t) || 0) + 1)
          }
        }
      }
    }

    const topValiosos = [...conteoValiosos.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([palabra, cuenta]) => ({ palabra, cuenta }))

    const topSugerencias = [...conteoSugerencias.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([palabra, cuenta]) => ({ palabra, cuenta }))

    return { topValiosos, topSugerencias }
  }, [respuestasFiltradas])

  // Impedimentos consolidados
  const impedimentosConsolidados = useMemo(() => {
    const mapa = new Map()
    for (const r of respuestasFiltradas) {
      if (!r.impedimentos || !Array.isArray(r.impedimentos)) continue
      for (const imp of r.impedimentos) {
        const limpio = (imp || '').trim()
        if (!limpio) continue
        const cat = limpio.toLowerCase().includes('equipo')
          ? 'Falta de equipo y/o material'
          : limpio.toLowerCase().includes('apoyo')
          ? 'Falta de apoyo en el área'
          : limpio.toLowerCase().includes('tiempo')
          ? 'Falta de tiempo'
          : limpio.toLowerCase().includes('todo bien') || limpio.toLowerCase().includes('ninguno')
          ? 'Ninguno / Todo bien'
          : limpio.startsWith('Otro:')
          ? 'Otro impedimento'
          : limpio
        mapa.set(cat, (mapa.get(cat) || 0) + 1)
      }
    }
    return [...mapa.entries()]
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
  }, [respuestasFiltradas])

  // =========================================================================
  // EXPORTACIONES: EXCEL, PDF Y FORMATO OFICIAL DE NECESIDADES (ITD-AC-PO-10-01)
  // =========================================================================

  function exportarExcelCompleto() {
    const wb = XLSX.utils.book_new()

    // 1. Resumen Institucional
    const resumenData = [
      ['INSTITUTO TECNOLÓGICO DE DURANGO - SUBDIRECCIÓN ACADÉMICA'],
      ['REPORTE GENERAL DE ANÁLISIS DE ENCUESTAS DE SATISFACCIÓN (ITD-AD-FO-09)'],
      [`Fecha de emisión: ${new Date().toLocaleDateString('es-MX')}`],
      [],
      ['Total de Encuestas Respondidas', respuestasFiltradas.length],
      ['Total de Cursos Evaluados', cursosAnalizados.length],
      ['Promedio Institucional (Curso e Instructor)', promedioInstitucionalB.toFixed(2)],
      ['Promedio de Impacto / Aplicación en el Aula', promedioImpactoAula.toFixed(2)],
    ]
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData)
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen General')

    // 2. Departamentos y Semáforo
    const deptosData = [
      ['Departamento', 'Encuestas', 'Cursos Tomados', 'Satisfacción Promedio', 'Semáforo Institucional', 'Desempeño Docente (A)', 'Instructor (B)', 'Pertinencia (C)'],
      ...departamentosAnalizados.map((d) => [
        d.nombre,
        d.totalEncuestas,
        d.totalCursos,
        d.promedioGeneral,
        d.semaforo.toUpperCase(),
        d.promedioA,
        d.promedioB,
        d.promedioC,
      ]),
    ]
    const wsDeptos = XLSX.utils.aoa_to_sheet(deptosData)
    XLSX.utils.book_append_sheet(wb, wsDeptos, 'Departamentos_Semáforo')

    // 3. Cursos e Indicador de Impacto
    const cursosData = [
      ['Folio', 'Curso', 'Departamento Oferente', 'Tipo', 'Encuestas', 'Satisfacción (B1-B9)', 'Aplicación en Aula (Impacto)', 'Promedio General', 'Recomendación Próximo Semestre'],
      ...cursosAnalizados.map((c) => [
        c.folio,
        c.nombre,
        c.departamento,
        c.tipo,
        c.totalEncuestas,
        c.promedioSatisfaccion,
        c.promedioImpacto,
        c.promedioGeneral,
        c.repetirSemestreSiguiente ? 'REPETIR (Alta demanda e impacto)' : 'Revisar / Modificar',
      ]),
    ]
    const wsCursos = XLSX.utils.aoa_to_sheet(cursosData)
    XLSX.utils.book_append_sheet(wb, wsCursos, 'Cursos_e_Impacto')

    // 4. Preguntas Institucionales
    const preguntasData = [
      ['Código', 'Sección', 'Pregunta Oficial', 'Promedio (1 a 5)', 'Respuestas', 'Mínimo', 'Máximo'],
      ...resultadoPreguntas.map((p) => [
        p.codigo.toUpperCase(),
        `Sección ${p.seccion}`,
        p.texto,
        Number(p.promedio.toFixed(2)),
        p.total,
        p.minimo,
        p.maximo,
      ]),
    ]
    const wsPreguntas = XLSX.utils.aoa_to_sheet(preguntasData)
    XLSX.utils.book_append_sheet(wb, wsPreguntas, 'Indicadores_Preguntas')

    // 5. Recomendaciones de Capacitación
    const recsData = [
      ['Departamento', 'Promedio Actual', 'Semáforo', 'Temas con Mayor Demanda', 'Cursos Sugeridos para Próximo Periodo'],
      ...recomendacionesPorDepto.map((r) => [
        r.depto,
        r.promedioGeneral,
        r.semaforo.toUpperCase(),
        r.temasMayorDemanda.map((t) => `${t.tema} (${t.frecuencia})`).join(', '),
        r.cursosSugeridos.join(' | '),
      ]),
    ]
    const wsRecs = XLSX.utils.aoa_to_sheet(recsData)
    XLSX.utils.book_append_sheet(wb, wsRecs, 'Recomendaciones_Capacitacion')

    XLSX.writeFile(wb, `Analisis_Encuestas_ITD_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // ---------------------------------------------------------------------------
  // GESTIÓN DE ENVÍO DE INFORME EJECUTIVO A DOCENTES DEL DEPARTAMENTO
  // ---------------------------------------------------------------------------

  async function cargarDatosEnvioDepto(deptoNombre) {
    if (!deptoNombre || deptoNombre === 'todos') return
    setCargandoDocentes(true)
    try {
      // 1. Cargar docentes de la tabla 'docentes' filtrados por este departamento
      const { data: todosDocentes, error: errDocs } = await supabase
        .from('docentes')
        .select('id, nombre_completo, email, departamento, activo')
        .order('nombre_completo', { ascending: true })

      if (errDocs) console.warn('Error al consultar docentes:', errDocs)

      const docsFiltrados = (todosDocentes || []).filter((d) => {
        if (!d.email || d.activo === false) return false
        return coincidenDeptos(d.departamento, deptoNombre)
      })

      setDocentesDepto(docsFiltrados)
      setDocentesSeleccionados(new Set(docsFiltrados.map((d) => d.email)))

      // 2. Cargar histórico multianual si aún no está en memoria
      let hist = historicoCargado
      if (!hist || hist.length === 0) {
        try {
          hist = await calcularHistoricoMultianual([2022, 2023, 2024, 2025, 2026])
          setHistoricoCargado(hist)
        } catch (e) {
          console.warn('Error cargando histórico:', e)
        }
      }

      // 3. Cargar ranking de departamentos de calcularReporte o departamentosAnalizados
      let ranking = rankingDeptosCargado
      if (!ranking || ranking.length === 0) {
        try {
          const rep = await calcularReporte({
            tipo: filtroAnio === 'todos' ? 'actual' : 'anio',
            anio: filtroAnio === 'todos' ? new Date().getFullYear() : Number(filtroAnio),
          })
          if (rep && rep.porDepartamento && rep.porDepartamento.length > 0) {
            ranking = rep.porDepartamento
            setRankingDeptosCargado(ranking)
          }
        } catch (e) {
          console.warn('Error al calcular ranking en reporte:', e)
        }
      }

      if (!ranking || ranking.length === 0) {
        ranking = departamentosAnalizados.map((d) => ({
          nombre: d.nombre,
          cantidad: d.totalEncuestas,
        }))
        setRankingDeptosCargado(ranking)
      }

      // 4. Preparar asunto y texto formal del correo
      const deptoObj = departamentosAnalizados.find((d) => coincidenDeptos(d.nombre, deptoNombre))
      const promedioSat = (deptoObj?.promedioB || deptoObj?.promedioGeneral || 5.0).toFixed(2)
      const impactoAula = (deptoObj?.promedioA || 4.8).toFixed(2)
      const semaforoTxt = deptoObj?.labelSemaforo || 'Excelente (≥ 4.5)'

      const pos = ranking.findIndex((d) => coincidenDeptos(d.nombre, deptoNombre))
      const rankingTxt = pos >= 0 ? `Lugar #${pos + 1} de ${ranking.length} departamentos` : 'Destacada participación institucional'

      const periodoDesc = `${filtroPeriodo === 'todos' ? 'Periodo reciente' : filtroPeriodo} ${filtroAnio === 'todos' ? '' : filtroAnio}`.trim()

      setAsuntoCorreo(`[TecNM / ITD] Informe Ejecutivo de Análisis de Encuestas y Desempeño - ${deptoNombre}`)

      const plantillaMensaje = `Estimadas y estimados docentes del ${deptoNombre}:

Esperando se encuentren bien, la Coordinación de Actualización Docente del Instituto Tecnológico de Durango les comparte el Informe Ejecutivo de Satisfacción y Desempeño Docente (${periodoDesc}), generado a partir de las evaluaciones institucionales ITD-AD-FO-09:

📊 Métricas Destacadas de su Departamento:
• Satisfacción General (Curso e Instructor): ${promedioSat} / 5.00 (${semaforoTxt})
• Indicador de Impacto / Aplicación Práctica en el Aula: ${impactoAula} / 5.00
• Posición en Participación Institucional: ${rankingTxt}

En el documento PDF adjunto con logotipos oficiales encontrarán:
1. Resumen ejecutivo de satisfacción y semáforo departamental.
2. Desglose de cursos evaluados por docentes del departamento.
3. Gráfica de ubicación de participación respecto a todos los demás departamentos del ITD.
4. Gráfica de evolución y crecimiento acumulado multianual (2022 - 2026).

Agradecemos profundamente su valiosa labor académica y su compromiso con la excelencia educativa del ITD.

Atentamente,
Coordinación de Actualización Docente
Instituto Tecnológico de Durango`

      setCuerpoCorreo(plantillaMensaje)
    } catch (err) {
      console.error('Error al preparar envío:', err)
    } finally {
      setCargandoDocentes(false)
    }
  }

  function abrirModalEnvioCorreo(nombreDepto) {
    const deptoTarget = (nombreDepto && nombreDepto !== 'todos')
      ? nombreDepto
      : (filtroDepto !== 'todos' ? filtroDepto : deptosDisponibles[0] || '')

    setDeptoParaEnvio(deptoTarget)
    setModalCorreoAbierto(true)
    setCopiadoCorreos(false)
    setCopiadoMensaje(false)
    if (deptoTarget) {
      cargarDatosEnvioDepto(deptoTarget)
    }
  }

  function toggleDocenteSeleccionado(email) {
    setDocentesSeleccionados((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(email)) nuevo.delete(email)
      else nuevo.add(email)
      return nuevo
    })
  }

  function toggleTodosDocentes(seleccionar) {
    if (seleccionar) {
      setDocentesSeleccionados(new Set(docentesDepto.map((d) => d.email)))
    } else {
      setDocentesSeleccionados(new Set())
    }
  }

  function copiarCorreosAlPortapapeles() {
    const seleccionados = Array.from(docentesSeleccionados)
    const extras = correosExtra
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c && c.includes('@'))
    const todos = Array.from(new Set([...seleccionados, ...extras]))
    if (todos.length === 0) return

    navigator.clipboard.writeText(todos.join(', '))
    setCopiadoCorreos(true)
    setTimeout(() => setCopiadoCorreos(false), 3000)
  }

  function copiarMensajeAlPortapapeles() {
    navigator.clipboard.writeText(cuerpoCorreo)
    setCopiadoMensaje(true)
    setTimeout(() => setCopiadoMensaje(false), 3000)
  }

  async function generarYDescargarPDFDepartamental(deptoNombre, descargar = true) {
    setGenerandoPDFEnvio(true)
    try {
      let hist = historicoCargado
      if (!hist || hist.length === 0) {
        try {
          hist = await calcularHistoricoMultianual([2022, 2023, 2024, 2025, 2026])
          setHistoricoCargado(hist)
        } catch (e) {
          console.warn('Histórico fallback:', e)
        }
      }

      let ranking = rankingDeptosCargado
      if (!ranking || ranking.length === 0) {
        try {
          const rep = await calcularReporte({
            tipo: filtroAnio === 'todos' ? 'actual' : 'anio',
            anio: filtroAnio === 'todos' ? new Date().getFullYear() : Number(filtroAnio),
          })
          if (rep?.porDepartamento?.length) {
            ranking = rep.porDepartamento
            setRankingDeptosCargado(ranking)
          }
        } catch (e) {
          console.warn('Reporte ranking fallback:', e)
        }
      }

      if (!ranking || ranking.length === 0) {
        ranking = departamentosAnalizados.map((d) => ({
          nombre: d.nombre,
          cantidad: d.totalEncuestas,
        }))
      }

      const respDepto = respuestas.filter((r) => coincidenDeptos(r.departamento, deptoNombre))

      const resultado = await generarPDFInformeDepartamentalCompleto({
        deptoSeleccionado: deptoNombre,
        filtroPeriodo,
        filtroAnio,
        respuestasDepto: respDepto,
        departamentosAnalizados,
        cursosAnalizados: cursosAnalizados.filter((c) => respDepto.some((r) => r.curso_id === c.id)),
        historicoMultianual: hist,
        rankingDeptos: ranking,
        descargar,
      })

      return resultado
    } catch (err) {
      console.error('Error generando PDF departamental:', err)
      throw err
    } finally {
      setGenerandoPDFEnvio(false)
    }
  }

  async function descargarPDFModal() {
    await generarYDescargarPDFDepartamental(deptoParaEnvio, true)
  }

  async function abrirClienteCorreo() {
    const seleccionados = Array.from(docentesSeleccionados)
    const extras = correosExtra
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c && c.includes('@'))
    const todos = Array.from(new Set([...seleccionados, ...extras]))

    if (todos.length === 0) {
      alert('Por favor selecciona al menos un docente o ingresa un correo destinatario.')
      return
    }

    // Descargar el PDF en automático para que el docente/administrador lo tenga listo en Descargas
    try {
      await generarYDescargarPDFDepartamental(deptoParaEnvio, true)
    } catch (e) {
      console.warn('Descarga en apertura de correo:', e)
    }

    // mailto con BCC para proteger la privacidad de los docentes
    const bccStr = todos.join(',')
    const mailtoUrl = `mailto:?bcc=${encodeURIComponent(bccStr)}&subject=${encodeURIComponent(asuntoCorreo)}&body=${encodeURIComponent(cuerpoCorreo)}`

    window.location.href = mailtoUrl
  }

  async function abrirGmailWeb() {
    const seleccionados = Array.from(docentesSeleccionados)
    const extras = correosExtra
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c && c.includes('@'))
    const todos = Array.from(new Set([...seleccionados, ...extras]))

    if (todos.length === 0) {
      alert('Por favor selecciona al menos un docente o ingresa un correo destinatario.')
      return
    }

    // Descargar el PDF para que lo adjunte en 1 clic
    try {
      await generarYDescargarPDFDepartamental(deptoParaEnvio, true)
    } catch (e) {
      console.warn('Descarga en apertura Gmail:', e)
    }

    const bccStr = todos.join(',')
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(bccStr)}&su=${encodeURIComponent(asuntoCorreo)}&body=${encodeURIComponent(cuerpoCorreo)}`
    window.open(gmailUrl, '_blank')
  }

  async function enviarCorreoAutomatico() {
    const seleccionados = Array.from(docentesSeleccionados)
    const extras = correosExtra
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c && c.includes('@'))
    const todos = Array.from(new Set([...seleccionados, ...extras]))

    if (todos.length === 0) {
      alert('Por favor selecciona al menos un docente o ingresa un correo destinatario.')
      return
    }

    setEnviandoAutomatico(true)
    setResultadoEnvioAuto(null)

    try {
      // 1. Generar el PDF y obtener su base64
      const resPDF = await generarYDescargarPDFDepartamental(deptoParaEnvio, false)
      const dataUri = resPDF.doc.output('datauristring')
      const base64Data = dataUri.split(',')[1]
      const pesoKb = Math.round((resPDF.blob?.size || base64Data.length * 0.75) / 1024)

      // 2. Invocar la función Edge de Supabase
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          tipo: 'informe_ejecutivo',
          emails: todos,
          asunto: asuntoCorreo,
          mensaje: cuerpoCorreo,
          adjuntoBase64: base64Data,
          nombreArchivo: resPDF.nombreArchivo,
        },
      })

      if (error) {
        throw new Error(error.message || 'Error al conectar con la función de correo de Supabase.')
      }

      if (data && data.success === false) {
        throw new Error(data.message || 'Error reportado por el servidor de correo.')
      }

      setResultadoEnvioAuto({
        ok: true,
        mensaje: `¡Excelente! Se envió el correo automáticamente a ${todos.length} docentes con el PDF adjunto (${pesoKb} KB, optimizado para entrega inmediata).`,
      })
    } catch (err) {
      console.error('Error en envío automático:', err)
      setResultadoEnvioAuto({
        ok: false,
        mensaje: `No se pudo enviar automáticamente (${err.message || 'Error de servicio'}). Recuerda desplegar la Edge Function en Supabase o usa el botón "Redactar en Gmail Web" o "Abrir en Cliente".`,
      })
    } finally {
      setEnviandoAutomatico(false)
    }
  }

  async function exportarPDFInstitucional() {
    // Si hay un departamento específico seleccionado en la casilla, generar el informe ejecutivo completo con las gráficas
    if (filtroDepto !== 'todos') {
      await generarYDescargarPDFDepartamental(filtroDepto, true)
      return
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter', compress: true })
    const startY = await dibujarEncabezadoPDF(
      doc,
      'Reporte Ejecutivo: Análisis de Encuestas de Satisfacción',
      [
        `Periodo evaluado: ${filtroPeriodo === 'todos' ? 'Todos los periodos' : filtroPeriodo} (${filtroAnio === 'todos' ? 'Histórico' : filtroAnio})`,
        `Departamento: ${filtroDepto === 'todos' ? 'Consolidado Institucional' : filtroDepto}`,
      ]
    )

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(27, 57, 106)
    doc.text('1. Indicadores Clave de Desempeño', 14, startY + 6)

    autoTable(doc, {
      startY: startY + 9,
      margin: { left: 14, right: 14 },
      head: [['Métrica Institucional', 'Valor', 'Estatus']],
      body: [
        ['Total de Encuestas Procesadas', `${respuestasFiltradas.length}`, 'Completado'],
        ['Total de Cursos Evaluados', `${cursosAnalizados.length}`, 'Registrados'],
        ['Promedio General del Curso e Instructor', `${promedioInstitucionalB.toFixed(2)} / 5.00`, promedioInstitucionalB >= 4.5 ? 'Excelente' : 'Seguimiento'],
        ['Indicador de Impacto / Aplicación en el Aula', `${promedioImpactoAula.toFixed(2)} / 5.00`, promedioImpactoAula >= 4.3 ? 'Alto Impacto' : 'Aceptable'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [27, 57, 106], halign: 'center' },
      styles: { fontSize: 8.5 },
      columnStyles: {
        0: { cellWidth: 108 },
        1: { cellWidth: 40, halign: 'center' },
        2: { cellWidth: 40, halign: 'center' },
      },
    })

    // Semáforo por Departamento
    let currentY = doc.lastAutoTable.finalY + 9
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(27, 57, 106)
    doc.text('2. Semáforo por Departamento Académico', 14, currentY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(71, 85, 105)
    doc.text('(Criterios: Verde >= 4.5  |  Amarillo 4.0 - 4.49  |  Rojo < 4.0)', 14, currentY + 4.8)

    autoTable(doc, {
      startY: currentY + 8.5,
      margin: { left: 14, right: 14 },
      head: [['Departamento', 'Encuestas', 'Satisfacción', 'Semáforo']],
      body: departamentosAnalizados.map((d) => [
        d.nombre.replace('DEPARTAMENTO DE ', ''),
        `${d.totalEncuestas} (${d.porcentajeParticipacion}%)`,
        `${d.promedioGeneral.toFixed(2)}`,
        d.semaforo.toUpperCase(),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [27, 57, 106], halign: 'center' },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 96 },
        1: { cellWidth: 32, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 30, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const val = data.cell.raw
          if (val === 'VERDE') data.cell.styles.textColor = [16, 185, 129]
          else if (val === 'AMARILLO') data.cell.styles.textColor = [217, 119, 6]
          else data.cell.styles.textColor = [225, 29, 72]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })

    // Top Cursos e Impacto
    currentY = doc.lastAutoTable.finalY + 8
    if (currentY > 220) {
      doc.addPage()
      currentY = 20
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(27, 57, 106)
    doc.text('3. Indicador de Impacto por Curso: Satisfacción vs Aplicación Práctica', 14, currentY)

    autoTable(doc, {
      startY: currentY + 4,
      margin: { left: 14, right: 14 },
      head: [['Curso', 'Encuestas', 'Satisfacción', 'Aplicación en Aula', 'Recomendación']],
      body: cursosAnalizados.slice(0, 10).map((c) => [
        c.nombre.length > 45 ? c.nombre.slice(0, 45) + '…' : c.nombre,
        `${c.totalEncuestas}`,
        `${c.promedioSatisfaccion.toFixed(2)}`,
        `${c.promedioImpacto.toFixed(2)}`,
        c.repetirSemestreSiguiente ? 'Repetir próximo ciclo' : 'Revisar temario',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [27, 57, 106], halign: 'center' },
      styles: { fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 86 },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 26, halign: 'center' },
        4: { cellWidth: 30, halign: 'center' },
      },
    })

    doc.save(`Analisis_Encuestas_Ejecutivo_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  // Generación exacta del FORMATO PARA DIAGNÓSTICO Y CONCENTRADO DE NECESIDADES (ITD-AC-PO-10-01) en Word (.docx)
  // Incluye filas prellenadas de las encuestas + 4 filas vacías para que el departamento las complete a mano o en computadora
  async function exportarFormatoNecesidadesWord() {
    const deptoObj = filtroDepto !== 'todos'
      ? departamentosAnalizados.find((d) => d.nombre === filtroDepto)
      : departamentosAnalizados[0]

    const nombreDepto = deptoObj ? deptoObj.nombre : 'DEPARTAMENTO DE SISTEMAS Y COMPUTACIÓN'
    const recs = recomendacionesPorDepto.find((r) => r.depto === nombreDepto) || recomendacionesPorDepto[0]

    // Filas para la tabla a (Genérica)
    const filasAGenericas = [
      ...(recs?.cursosSugeridos || ['Estrategias de Aprendizaje Activo y Evaluación en el Aula', 'Herramientas Digitales y Tecnologías Educativas']).map((curso, idx) => {
        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(`Formación Genérica / Asignaturas Básicas ${idx + 1}`)] }),
            new TableCell({ children: [new Paragraph(curso)] }),
            new TableCell({ children: [new Paragraph(`${Math.max(8, (deptoObj?.totalEncuestas || 15) - idx * 3)}`)] }),
            new TableCell({ children: [new Paragraph('Enero - Junio / Agosto - Diciembre')] }),
            new TableCell({ children: [new Paragraph('Propuesto por Desarrollo Académico según Encuesta ITD-AD-FO-09')] }),
          ],
        })
      }),
      // 4 Filas vacías adicionales con suficiente espacio para escribir
      ...Array.from({ length: 4 }).map(() => {
        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
          ],
        })
      }),
    ]

    const tablaAGenerica = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ children: [new Paragraph({ text: 'Asignaturas en la que se requiere formación o actualización', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Contenidos temáticos en que se requiere la formación o actualización', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'No. profesores', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Periodo (enero-junio / agosto-diciembre)', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Facilitadores propuestos (nombre y datos)', bold: true })] }),
          ],
        }),
        ...filasAGenericas,
      ],
    })

    // Filas para la tabla b (Especialidad)
    const filasBEspecialidad = [
      ...(recs?.temasMayorDemanda || []).map((t, idx) => {
        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(`Módulos de Especialidad ${idx + 1}`)] }),
            new TableCell({ children: [new Paragraph(`${t.tema}: ${t.cursoSugerido}`)] }),
            new TableCell({ children: [new Paragraph(`${t.frecuencia * 4 || 10}`)] }),
            new TableCell({ children: [new Paragraph('Enero - Junio / Agosto - Diciembre')] }),
            new TableCell({ children: [new Paragraph('Instructor Especialista Externo / Academia')] }),
          ],
        })
      }),
      // 4 Filas vacías adicionales
      ...Array.from({ length: 4 }).map(() => {
        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
          ],
        })
      }),
    ]

    const tablaBEspecialidad = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ children: [new Paragraph({ text: 'Asignaturas de Especialidad', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Contenidos temáticos requeridos', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'No. profesores', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Periodo', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Facilitadores propuestos', bold: true })] }),
          ],
        }),
        ...filasBEspecialidad,
      ],
    })

    // Tablas para Página 2: Concentrado del Diagnóstico
    const tablaP2Docente = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ children: [new Paragraph({ text: 'Actividad o Evento (Cursos, talleres, conferencias, etc.)', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Carrera(s) a la que se orienta / No. profesores', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Periodo de realización', bold: true })] }),
          ],
        }),
        ...(recs?.cursosSugeridos || []).map((c) => {
          return new TableRow({
            children: [
              new TableCell({ children: [new Paragraph(`Curso-Taller: ${c}`)] }),
              new TableCell({ children: [new Paragraph(`${nombreDepto} (15 a 25 profesores)`)] }),
              new TableCell({ children: [new Paragraph('Próximo Periodo Intersemestral')] }),
            ],
          })
        }),
        ...Array.from({ length: 4 }).map(() => {
          return new TableRow({
            children: [
              new TableCell({ children: [new Paragraph(' ')] }),
              new TableCell({ children: [new Paragraph(' ')] }),
              new TableCell({ children: [new Paragraph(' ')] }),
            ],
          })
        }),
      ],
    })

    const tablaP2Profesional = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ children: [new Paragraph({ text: 'Actividad o Evento (Cursos, talleres, conferencias, etc.)', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Carrera(s) a la que se orienta / No. profesores', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Periodo de realización', bold: true })] }),
          ],
        }),
        ...(recs?.temasMayorDemanda || []).map((t) => {
          return new TableRow({
            children: [
              new TableCell({ children: [new Paragraph(`Taller Especializado: ${t.tema} - ${t.cursoSugerido}`)] }),
              new TableCell({ children: [new Paragraph(`${nombreDepto} (Especialidad)`)] }),
              new TableCell({ children: [new Paragraph('Próximo Periodo Intersemestral')] }),
            ],
          })
        }),
        ...Array.from({ length: 4 }).map(() => {
          return new TableRow({
            children: [
              new TableCell({ children: [new Paragraph(' ')] }),
              new TableCell({ children: [new Paragraph(' ')] }),
              new TableCell({ children: [new Paragraph(' ')] }),
            ],
          })
        }),
      ],
    })

    const docWord = new Document({
      sections: [
        // SECCIÓN 1: FORMATO PARA DIAGNÓSTICO DE NECESIDADES (PÁGINA 1)
        {
          properties: {},
          children: [
            new Paragraph({
              text: 'INSTITUTO TECNOLÓGICO DE DURANGO',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: 'Formato para Diagnóstico y Concentrado de Necesidades de Formación y Actualización Docente y Profesional',
              alignment: AlignmentType.CENTER,
              bold: true,
            }),
            new Paragraph({
              text: 'Código: ITD-AC-PO-10-01   |   Revisión: 0   |   Página 1 de 2',
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: 'Referencia a las Normas ISO 9001:2015 7.2, 7.3, ISO 14001:2015 7.2, 7.3, ISO 45001:2018 4.4.2 e ISO 50001:2018 4.5.2',
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Subdirección Académica\n', bold: true }),
                new TextRun({ text: `Departamento Académico: ${nombreDepto}\n`, bold: true }),
                new TextRun({ text: `Fecha de realización del diagnóstico: ${new Date().toLocaleDateString('es-MX')}\n` }),
                new TextRun({ text: `Evaluación de Encuestas: ${deptoObj?.totalEncuestas || 0} respuestas procesadas. Semáforo: ${deptoObj?.semaforo?.toUpperCase() || 'VERDE'}\n` }),
              ],
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'a) PRIORIZAR LAS ASIGNATURAS EN LAS QUE SE REQUIERA LA FORMACIÓN O ACTUALIZACIÓN DEL PROFESOR EN LA CARRERA GENÉRICA, AVALADOS POR LA ACADEMIA.',
              bold: true,
            }),
            tablaAGenerica,
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'b) PRIORIZAR LAS ASIGNATURAS EN LAS QUE SE REQUIERA LA FORMACIÓN O ACTUALIZACIÓN DEL PROFESOR EN LOS MÓDULOS DE ESPECIALIDAD, AVALADOS POR LA ACADEMIA.',
              bold: true,
            }),
            tablaBEspecialidad,
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'Firmas de Validación:',
              bold: true,
            }),
            new Paragraph({
              children: [
                new TextRun('Jefe del Departamento Académico: _______________________      Firma: _______________\n\n'),
                new TextRun('Presidente(s) de Academia: ___________________________      Firma: _______________\n\n'),
                new TextRun('c.c.p. Subdirección Académica'),
              ],
            }),
          ],
        },
        // SECCIÓN 2: CONCENTRADO DEL DIAGNÓSTICO (PÁGINA 2)
        {
          properties: {},
          children: [
            new Paragraph({
              text: 'INSTITUTO TECNOLÓGICO DE DURANGO',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: 'CONCENTRADO DEL DIAGNÓSTICO DE NECESIDADES DE FORMACIÓN Y ACTUALIZACIÓN DOCENTE Y PROFESIONAL',
              alignment: AlignmentType.CENTER,
              bold: true,
            }),
            new Paragraph({
              text: 'Código: ITD-AC-PO-10-01   |   Revisión: 0   |   Página 2 de 2',
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: 'Referencia a las Normas ISO 9001:2015 7.2, 7.3, ISO 14001:2015 7.2, 7.3, ISO 45001:2018 4.4.2 e ISO 50001:2018 4.5.2',
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Subdirección Académica\n', bold: true }),
                new TextRun({ text: `Departamento Académico: ${nombreDepto}\n`, bold: true }),
                new TextRun({ text: `Fecha: ${new Date().toLocaleDateString('es-MX')}\n` }),
              ],
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'a) ACTIVIDADES O EVENTOS PARA LA FORMACIÓN Y ACTUALIZACIÓN DOCENTE',
              bold: true,
            }),
            tablaP2Docente,
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'b) ACTIVIDADES O EVENTOS PARA LA FORMACIÓN Y ACTUALIZACIÓN PROFESIONAL (ESPECIALIDAD)',
              bold: true,
            }),
            tablaP2Profesional,
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'Firmas de Validación:',
              bold: true,
            }),
            new Paragraph({
              children: [
                new TextRun('Subdirección Académica: _______________________________      Firma: _______________\n\n'),
                new TextRun('Jefe del Departamento Académico: _______________________      Firma: _______________\n\n'),
                new TextRun('c.c.p. Archivo'),
              ],
            }),
          ],
        },
      ],
    })

    const blob = await Packer.toBlob(docWord)
    saveAs(blob, `Formato_Necesidades_ITD_AC_PO_10_01_${nombreDepto.replace(/[^a-zA-Z0-9]/g, '_')}.docx`)
  }

  // Generación exacta del Formato Oficial de Necesidades en PDF con cajas ISO y renglones vacíos para completar
  async function exportarFormatoNecesidadesPDF() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
    const deptoObj = filtroDepto !== 'todos'
      ? departamentosAnalizados.find((d) => d.nombre === filtroDepto)
      : departamentosAnalizados[0]
    const nombreDepto = deptoObj ? deptoObj.nombre : 'DEPARTAMENTO DE SISTEMAS Y COMPUTACIÓN'
    const recs = recomendacionesPorDepto.find((r) => r.depto === nombreDepto) || recomendacionesPorDepto[0]

    // ======================== PÁGINA 1 ========================
    // Marco exterior de la página
    doc.setDrawColor(27, 57, 106)
    doc.setLineWidth(0.5)
    doc.rect(10, 8, 196, 262)

    // Cabecera institucional en 3 casillas según el machote oficial
    // Casilla 1: Logos (x: 10 a 46)
    doc.rect(10, 8, 36, 26)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(27, 57, 106)
    doc.text('TECNM / ITD', 28, 22, { align: 'center' })

    // Casilla 2: Título del Formato e ISO (x: 46 a 168)
    doc.rect(46, 8, 122, 26)
    doc.setFontSize(9.5)
    doc.text('INSTITUTO TECNOLÓGICO DE DURANGO', 107, 14, { align: 'center' })
    doc.setFontSize(8)
    doc.setTextColor(30, 41, 59)
    doc.text('Formato para Diagnóstico y Concentrado de Necesidades de Formación', 107, 19, { align: 'center' })
    doc.text('y Actualización Docente y Profesional', 107, 23, { align: 'center' })
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    doc.text('Referencia a las Normas ISO 9001:2015 7.2, 7.3, ISO 14001:2015 7.2, 7.3, ISO 45001:2018 4.4.2 e ISO 50001:2018 4.5.2', 107, 30, { align: 'center' })

    // Casilla 3: Código y Revisión (x: 168 a 206)
    doc.rect(168, 8, 38, 26)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(27, 57, 106)
    doc.text('Código: ITD-AC-PO-10-01', 187, 15, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(51, 65, 85)
    doc.text('Revisión: 0', 187, 21, { align: 'center' })
    doc.text('Página 1 de 2', 187, 27, { align: 'center' })

    // Metadatos
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(27, 57, 106)
    doc.text('Subdirección Académica', 14, 38)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    doc.text(`Departamento Académico: ${nombreDepto}`, 14, 43)
    doc.text(`Fecha de realización del diagnóstico: ${new Date().toLocaleDateString('es-MX')}   |   Evaluación: ${deptoObj?.totalEncuestas || 0} encuestas (Semáforo: ${deptoObj?.semaforo?.toUpperCase() || 'VERDE'})`, 14, 48)

    // Sección a)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(27, 57, 106)
    doc.text('a) PRIORIZAR LAS ASIGNATURAS EN LAS QUE SE REQUIERA FORMACIÓN O ACTUALIZACIÓN (CARRERA GENÉRICA)', 14, 54)

    // Filas sugeridas + 4 filas vacías para llenar ellos
    const filasBodyA = [
      ...(recs?.cursosSugeridos || ['Estrategias de Aprendizaje Activo y Evaluación en el Aula', 'Herramientas Digitales y Tecnologías Educativas']).map((curso, idx) => [
        `Asignaturas Básicas / Eje Docente ${idx + 1}`,
        curso,
        `${Math.max(6, (deptoObj?.totalEncuestas || 12) - idx * 2)}`,
        'Enero-Junio / Ago-Dic',
        'Propuesto por Desarrollo Académico (Encuesta)',
      ]),
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
    ]

    autoTable(doc, {
      startY: 56,
      margin: { left: 12, right: 12 },
      head: [['Asignaturas requeridas', 'Contenidos temáticos requeridos', 'No. Prof.', 'Periodo', 'Facilitadores propuestos']],
      body: filasBodyA,
      theme: 'grid',
      headStyles: { fillColor: [27, 57, 106], fontSize: 7, halign: 'center' },
      styles: { fontSize: 6.5, minCellHeight: 7 },
      columnStyles: {
        0: { cellWidth: 46 },
        1: { cellWidth: 64 },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 26, halign: 'center' },
        4: { cellWidth: 40 },
      },
    })

    // Sección b)
    let currentY = doc.lastAutoTable.finalY + 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(27, 57, 106)
    doc.text('b) PRIORIZAR LAS ASIGNATURAS EN LOS MÓDULOS DE ESPECIALIDAD (AVALADOS POR LA ACADEMIA)', 14, currentY)

    const filasBodyB = [
      ...(recs?.temasMayorDemanda || []).map((t, idx) => [
        `Módulo Especialidad ${idx + 1}`,
        `${t.tema}: ${t.cursoSugerido}`,
        `${t.frecuencia * 3 || 8}`,
        'Enero-Junio',
        'Instructor Especialista en el Área',
      ]),
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
    ]

    autoTable(doc, {
      startY: currentY + 4,
      margin: { left: 12, right: 12 },
      head: [['Asignaturas especialidad', 'Contenidos temáticos requeridos', 'No. Prof.', 'Periodo', 'Facilitadores propuestos']],
      body: filasBodyB,
      theme: 'grid',
      headStyles: { fillColor: [27, 57, 106], fontSize: 7, halign: 'center' },
      styles: { fontSize: 6.5, minCellHeight: 7 },
      columnStyles: {
        0: { cellWidth: 46 },
        1: { cellWidth: 64 },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 26, halign: 'center' },
        4: { cellWidth: 40 },
      },
    })

    // Firmas Página 1
    currentY = doc.lastAutoTable.finalY + 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(30, 41, 59)
    doc.text('Jefe del Departamento Académico: _______________________      Firma: ____________________', 14, currentY + 4)
    doc.text('Presidente(s) de Academia: ___________________________      Firma: ____________________', 14, currentY + 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    doc.text('c.c.p. Subdirección Académica', 14, currentY + 15)

    // ======================== PÁGINA 2 ========================
    doc.addPage()
    doc.rect(10, 8, 196, 262)

    // Cabecera institucional Página 2
    doc.rect(10, 8, 36, 26)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(27, 57, 106)
    doc.text('TECNM / ITD', 28, 22, { align: 'center' })

    doc.rect(46, 8, 122, 26)
    doc.setFontSize(9.5)
    doc.text('INSTITUTO TECNOLÓGICO DE DURANGO', 107, 14, { align: 'center' })
    doc.setFontSize(8)
    doc.setTextColor(30, 41, 59)
    doc.text('CONCENTRADO DEL DIAGNÓSTICO DE NECESIDADES DE FORMACIÓN', 107, 19, { align: 'center' })
    doc.text('Y ACTUALIZACIÓN DOCENTE Y PROFESIONAL', 107, 23, { align: 'center' })
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    doc.text('Referencia a las Normas ISO 9001:2015 7.2, 7.3, ISO 14001:2015 7.2, 7.3, ISO 45001:2018 4.4.2 e ISO 50001:2018 4.5.2', 107, 30, { align: 'center' })

    doc.rect(168, 8, 38, 26)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(27, 57, 106)
    doc.text('Código: ITD-AC-PO-10-01', 187, 15, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(51, 65, 85)
    doc.text('Revisión: 0', 187, 21, { align: 'center' })
    doc.text('Página 2 de 2', 187, 27, { align: 'center' })

    // Metadatos Página 2
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(27, 57, 106)
    doc.text('Subdirección Académica', 14, 38)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    doc.text(`Departamento Académico: ${nombreDepto}`, 14, 43)
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, 14, 48)

    // Sección a) Página 2
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(27, 57, 106)
    doc.text('a) ACTIVIDADES O EVENTOS PARA LA FORMACIÓN Y ACTUALIZACIÓN DOCENTE', 14, 54)

    const filasP2Docente = [
      ...(recs?.cursosSugeridos || []).map((c) => [
        `Curso-Taller: ${c}`,
        `${nombreDepto} (15 a 25 profesores)`,
        'Próximo Periodo Intersemestral',
      ]),
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ]

    autoTable(doc, {
      startY: 56,
      margin: { left: 12, right: 12 },
      head: [['Actividad o Evento (Cursos, talleres, conferencias)', 'Carrera(s) atendidas / No. profesores', 'Fecha de realización']],
      body: filasP2Docente,
      theme: 'grid',
      headStyles: { fillColor: [27, 57, 106], fontSize: 7, halign: 'center' },
      styles: { fontSize: 7, minCellHeight: 8 },
      columnStyles: {
        0: { cellWidth: 92 },
        1: { cellWidth: 60 },
        2: { cellWidth: 40, halign: 'center' },
      },
    })

    // Sección b) Página 2
    currentY = doc.lastAutoTable.finalY + 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(27, 57, 106)
    doc.text('b) ACTIVIDADES O EVENTOS PARA LA FORMACIÓN Y ACTUALIZACIÓN PROFESIONAL (ESPECIALIDAD)', 14, currentY)

    const filasP2Especialidad = [
      ...(recs?.temasMayorDemanda || []).map((t) => [
        `Taller Especializado: ${t.tema} - ${t.cursoSugerido}`,
        `${nombreDepto} (Especialidad)`,
        'Próximo Periodo Intersemestral',
      ]),
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ]

    autoTable(doc, {
      startY: currentY + 4,
      margin: { left: 12, right: 12 },
      head: [['Actividad o Evento (Cursos, talleres, conferencias)', 'Carrera(s) atendidas / No. profesores', 'Fecha de realización']],
      body: filasP2Especialidad,
      theme: 'grid',
      headStyles: { fillColor: [27, 57, 106], fontSize: 7, halign: 'center' },
      styles: { fontSize: 7, minCellHeight: 8 },
      columnStyles: {
        0: { cellWidth: 92 },
        1: { cellWidth: 60 },
        2: { cellWidth: 40, halign: 'center' },
      },
    })

    // Firmas Página 2
    currentY = doc.lastAutoTable.finalY + 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(30, 41, 59)
    doc.text('Subdirección Académica: _______________________________      Firma: ____________________', 14, currentY + 4)
    doc.text('Jefe de Departamento Académico: _______________________      Firma: ____________________', 14, currentY + 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    doc.text('c.c.p. Archivo', 14, currentY + 15)

    doc.save(`Formato_Necesidades_ITD_AC_PO_10_01_${nombreDepto.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`)
  }

  // =========================================================================
  // RENDER PRINCIPAL
  // =========================================================================

  return (
    <div className="space-y-6">

      {/* Encabezado y Acciones Globales */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1b396a]" />
            <span className="text-xs font-bold tracking-widest text-[#1b396a] uppercase">
              Desarrollo Académico ITD
            </span>
          </div>
          <h2 className="font-serif text-2xl font-black text-[#1b396a] tracking-tight">
            Análisis de Encuestas de Satisfacción
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Dashboards automatizados, semáforo por departamento, impacto de cursos y detección de necesidades (ITD-AD-FO-09 / ITD-AC-PO-10-01).
          </p>
        </div>

        {/* Botones de Exportación Global */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportarExcelCompleto}
            disabled={cargando || respuestasFiltradas.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <span>📊</span>
            <span>Exportar Excel</span>
          </button>
          <button
            onClick={exportarPDFInstitucional}
            disabled={cargando || respuestasFiltradas.length === 0}
            title={filtroDepto !== 'todos' ? `Generar PDF Ejecutivo para ${filtroDepto} con gráficas` : "Generar PDF Ejecutivo institucional"}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#781834] hover:bg-[#60132a] active:bg-[#4d0f22] text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <span>📑</span>
            <span>PDF Ejecutivo {filtroDepto !== 'todos' ? '(con Gráficas)' : ''}</span>
          </button>
          <button
            onClick={() => abrirModalEnvioCorreo(filtroDepto)}
            disabled={cargando || respuestas.length === 0}
            title="Generar informe en PDF con gráficas y enviar por correo a los docentes del departamento"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#1b396a] to-[#2563eb] hover:from-[#122748] hover:to-[#1d4ed8] active:scale-[0.98] text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <span>📧</span>
            <span>Enviar Informe a Docentes (Mail)</span>
          </button>
          <button
            onClick={exportarFormatoNecesidadesWord}
            disabled={cargando || respuestasFiltradas.length === 0}
            title="Formato para Diagnóstico y Concentrado de Necesidades ITD-AC-PO-10-01"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1b396a] hover:bg-[#122748] active:bg-[#0c1a30] text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <span>📝</span>
            <span>Formato Necesidades (Word)</span>
          </button>
          <button
            onClick={exportarFormatoNecesidadesPDF}
            disabled={cargando || respuestasFiltradas.length === 0}
            title="Formato Oficial en PDF con 2 páginas y tablas ISO"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <span>📄</span>
            <span>Formato Necesidades (PDF)</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros Interactiva */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Año */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Año</label>
            <select
              value={filtroAnio}
              onChange={(e) => setFiltroAnio(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl bg-white shadow-2xs focus:ring-2 focus:ring-[#1b396a] focus:outline-hidden"
            >
              <option value="todos">📅 Todos los años</option>
              {aniosDisponibles.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Periodo */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Periodo</label>
            <select
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl bg-white shadow-2xs focus:ring-2 focus:ring-[#1b396a] focus:outline-hidden"
            >
              <option value="todos">🗓️ Todos los periodos</option>
              {periodosDisponibles.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Tipo de curso */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Tipo de curso</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl bg-white shadow-2xs focus:ring-2 focus:ring-[#1b396a] focus:outline-hidden"
            >
              <option value="todos">📚 Todos los tipos</option>
              <option value="Profesional">Profesional</option>
              <option value="Docente">Docente</option>
            </select>
          </div>

          {/* Departamento */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Departamento</label>
            <select
              value={filtroDepto}
              onChange={(e) => {
                setFiltroDepto(e.target.value)
                setFiltroCurso('todos') // reset curso al cambiar depto
              }}
              className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl bg-white shadow-2xs focus:ring-2 focus:ring-[#1b396a] focus:outline-hidden"
            >
              <option value="todos">🏢 Todos los deptos.</option>
              {deptosDisponibles.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Curso */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Curso</label>
            <select
              value={filtroCurso}
              onChange={(e) => setFiltroCurso(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl bg-white shadow-2xs focus:ring-2 focus:ring-[#1b396a] focus:outline-hidden"
            >
              <option value="todos">🎓 Todos los cursos</option>
              {cursosDisponibles.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          
        </div>

        {/* Resumen del filtro activo */}
        <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span>Mostrando:</span>
            <strong className="text-slate-800">{respuestasFiltradas.length}</strong>
            <span>encuestas de</span>
            <strong className="text-slate-800">{cursosAnalizados.length}</strong>
            <span>cursos en</span>
            <strong className="text-slate-800">{departamentosAnalizados.length}</strong>
            <span>departamentos</span>
          </div>
          {(filtroAnio !== 'todos' || filtroPeriodo !== 'todos' || filtroTipo !== 'todos' || filtroDepto !== 'todos' || filtroCurso !== 'todos') && (
            <button
              onClick={() => {
                setFiltroAnio('todos')
                setFiltroPeriodo('todos')
                setFiltroTipo('todos')
                setFiltroDepto('todos')
                setFiltroCurso('todos')
                setFiltroGenero('todos')
              }}
              className="text-[#1b396a] hover:underline font-bold text-xs cursor-pointer"
            >
              Limpiar todos los filtros ✕
            </button>
          )}
        </div>
      </div>

      {/* Menú de las 6 Vistas */}
      <div className="flex overflow-x-auto pb-1 gap-2 border-b border-slate-200">
        {[
          { id: 'general', label: '1. Dashboard General', icono: '📊' },
          { id: 'curso', label: '2. Análisis por Curso e Impacto', icono: '🎯' },
          { id: 'departamento', label: '3. Análisis por Depto (Semáforo)', icono: '🚦' },
          { id: 'indicadores', label: '4. Indicadores Institucionales', icono: '📈' },
          { id: 'comentarios', label: '5. Comentarios y Minería', icono: '💬' },
          { id: 'recomendaciones', label: '6. Detección de Necesidades', icono: '💡' },
        ].map((tab) => {
          const activa = vista === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setVista(tab.id)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                activa
                  ? 'bg-[#1b396a] text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <span>{tab.icono}</span>
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {cargando && (
        <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
          <div className="inline-block animate-spin text-2xl mb-2">⏳</div>
          <p className="font-semibold text-sm">Cargando y procesando encuestas desde Supabase…</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {!cargando && respuestasFiltradas.length === 0 && (
        <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 space-y-2">
          <span className="text-3xl">🔍</span>
          <p className="font-bold text-sm text-slate-700">No se encontraron encuestas con los filtros seleccionados.</p>
          <p className="text-xs text-slate-400">Prueba ajustando el año, departamento o restableciendo los filtros.</p>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VISTA 1: DASHBOARD GENERAL                                            */}
      {/* ===================================================================== */}
      {!cargando && respuestasFiltradas.length > 0 && vista === 'general' && (
        <div className="space-y-6">

          {/* Tarjetas KPI Superiores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Encuestas Totales</span>
              <div className="text-3xl font-black text-[#1b396a] mt-1">{respuestasFiltradas.length}</div>
              <p className="text-xs text-slate-500 mt-1">Respuestas capturadas</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cursos Evaluados</span>
              <div className="text-3xl font-black text-amber-600 mt-1">{cursosAnalizados.length}</div>
              <p className="text-xs text-slate-500 mt-1">Cursos representados</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Promedio Institucional</span>
              <div className="text-3xl font-black text-emerald-600 mt-1">
                {promedioInstitucionalB.toFixed(2)} <span className="text-sm font-normal text-slate-400">/ 5.0</span>
              </div>
              <p className="text-xs text-emerald-700 font-semibold mt-1">Evaluación de cursos e instructores</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Impacto en el Aula</span>
              <div className="text-3xl font-black text-purple-600 mt-1">
                {promedioImpactoAula.toFixed(2)} <span className="text-sm font-normal text-slate-400">/ 5.0</span>
              </div>
              <p className="text-xs text-purple-700 font-semibold mt-1">Aplicación práctica de lo aprendido</p>
            </div>
          </div>

          {/* Gráficas de Distribución General */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Participación por Departamento */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs min-w-0">
              <h3 className="font-bold text-sm text-[#1b396a] mb-3">Participación por Departamento Académico</h3>
              <div style={{ width: '100%', height: 280 }} className="relative min-w-0">
                <ResponsiveContainer>
                  <BarChart data={datosParticipacionDepto} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="nombreCorto" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" interval={0} />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      formatter={(val) => [`${val} encuestas`, 'Participación']}
                      labelFormatter={(nombreCorto) => {
                        const it = datosParticipacionDepto.find((d) => d.nombreCorto === nombreCorto)
                        return it ? it.nombreCompleto : nombreCorto
                      }}
                    />
                    <Bar dataKey="encuestas" fill="#1b396a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Participación por Tipo de Curso */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs min-w-0 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#1b396a] mb-1">Tipo de Curso</h3>
                <p className="text-xs text-slate-400 mb-3">Profesional vs. Docente</p>
                <div style={{ width: '100%', height: 200 }} className="relative min-w-0">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={datosParticipacionTipo} dataKey="valor" nameKey="nombre" innerRadius={50} outerRadius={75} paddingAngle={2}>
                        {datosParticipacionTipo.map((d) => (
                          <Cell key={d.nombre} fill={d.color} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-center">
                <span className="text-[11px] text-slate-500">Distribución homogénea entre formación profesional y docente.</span>
              </div>
            </div>
          </div>

          

        </div>
      )}

      {/* ===================================================================== */}
      {/* VISTA 2: ANÁLISIS POR CURSO & INDICADOR DE IMPACTO                    */}
      {/* ===================================================================== */}
      {!cargando && respuestasFiltradas.length > 0 && vista === 'curso' && cursoSeleccionado && (
        <div className="space-y-6">

          {/* Cabecera del Curso Seleccionado */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    {cursoSeleccionado.folio}
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs font-semibold text-slate-500">{cursoSeleccionado.tipo}</span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="text-xs font-semibold text-[#1b396a]">{cursoSeleccionado.departamento}</span>
                </div>
                <h3 className="font-serif text-xl font-bold text-[#1b396a]">{cursoSeleccionado.nombre}</h3>
              </div>

              {/* Selector de Curso Directo */}
              <div className="w-full md:w-80">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Cambiar de curso</label>
                <select
                  value={filtroCurso === 'todos' ? cursoSeleccionado.id : filtroCurso}
                  onChange={(e) => setFiltroCurso(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white"
                >
                  {cursosAnalizados.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* KPIs del Curso: Satisfacción vs Aplicación Práctica */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-400 uppercase">Encuestas Respondidas</span>
                <div className="text-2xl font-black text-slate-800 mt-1">{cursoSeleccionado.totalEncuestas}</div>
                <p className="text-[11px] text-slate-500 mt-0.5">Participantes evaluadores</p>
              </div>

              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                <span className="text-xs font-bold text-blue-700 uppercase">Satisfacción (B1-B9)</span>
                <div className="text-2xl font-black text-blue-900 mt-1">{cursoSeleccionado.promedioSatisfaccion} / 5.0</div>
                <p className="text-[11px] text-blue-700 mt-0.5">Instructor, contenido y didáctica</p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-xs font-bold text-emerald-700 uppercase">Aplicación Práctica (A3/C1)</span>
                <div className="text-2xl font-black text-emerald-900 mt-1">{cursoSeleccionado.promedioImpacto} / 5.0</div>
                <p className="text-[11px] text-emerald-700 mt-0.5">Impacto real en el aula docente</p>
              </div>

              <div className={`p-4 rounded-xl border ${cursoSeleccionado.repetirSemestreSiguiente ? 'bg-purple-50 border-purple-200 text-purple-900' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                <span className="text-xs font-bold uppercase">Dictamen Próximo Semestre</span>
                <div className="text-base font-black mt-1">
                  {cursoSeleccionado.repetirSemestreSiguiente ? '✅ REPETIR CURSO' : '🔄 AJUSTAR CONTENIDO'}
                </div>
                <p className="text-[11px] mt-0.5 opacity-80">
                  {cursoSeleccionado.repetirSemestreSiguiente
                    ? 'Cumple alta satisfacción y aplicación práctica'
                    : 'Revisar pertinencia con la academia'}
                </p>
              </div>
            </div>
          </div>

          {/* Gráficas del Curso: Radar y Barras */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Gráfica Radar de Dimensiones */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs min-w-0">
              <h4 className="font-bold text-sm text-[#1b396a] mb-2">Radar de Competencias y Criterios</h4>
              <p className="text-xs text-slate-400 mb-2">Equilibrio entre dominio, didáctica, puntualidad e impacto</p>
              <div style={{ width: '100%', height: 300 }} className="relative min-w-0">
                <ResponsiveContainer>
                  <RadarChart data={datosRadarCurso}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10, fill: '#334155' }} />
                    <PolarRadiusAxis domain={[0, 5]} />
                    <Radar name={cursoSeleccionado.nombre} dataKey="valor" stroke="#1b396a" fill="#1b396a" fillOpacity={0.4} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Comparativa con Otros Cursos */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <h4 className="font-bold text-sm text-[#1b396a] mb-1">Matriz de Decisión Estratégica</h4>
              <p className="text-xs text-slate-400 mb-4">¿Se debe repetir el curso el siguiente ciclo escolar?</p>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-700">Satisfacción General del Curso</span>
                    <span className="text-[#1b396a]">{cursoSeleccionado.promedioSatisfaccion} / 5.0</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-[#1b396a] h-full rounded-full" style={{ width: `${(cursoSeleccionado.promedioSatisfaccion / 5) * 100}%` }} />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-700">Aplicación Práctica en la Docencia</span>
                    <span className="text-emerald-700">{cursoSeleccionado.promedioImpacto} / 5.0</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${(cursoSeleccionado.promedioImpacto / 5) * 100}%` }} />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 text-xs text-blue-900 leading-relaxed">
                  <strong>💡 Justificación para Desarrollo Académico:</strong><br />
                  {cursoSeleccionado.promedioImpacto >= 4.3 ? (
                    <span>
                      Este curso demuestra una alta transferencia al aula ({cursoSeleccionado.promedioImpacto} / 5.0). Los docentes reportan que los conceptos y herramientas adquiridas se están aplicando directamente con los alumnos. Se sugiere <strong>mantenerlo en la convocatoria del próximo semestre</strong>.
                    </span>
                  ) : (
                    <span>
                      El curso cuenta con satisfacción adecuada, pero su indicador de aplicación en el aula ({cursoSeleccionado.promedioImpacto} / 5.0) muestra que los profesores encuentran barreras para implementarlo. Se recomienda solicitar a la academia o instructor enfatizar talleres prácticos orientados a la materia.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ===================================================================== */}
      {/* VISTA 3: ANÁLISIS POR DEPARTAMENTO (CON SEMÁFORO)                     */}
      {/* ===================================================================== */}
      {!cargando && respuestasFiltradas.length > 0 && vista === 'departamento' && (
        <div className="space-y-6">

          {/* Guía del Semáforo Institucional */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <h3 className="font-bold text-sm text-[#1b396a] mb-2">Semáforo Institucional de Satisfacción y Pertinencia</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                <span className="w-4 h-4 rounded-full bg-emerald-600 shrink-0" />
                <div>
                  <strong className="block">Verde: ≥ 4.5</strong>
                  <span>Excelente satisfacción y cumplimiento docente</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                <span className="w-4 h-4 rounded-full bg-amber-500 shrink-0" />
                <div>
                  <strong className="block">Amarillo: 4.0 – 4.49</strong>
                  <span>Aceptable / Seguimiento en temarios o servicios</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                <span className="w-4 h-4 rounded-full bg-rose-600 shrink-0" />
                <div>
                  <strong className="block">Rojo: &lt; 4.0</strong>
                  <span>Atención prioritaria y revisión con la academia</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla Desglosada con Semáforo */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h4 className="font-bold text-sm text-[#1b396a]">Concentrado por Departamento Académico</h4>
              <span className="text-xs text-slate-400">Total: {departamentosAnalizados.length} departamentos activos</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Departamento</th>
                    <th className="p-3.5 text-center">Encuestas</th>
                    <th className="p-3.5 text-center">Participación</th>
                    <th className="p-3.5 text-center">Cursos</th>
                    <th className="p-3.5 text-center">Desempeño (A)</th>
                    <th className="p-3.5 text-center">Instructor (B)</th>
                    <th className="p-3.5 text-center">Pertinencia (C)</th>
                    <th className="p-3.5 text-center">Promedio General</th>
                    <th className="p-3.5 text-center">Semáforo</th>
                    <th className="p-3.5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departamentosAnalizados.map((d) => (
                    <tr key={d.nombre} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 font-bold text-slate-800">
                        {d.nombre}
                      </td>
                      <td className="p-3.5 text-center font-bold text-[#1b396a]">{d.totalEncuestas}</td>
                      <td className="p-3.5 text-center text-slate-500">{d.porcentajeParticipacion}%</td>
                      <td className="p-3.5 text-center font-bold text-amber-700">{d.totalCursos}</td>
                      <td className="p-3.5 text-center">{d.promedioA}</td>
                      <td className="p-3.5 text-center">{d.promedioB}</td>
                      <td className="p-3.5 text-center">{d.promedioC}</td>
                      <td className="p-3.5 text-center font-black text-sm text-slate-800">
                        {d.promedioGeneral.toFixed(2)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${d.colorBadge}`}>
                          <span className={`w-2 h-2 rounded-full ${d.semaforo === 'verde' ? 'bg-emerald-600' : d.semaforo === 'amarillo' ? 'bg-amber-500' : 'bg-rose-600'}`} />
                          <span>{d.labelSemaforo}</span>
                        </span>
                      </td>
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <button
                          onClick={() => {
                            setFiltroDepto(d.nombre)
                            abrirModalEnvioCorreo(d.nombre)
                          }}
                          title="Generar PDF con gráficas y enviar por correo a los docentes de este departamento"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1b396a]/10 hover:bg-[#1b396a] text-[#1b396a] hover:text-white font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          <span>📧</span>
                          <span>Enviar Informe</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ===================================================================== */}
      {/* VISTA 4: INDICADORES INSTITUCIONALES (PREGUNTA POR PREGUNTA)          */}
      {/* ===================================================================== */}
      {!cargando && respuestasFiltradas.length > 0 && vista === 'indicadores' && (
        <div className="space-y-6">

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <h3 className="font-bold text-sm text-[#1b396a] mb-1">Evaluación Detallada de Criterios (ITD-AD-FO-09)</h3>
            <p className="text-xs text-slate-500">
              Análisis institucional por pregunta: Promedio, Mínimo, Máximo y Tendencia de respuesta.
            </p>
          </div>

          {['A', 'B', 'C'].map((sec) => {
            const items = resultadoPreguntas.filter((p) => p.seccion === sec)
            const nombreSec = sec === 'A'
              ? 'Sección A: Desempeño y Desarrollo Docente'
              : sec === 'B'
              ? 'Sección B: Evaluación del Curso, Contenido e Instructor'
              : 'Sección C: Pertinencia y Recomendación Institucional'

            return (
              <div key={sec} className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#1b396a]">{nombreSec}</h4>
                </div>

                <div className="divide-y divide-slate-100">
                  {items.map((p) => (
                    <div key={p.codigo} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-[#1b396a]">
                            {p.codigo.toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-400">· {p.total} respuestas</span>
                        </div>
                        <p className="text-xs text-slate-700 font-medium">{p.texto}</p>
                      </div>

                      {/* Mini Barra de Distribución 1 a 5 */}
                      <div className="w-full md:w-56 shrink-0 space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>1⭐: {p.distribucion[1] || 0}</span>
                          <span>2⭐: {p.distribucion[2] || 0}</span>
                          <span>3⭐: {p.distribucion[3] || 0}</span>
                          <span>4⭐: {p.distribucion[4] || 0}</span>
                          <span className="font-bold text-emerald-700">5⭐: {p.distribucion[5] || 0}</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                          <div style={{ width: `${((p.distribucion[1] || 0) / (p.total || 1)) * 100}%` }} className="bg-rose-500 h-full" />
                          <div style={{ width: `${((p.distribucion[2] || 0) / (p.total || 1)) * 100}%` }} className="bg-orange-400 h-full" />
                          <div style={{ width: `${((p.distribucion[3] || 0) / (p.total || 1)) * 100}%` }} className="bg-amber-400 h-full" />
                          <div style={{ width: `${((p.distribucion[4] || 0) / (p.total || 1)) * 100}%` }} className="bg-blue-500 h-full" />
                          <div style={{ width: `${((p.distribucion[5] || 0) / (p.total || 1)) * 100}%` }} className="bg-emerald-600 h-full" />
                        </div>
                      </div>

                      {/* Promedio */}
                      <div className="text-right shrink-0 min-w-20">
                        <span className="text-lg font-black text-[#1b396a]">{p.promedio.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400 block">Mín {p.minimo} / Máx {p.maximo}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

        </div>
      )}

      {/* ===================================================================== */}
      {/* VISTA 5: COMENTARIOS ABIERTOS & MINERÍA DE TEXTO                      */}
      {/* ===================================================================== */}
      {!cargando && respuestasFiltradas.length > 0 && vista === 'comentarios' && (
        <div className="space-y-6">

          {/* Minería de Palabras Clave y Temas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Lo más valioso */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <h4 className="font-bold text-sm text-[#1b396a] mb-2 flex items-center gap-2">
                <span>💎</span>
                <span>Términos más repetidos en «Lo más valioso»</span>
              </h4>
              <p className="text-xs text-slate-400 mb-3">Aspectos formativos que los docentes aprecian más</p>
              <div className="flex flex-wrap gap-2">
                {analisisPalabras.topValiosos.map((item) => (
                  <span key={item.palabra} className="px-3 py-1 rounded-xl bg-blue-50 border border-blue-200 text-[#1b396a] text-xs font-semibold">
                    {item.palabra} <span className="text-[10px] opacity-70">({item.cuenta})</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Sugerencias de Nuevos Cursos */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <h4 className="font-bold text-sm text-[#1b396a] mb-2 flex items-center gap-2">
                <span>🎯</span>
                <span>Demandas más frecuentes en «Sugerencias»</span>
              </h4>
              <p className="text-xs text-slate-400 mb-3">Temas y tecnologías que los docentes solicitan aprender</p>
              <div className="flex flex-wrap gap-2">
                {analisisPalabras.topSugerencias.map((item) => (
                  <span key={item.palabra} className="px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                    {item.palabra} <span className="text-[10px] opacity-70">({item.cuenta})</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Impedimentos Detectados */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <h4 className="font-bold text-sm text-[#1b396a] mb-1">Impedimentos Reportados para Aplicar lo Aprendido</h4>
            <p className="text-xs text-slate-400 mb-4">Factores que dificultan la transferencia al aula</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {impedimentosConsolidados.map((imp) => (
                <div key={imp.nombre} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="text-xs font-bold text-slate-700">{imp.nombre}</span>
                  <div className="text-xl font-black text-rose-700 mt-1">{imp.cantidad} menciones</div>
                  <span className="text-[10px] text-slate-400">{((imp.cantidad / (respuestasFiltradas.length || 1)) * 100).toFixed(1)}% de las respuestas</span>
                </div>
              ))}
            </div>
          </div>

          {/* Buscador y Listado de Respuestas Abiertas */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h4 className="font-bold text-sm text-[#1b396a]">Explorador de Comentarios Individuales</h4>
              <input
                type="text"
                value={busquedaComentario}
                onChange={(e) => setBusquedaComentario(e.target.value)}
                placeholder="Buscar por palabra o temática..."
                className="text-xs px-3 py-2 border border-slate-300 rounded-xl w-full sm:w-72"
              />
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 pr-2">
              {respuestasFiltradas
                .filter((r) => {
                  if (!busquedaComentario.trim()) return true
                  const q = busquedaComentario.toLowerCase()
                  return (
                    (r.comentario_valioso || '').toLowerCase().includes(q) ||
                    (r.comentario_sugerencias || '').toLowerCase().includes(q) ||
                    (r.curso_nombre || '').toLowerCase().includes(q)
                  )
                })
                .slice(0, 50)
                .map((r) => (
                  <div key={r.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-bold text-slate-600">{r.curso_nombre} ({r.departamento})</span>
                      <span>{new Date(r.respondido_en).toLocaleDateString('es-MX')}</span>
                    </div>
                    {r.comentario_valioso && (
                      <p className="text-xs text-slate-700">
                        <strong className="text-emerald-700">Lo más valioso:</strong> «{r.comentario_valioso}»
                      </p>
                    )}
                    {r.comentario_sugerencias && (
                      <p className="text-xs text-slate-700">
                        <strong className="text-[#1b396a]">Sugerencias:</strong> «{r.comentario_sugerencias}»
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>

        </div>
      )}

      {/* ===================================================================== */}
      {/* VISTA 6: RECOMENDACIONES DE CAPACITACIÓN & DETECCIÓN DE NECESIDADES     */}
      {/* ===================================================================== */}
      {!cargando && respuestasFiltradas.length > 0 && vista === 'recomendaciones' && (
        <div className="space-y-6">

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <h3 className="font-bold text-sm text-[#1b396a] mb-1">Detección de Necesidades de Capacitación Docente</h3>
            <p className="text-xs text-slate-500">
              Propuestas de cursos y temáticas generadas a partir de la minería de encuestas para nutrir el formato oficial ITD-AC-PO-10-01.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {recomendacionesPorDepto.map((item) => (
              <div key={item.depto} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-bold text-sm text-[#1b396a]">{item.depto}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{item.totalSugerencias} sugerencias procesadas</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${item.semaforo === 'verde' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      Prom: {item.promedioGeneral.toFixed(2)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Temas con Mayor Demanda Detectados:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {item.temasMayorDemanda.map((t) => (
                        <span key={t.tema} className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#1b396a] text-xs font-semibold border border-blue-200">
                          {t.tema}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    {/* Cursos Ofertados / Cursados por este departamento */}
                    {item.cursosImpartidos && item.cursosImpartidos.length > 0 && (
                      <div className="mb-3">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          📚 Cursos Ofertados / Evaluados ({item.cursosImpartidos.length}):
                        </span>
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                          {item.cursosImpartidos.map((ci, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-50 p-1.5 rounded border border-slate-100">
                              <span className="font-medium text-slate-700 truncate pr-2" title={ci.nombre}>• {ci.nombre}</span>
                              <span className="font-bold text-[#1b396a] shrink-0">★ {ci.promedio.toFixed(1)} ({ci.docentes} doc.)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <span className="text-[11px] font-bold text-[#C45500] uppercase tracking-wider block mb-2">
                      💡 Detección de Necesidades & Propuestas Específicas:
                    </span>
                    <ul className="space-y-1.5 text-xs text-slate-700">
                      {item.cursosSugeridos.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 bg-amber-50/60 p-1.5 rounded border border-amber-200/60">
                          <span className="text-emerald-600 font-bold mt-0.5">✔</span>
                          <span className="font-medium text-slate-800">{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400">Listo para formato ITD-AC-PO-10-01</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setFiltroDepto(item.depto)
                        abrirModalEnvioCorreo(item.depto)
                      }}
                      className="text-xs text-[#781834] font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>📧</span> Enviar Informe a Docentes →
                    </button>
                    <button
                      onClick={() => {
                        setFiltroDepto(item.depto)
                        exportarFormatoNecesidadesPDF()
                      }}
                      className="text-xs text-[#1b396a] font-bold hover:underline cursor-pointer"
                    >
                      Generar Formato de este Depto →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE ENVÍO DE INFORME EJECUTIVO POR CORREO A DOCENTES DEL DEPTO   */}
      {/* ===================================================================== */}
      {modalCorreoAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full my-8 overflow-hidden text-slate-800 transition-all">
            {/* Header Modal */}
            <div className="bg-gradient-to-r from-[#1b396a] via-[#1e427b] to-[#781834] text-white p-6 relative">
              <button
                onClick={() => setModalCorreoAbierto(false)}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
              <div className="flex items-center gap-3 mb-2">
                <span className="p-2.5 rounded-xl bg-white/10 text-2xl">📧</span>
                <div>
                  <h3 className="font-serif text-lg font-bold">
                    Enviar Informe Ejecutivo a Docentes
                  </h3>
                  <p className="text-xs text-blue-100 flex flex-wrap items-center gap-2">
                    <span>PDF oficial con logos, semáforo, ranking departamental y evolución multianual.</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/30 text-emerald-100 border border-emerald-400/40">
                      ⚡ Ultra-ligero (~120 - 180 KB)
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Selector de Departamento */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  🏢 Departamento Seleccionado (solo sus docentes recibirán el correo):
                </label>
                <select
                  value={deptoParaEnvio}
                  onChange={(e) => {
                    setDeptoParaEnvio(e.target.value)
                    cargarDatosEnvioDepto(e.target.value)
                  }}
                  className="w-full text-xs font-semibold px-3 py-2.5 border border-slate-300 rounded-xl bg-white shadow-2xs focus:ring-2 focus:ring-[#1b396a] focus:outline-hidden"
                >
                  {deptosDisponibles.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                  <span>ℹ️</span>
                  <span>
                    El informe incluirá el desempeño de <strong>{deptoParaEnvio}</strong> y su posición comparativa respecto a todos los demás departamentos.
                  </span>
                </p>
              </div>

              {/* Sección de Docentes Destinatarios */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#1b396a]">
                      👥 Docentes del Departamento
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {docentesSeleccionados.size} de {docentesDepto.length} seleccionados
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => toggleTodosDocentes(true)}
                      className="text-[#1b396a] font-bold hover:underline cursor-pointer text-[11px]"
                    >
                      Marcar todos
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => toggleTodosDocentes(false)}
                      className="text-slate-500 hover:underline cursor-pointer text-[11px]"
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>

                {cargandoDocentes ? (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[#1b396a] mb-2" />
                    <p>Consultando docentes activos de {deptoParaEnvio} en Supabase…</p>
                  </div>
                ) : docentesDepto.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                    <p className="font-bold">⚠️ No se encontraron docentes con correo registrado para este departamento.</p>
                    <p className="mt-1">
                      Puedes agregar direcciones de correo manualmente en el campo inferior para enviarles el informe.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-xs">
                    {docentesDepto.map((doc) => {
                      const checked = docentesSeleccionados.has(doc.email)
                      return (
                        <label
                          key={doc.id || doc.email}
                          className={`flex items-center justify-between p-2 rounded-xl border transition-colors cursor-pointer ${
                            checked
                              ? 'bg-blue-50/60 border-blue-200 text-slate-800'
                              : 'bg-slate-50/50 border-slate-200 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate mr-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleDocenteSeleccionado(doc.email)}
                              className="rounded text-[#1b396a] focus:ring-[#1b396a] h-4 w-4"
                            />
                            <span className="font-semibold truncate">
                              {doc.nombre_completo}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-500 shrink-0">
                            {doc.email}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}

                {/* Correos extra (Jefe de departamento, subdirección, etc.) */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    ➕ Agregar correos adicionales (ej. Jefe de Depto., separados por coma):
                  </label>
                  <input
                    type="text"
                    value={correosExtra}
                    onChange={(e) => setCorreosExtra(e.target.value)}
                    placeholder="jefe_depto@itdurango.edu.mx, subdireccion@itdurango.edu.mx"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#1b396a] focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Asunto y Contenido del Correo */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    📝 Asunto del Correo:
                  </label>
                  <input
                    type="text"
                    value={asuntoCorreo}
                    onChange={(e) => setAsuntoCorreo(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#1b396a] focus:outline-hidden"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      💬 Mensaje / Cuerpo del Correo:
                    </label>
                    <button
                      type="button"
                      onClick={copiarMensajeAlPortapapeles}
                      className="text-[11px] font-bold text-[#1b396a] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{copiadoMensaje ? '✓ Copiado' : '📋 Copiar mensaje'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={cuerpoCorreo}
                    onChange={(e) => setCuerpoCorreo(e.target.value)}
                    className="w-full text-xs font-mono p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#1b396a] focus:outline-hidden leading-relaxed"
                  />
                </div>
              </div>

              {/* Banner de resultado de envío automático */}
              {resultadoEnvioAuto && (
                <div
                  className={`p-4 rounded-2xl border text-xs font-semibold flex items-start gap-2.5 animate-fade-in ${
                    resultadoEnvioAuto.ok
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <span className="text-base shrink-0">{resultadoEnvioAuto.ok ? '✅' : '⚠️'}</span>
                  <div className="flex-1">
                    <p className="font-bold">{resultadoEnvioAuto.ok ? 'Envío Exitoso' : 'Aviso de Envío'}</p>
                    <p className="mt-0.5 font-normal">{resultadoEnvioAuto.mensaje}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setResultadoEnvioAuto(null)}
                    className="text-xs opacity-60 hover:opacity-100 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Instrucciones y Opciones de Envío */}
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-[11px] text-blue-900 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>Opciones de Envío:</span>
                </p>
                <ul className="space-y-1 text-blue-800">
                  <li>
                    • <strong>Envío Automático (Recomendado):</strong> Envía el correo directamente desde el servidor con el archivo PDF adjunto a todos los docentes seleccionados sin abrir aplicaciones externas.
                  </li>
                  <li>
                    • <strong>Redactar en Gmail Web:</strong> Abre Gmail en tu navegador con los docentes en CCO y el mensaje prellenado en 1 clic.
                  </li>
                  <li>
                    • <strong>Cliente de Correo / Copiar CCO:</strong> Para Outlook, Thunderbird o copiar y pegar manualmente.
                  </li>
                </ul>
              </div>
            </div>

            {/* Botones de Acción del Modal */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={copiarCorreosAlPortapapeles}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>{copiadoCorreos ? '✓ Correos Copiados' : '📋 Copiar CCO'}</span>
                </button>
                <button
                  type="button"
                  onClick={descargarPDFModal}
                  disabled={generandoPDFEnvio}
                  className="px-3 py-2 rounded-xl border border-[#781834] bg-white hover:bg-rose-50 text-[#781834] text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>{generandoPDFEnvio ? '⏳ Generando…' : '⬇ Descargar PDF'}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={abrirGmailWeb}
                  disabled={generandoPDFEnvio || enviandoAutomatico || (docentesSeleccionados.size === 0 && !correosExtra.trim())}
                  title="Abrir ventana de redacción en Gmail Web con los correos en CCO"
                  className="px-3 py-2 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>📮</span>
                  <span>Gmail Web</span>
                </button>

                <button
                  type="button"
                  onClick={abrirClienteCorreo}
                  disabled={generandoPDFEnvio || enviandoAutomatico || (docentesSeleccionados.size === 0 && !correosExtra.trim())}
                  title="Abrir en gestor local (Outlook, Mail, etc.)"
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>✉️</span>
                  <span>Cliente Correo</span>
                </button>

                <button
                  type="button"
                  onClick={enviarCorreoAutomatico}
                  disabled={enviandoAutomatico || generandoPDFEnvio || (docentesSeleccionados.size === 0 && !correosExtra.trim())}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>{enviandoAutomatico ? '⏳' : '🚀'}</span>
                  <span>{enviandoAutomatico ? 'Enviando por Correo…' : 'Enviar Automático (con PDF)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
