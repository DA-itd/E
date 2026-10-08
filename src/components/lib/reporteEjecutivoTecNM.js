// lib/reporteEjecutivoTecNM.js
// Generador del Reporte Ejecutivo Oficial solicitado por el TecNM
// Utiliza la plantilla oficial membretada: oficio_registro_blanco.pdf
// y genera un PDF vectorial extremadamente ligero (~200-300 KB).

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const ALTO_PAGINA = 792 // Carta estándar (points)
const ANCHO_PAGINA = 612 // Carta estándar (points)
const BASE = import.meta.env?.BASE_URL?.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env?.BASE_URL || '/'}`

// Colores institucionales oficiales ITD / TecNM
const NAVY = rgb(0.106, 0.224, 0.416) // #1B396A Azul marino institucional
const GUINDA = rgb(0.478, 0.094, 0.204) // #7A1834 Guinda ITD
const GRIS_BG = rgb(0.965, 0.973, 0.984) // #F6F8FA Fondo tenue
const GRIS_ZEBRA = rgb(0.98, 0.985, 0.99)
const GRIS_BORDE = rgb(0.82, 0.85, 0.89) // #D1D9E3
const GRIS_TEXTO = rgb(0.38, 0.42, 0.48) // #616B7A
const TEXTO = rgb(0.12, 0.15, 0.18) // #1F262E Texto oscuro principal
const BLANCO = rgb(1, 1, 1)

function y(top) {
  return ALTO_PAGINA - top
}

function esBufferPDF(buffer) {
  if (!buffer || buffer.byteLength < 5) return false
  const h = new Uint8Array(buffer.slice(0, 5))
  return h[0] === 37 && h[1] === 80 && h[2] === 68 && h[3] === 70 && h[4] === 45
}

async function cargarPlantillaOficio() {
  const rutas = [
    `${BASE}plantillas/oficio_registro_blanco.pdf`,
    `/plantillas/oficio_registro_blanco.pdf`,
    `./plantillas/oficio_registro_blanco.pdf`,
    `https://raw.githubusercontent.com/DA-itd/E/main/public/plantillas/oficio_registro_blanco.pdf`,
  ]

  for (const url of rutas) {
    try {
      const resp = await fetch(url)
      if (resp.ok) {
        const buffer = await resp.arrayBuffer()
        if (esBufferPDF(buffer)) {
          return await PDFDocument.load(buffer)
        }
      }
    } catch {
      // Intentar siguiente ruta silenciosamente
    }
  }

  // Fallback si no hay conexión ni archivo local
  const doc = await PDFDocument.create()
  doc.addPage([ANCHO_PAGINA, ALTO_PAGINA])
  return doc
}

function descargarBytes(bytes, nombreArchivo) {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Dibuja una tabla profesional en la página con anchos exactos, bordes y fondo.
 */
function dibujarTabla(page, {
  x = 52,
  top = 200,
  columnas = [],
  filas = [],
  headerBg = NAVY,
  headerColor = BLANCO,
  fontSize = 7.5,
  headerFontSize = 8,
  alturaFila = 14,
  alturaHeader = 16,
  fontNormal,
  fontBold,
}) {
  const anchoTotal = columnas.reduce((acc, c) => acc + c.ancho, 0)

  // 1. Cabecera
  const yHeader = y(top)
  page.drawRectangle({
    x,
    y: yHeader - alturaHeader + 4,
    width: anchoTotal,
    height: alturaHeader,
    color: headerBg,
  })

  let cursorX = x
  for (const col of columnas) {
    const texto = String(col.titulo || '')
    const anchoTexto = fontBold.widthOfTextAtSize(texto, headerFontSize)
    let textX = cursorX + 4
    if (col.align === 'center') {
      textX = cursorX + (col.ancho - anchoTexto) / 2
    } else if (col.align === 'right') {
      textX = cursorX + col.ancho - anchoTexto - 4
    }

    page.drawText(texto, {
      x: Math.max(cursorX + 2, textX),
      y: yHeader - (alturaHeader - 4) / 2 - 1,
      size: headerFontSize,
      font: fontBold,
      color: headerColor,
    })
    cursorX += col.ancho
  }

  // 2. Filas
  let yActualTop = top + alturaHeader
  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i]
    const esZebra = i % 2 === 1
    const yFila = y(yActualTop)

    // Fondo fila
    page.drawRectangle({
      x,
      y: yFila - alturaFila + 4,
      width: anchoTotal,
      height: alturaFila,
      color: fila.esTotal ? GRIS_BG : esZebra ? GRIS_ZEBRA : BLANCO,
      borderColor: GRIS_BORDE,
      borderWidth: 0.5,
    })

    let cellX = x
    for (let c = 0; c < columnas.length; c++) {
      const col = columnas[c]
      const val = fila.valores ? fila.valores[c] : fila[c]
      const texto = val === undefined || val === null ? '' : String(val)
      const fuenteCelda = fila.esTotal || col.bold ? fontBold : fontNormal
      const colorCelda = fila.esTotal ? NAVY : fila.color || TEXTO
      const anchoTexto = fuenteCelda.widthOfTextAtSize(texto, fontSize)

      let posX = cellX + 4
      if (col.align === 'center') {
        posX = cellX + (col.ancho - anchoTexto) / 2
      } else if (col.align === 'right') {
        posX = cellX + col.ancho - anchoTexto - 4
      }

      page.drawText(texto, {
        x: Math.max(cellX + 2, posX),
        y: yFila - (alturaFila - 4) / 2 - 1,
        size: fontSize,
        font: fuenteCelda,
        color: colorCelda,
      })

      // Línea divisoria vertical sutil
      if (c > 0) {
        page.drawLine({
          start: { x: cellX, y: yFila - alturaFila + 4 },
          end: { x: cellX, y: yFila + 4 },
          color: GRIS_BORDE,
          thickness: 0.4,
        })
      }

      cellX += col.ancho
    }

    yActualTop += alturaFila
  }

  // Borde exterior
  page.drawRectangle({
    x,
    y: y(yActualTop) + 4,
    width: anchoTotal,
    height: yActualTop - top,
    borderColor: NAVY,
    borderWidth: 0.75,
  })

  return yActualTop
}

/**
 * Genera el documento PDF del Reporte Ejecutivo TecNM y opcionalmente lo descarga.
 */
export async function generarReporteEjecutivoTecNM_PDF(reporte, opciones = {}) {
  const {
    tipoPeriodo = 'trimestre',
    anio = new Date().getFullYear(),
    trimestre = 1,
    tituloPeriodo = '',
    descargar = true,
  } = opciones

  const plantillaDoc = await cargarPlantillaOficio()
  const doc = await PDFDocument.create()

  // Clona la página con el membrete oficial para las 2 páginas requeridas
  const [p1] = await doc.copyPages(plantillaDoc, [0])
  const [p2] = await doc.copyPages(plantillaDoc, [0])
  doc.addPage(p1)
  doc.addPage(p2)

  const fontNormal = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique)
  const fontBoldItalic = await doc.embedFont(StandardFonts.HelveticaBoldOblique)

  // Metadatos
  const fechaHoy = new Date()
  const fechaStr = fechaHoy.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const esAcumulado =
    opciones.modalidad === 'acumulado' ||
    tipoPeriodo === 'anio' ||
    tipoPeriodo === 'acumulado' ||
    tipoPeriodo === 'acumulado_trimestre' ||
    Boolean(reporte.esAcumulado)

  const trimNum = trimestre || reporte.trimestre || reporte.trimestreAcumulado || 4
  const trimStr = esAcumulado
    ? (tipoPeriodo === 'anio' || trimNum >= 4 ? 'ACUMULADO-ANUAL' : `ACUMULADO-${trimNum}°T`)
    : `${trimNum}°T`
  const oficioNum = `ITD-CAD-REP-${trimStr}/${anio}`

  const asuntoTexto = esAcumulado
    ? 'ASUNTO: INFORME EJECUTIVO ACUMULADO DE FORMACIÓN Y ACTUALIZACIÓN DOCENTE (TecNM)'
    : 'ASUNTO: INFORME EJECUTIVO TRIMESTRAL DE FORMACIÓN Y ACTUALIZACIÓN DOCENTE (TecNM)'

  const subtituloPeriodo = tituloPeriodo || (
    esAcumulado
      ? `Reporte Acumulado ${trimNum >= 4 || tipoPeriodo === 'anio' ? 'Anual' : `al ${trimNum}° Trimestre`} ${anio}`
      : `${trimNum}° Trimestre ${anio}`
  )

  // ---------------------------------------------------------------------------
  // PÁGINA 1: ENCABEZADO OFICIAL, RESUMEN EJECUTIVO Y TABLAS GLOBALES
  // ---------------------------------------------------------------------------
  const xDerecha = 560
  function drawTextR(page, txt, top, f, sz, col = TEXTO) {
    const w = f.widthOfTextAtSize(String(txt || ''), sz)
    page.drawText(String(txt || ''), { x: xDerecha - w, y: y(top), size: sz, font: f, color: col })
  }

  // Encabezado institucional superior derecho (debajo del cintillo de logos oficial)
  drawTextR(p1, 'INSTITUTO TECNOLÓGICO DE DURANGO', 104, fontBold, 8.5, NAVY)
  drawTextR(p1, 'DEPARTAMENTO DE DESARROLLO ACADÉMICO', 114, fontNormal, 7.5, TEXTO)
  drawTextR(p1, 'COORDINACIÓN DE ACTUALIZACIÓN DOCENTE', 123, fontBold, 7.5, GUINDA)
  drawTextR(p1, `Durango, Dgo., a ${fechaStr}`, 134, fontNormal, 8, TEXTO)
  drawTextR(p1, `Oficio No. ${oficioNum}`, 144, fontBold, 8.5, NAVY)

  // Destinatario Oficial TecNM (Izquierda)
  let topCursor = 160
  p1.drawText('TECNOLÓGICO NACIONAL DE MÉXICO', { x: 52, y: y(topCursor), size: 9, font: fontBold, color: NAVY })
  topCursor += 11
  p1.drawText('DIRECCIÓN DE DOCENCIA E INNOVACIÓN EDUCATIVA', { x: 52, y: y(topCursor), size: 8, font: fontBold, color: TEXTO })
  topCursor += 10
  p1.drawText('Coordinación del Programa Institucional de Formación Docente', { x: 52, y: y(topCursor), size: 7.5, font: fontNormal, color: GRIS_TEXTO })
  topCursor += 10
  p1.drawText('P R E S E N T E .', { x: 52, y: y(topCursor), size: 8, font: fontBold, color: TEXTO })

  // Asunto
  topCursor += 16
  p1.drawRectangle({
    x: 52,
    y: y(topCursor + 18),
    width: 508,
    height: 22,
    color: GRIS_BG,
    borderColor: NAVY,
    borderWidth: 0.6,
  })
  p1.drawText(asuntoTexto, {
    x: 58,
    y: y(topCursor + 10),
    size: 7.5,
    font: fontBold,
    color: NAVY,
  })
  p1.drawText(`Periodo Evaluado: ${subtituloPeriodo} (${reporte.rango.inicio} al ${reporte.rango.fin})`, {
    x: 58,
    y: y(topCursor + 17),
    size: 7,
    font: fontNormal,
    color: GUINDA,
  })

  // Párrafo de apertura institucional
  topCursor += 25
  const parrafoIntro = esAcumulado
    ? `En cumplimiento a los lineamientos normativos emitidos por el Tecnológico Nacional de México (TecNM) para el Programa de Formación y Actualización Docente y Profesional, se rinde el informe de resultados acumulados alcanzados en el Instituto Tecnológico de Durango durante el periodo evaluado (${reporte.rango.inicio} al ${reporte.rango.fin}).`
    : `En cumplimiento a los lineamientos normativos emitidos por el Tecnológico Nacional de México (TecNM) para el Programa de Formación y Actualización Docente y Profesional, se rinden los resultados trimestrales alcanzados en el Instituto Tecnológico de Durango correspondientes al ${trimNum}° Trimestre de ${anio} (${reporte.rango.inicio} al ${reporte.rango.fin}).`

  // Dividir párrafo en 2 líneas
  p1.drawText(parrafoIntro.slice(0, 125), { x: 52, y: y(topCursor), size: 7.5, font: fontNormal, color: TEXTO })
  topCursor += 10
  p1.drawText(parrafoIntro.slice(125), { x: 52, y: y(topCursor), size: 7.5, font: fontNormal, color: TEXTO })

  // ---------------------------------------------------------------------------
  // TABLA I: INDICADORES GLOBALES DE COBERTURA Y PARTICIPACIÓN
  // ---------------------------------------------------------------------------
  topCursor += 16
  p1.drawText('1. INDICADORES GLOBALES DE PARTICIPACIÓN Y COBERTURA INSTITUCIONAL', {
    x: 52,
    y: y(topCursor),
    size: 8.5,
    font: fontBold,
    color: NAVY,
  })

  topCursor += 5
  const totalPlantilla = reporte.totalDocentesInstitucion || 417
  const cobertura = reporte.porcentajeParticipacion || 0
  const pctHombres = reporte.totalInscripciones
    ? ((reporte.porGenero.Hombre / reporte.totalInscripciones) * 100).toFixed(1)
    : '0'
  const pctMujeres = reporte.totalInscripciones
    ? ((reporte.porGenero.Mujer / reporte.totalInscripciones) * 100).toFixed(1)
    : '0'

  topCursor = dibujarTabla(p1, {
    x: 52,
    top: topCursor,
    columnas: [
      { titulo: 'Indicador Institucional (TecNM)', ancho: 250, align: 'left' },
      { titulo: 'Total Registrado', ancho: 120, align: 'center', bold: true },
      { titulo: 'Desglose / Proporción', ancho: 138, align: 'center' },
    ],
    filas: [
      { valores: ['Total de Inscripciones a Cursos', reporte.totalInscripciones, '100% de registros procesados'] },
      { valores: ['Docentes Únicos Participantes en el Periodo', reporte.docentesUnicos, `De una plantilla de ${totalPlantilla} docentes`] },
      { valores: ['Porcentaje de Cobertura de Plantilla Docente', `${cobertura}%`, cobertura >= 50 ? 'Meta TecNM Superada' : 'En progreso'] },
      { valores: ['Distribución por Género (Inscripciones)', `H: ${reporte.porGenero.Hombre}  |  M: ${reporte.porGenero.Mujer}`, `Hombres: ${pctHombres}%  |  Mujeres: ${pctMujeres}%`] },
      { valores: ['Distribución por Tipo de Capacitación', `Docente: ${reporte.porTipo.Docente}  |  Prof: ${reporte.porTipo.Profesional}`, `${reporte.porTipo.Docente + reporte.porTipo.Profesional} inscripciones acreditadas`] },
      { valores: ['Docentes sin Participación en el Periodo', reporte.sinParticipar.total, `Hombres: ${reporte.sinParticipar.porGenero.Hombre}  |  Mujeres: ${reporte.sinParticipar.porGenero.Mujer}`] },
    ],
    fontSize: 7.5,
    alturaFila: 14,
    alturaHeader: 16,
    fontNormal,
    fontBold,
  })

  // ---------------------------------------------------------------------------
  // TABLA II: CLASIFICACIÓN POR NIVEL DE ESTUDIOS Y EJES PRIORITARIOS TecNM
  // ---------------------------------------------------------------------------
  topCursor += 16
  p1.drawText('2. DESGLOSE POR NIVEL ACADÉMICO Y EJES ESTRATÉGICOS TecNM', {
    x: 52,
    y: y(topCursor),
    size: 8.5,
    font: fontBold,
    color: NAVY,
  })

  topCursor += 5
  const totLic = reporte.licenciatura.total || 0
  const totPos = reporte.posgrado.total || 0
  const totGeneral = totLic + totPos

  topCursor = dibujarTabla(p1, {
    x: 52,
    top: topCursor,
    columnas: [
      { titulo: 'Nivel Educativo', ancho: 120, align: 'left', bold: true },
      { titulo: 'Total', ancho: 45, align: 'center', bold: true },
      { titulo: 'Hombres', ancho: 50, align: 'center' },
      { titulo: 'Mujeres', ancho: 50, align: 'center' },
      { titulo: 'T. Docente', ancho: 58, align: 'center' },
      { titulo: 'T. Prof.', ancho: 55, align: 'center' },
      { titulo: 'Hab. Digitales', ancho: 65, align: 'center' },
      { titulo: 'Salud Emocional', ancho: 65, align: 'center' },
    ],
    filas: [
      {
        valores: [
          'Licenciatura',
          totLic,
          reporte.licenciatura.porGenero.Hombre,
          reporte.licenciatura.porGenero.Mujer,
          reporte.licenciatura.porTipo.Docente,
          reporte.licenciatura.porTipo.Profesional,
          reporte.licenciatura.habilidadesDigitales,
          reporte.licenciatura.saludEmocional,
        ],
      },
      {
        valores: [
          'Posgrado (M/D)',
          totPos,
          reporte.posgrado.porGenero.Hombre,
          reporte.posgrado.porGenero.Mujer,
          reporte.posgrado.porTipo.Docente,
          reporte.posgrado.porTipo.Profesional,
          reporte.posgrado.habilidadesDigitales,
          reporte.posgrado.saludEmocional,
        ],
      },
      {
        esTotal: true,
        valores: [
          'TOTAL ACUMULADO',
          totGeneral,
          reporte.licenciatura.porGenero.Hombre + reporte.posgrado.porGenero.Hombre,
          reporte.licenciatura.porGenero.Mujer + reporte.posgrado.porGenero.Mujer,
          reporte.licenciatura.porTipo.Docente + reporte.posgrado.porTipo.Docente,
          reporte.licenciatura.porTipo.Profesional + reporte.posgrado.porTipo.Profesional,
          reporte.licenciatura.habilidadesDigitales + reporte.posgrado.habilidadesDigitales,
          reporte.licenciatura.saludEmocional + reporte.posgrado.saludEmocional,
        ],
      },
    ],
    headerBg: GUINDA,
    fontSize: 7.5,
    alturaFila: 14,
    alturaHeader: 16,
    fontNormal,
    fontBold,
  })

  // Pie de página 1
  p1.drawText('Instituto Tecnológico de Durango · Desarrollo Académico · Actualización Docente', {
    x: 52,
    y: y(708),
    size: 7,
    font: fontNormal,
    color: GRIS_TEXTO,
  })
  p1.drawText('Página 1 de 2', {
    x: 512,
    y: y(708),
    size: 7,
    font: fontBold,
    color: GRIS_TEXTO,
  })

  // ---------------------------------------------------------------------------
  // PÁGINA 2: INTENSIDAD, CURSOS DEMANDADOS, DEPARTAMENTOS Y FIRMAS
  // ---------------------------------------------------------------------------
  drawTextR(p2, 'INSTITUTO TECNOLÓGICO DE DURANGO', 104, fontBold, 8.5, NAVY)
  drawTextR(p2, 'COORDINACIÓN DE ACTUALIZACIÓN DOCENTE', 114, fontBold, 7.5, GUINDA)
  drawTextR(p2, `Continuación Informe Ejecutivo TecNM (${esAcumulado ? 'Acumulado' : 'Trimestral'}) · Oficio No. ${oficioNum}`, 124, fontNormal, 7.5, TEXTO)

  let topCursor2 = 145

  // ---------------------------------------------------------------------------
  // TABLA III: DISTRIBUCIÓN POR INTENSIDAD DE CURSOS TOMADOS
  // ---------------------------------------------------------------------------
  p2.drawText('3. DISTRIBUCIÓN POR NÚMERO DE CURSOS TOMADOS POR DOCENTE (INTENSIDAD)', {
    x: 52,
    y: y(topCursor2),
    size: 8.5,
    font: fontBold,
    color: NAVY,
  })

  topCursor2 += 5
  const dist = reporte.distribucionPorNumeroCursos || {}
  const totalDocentesPart = reporte.docentesUnicos || 1
  function pct(num) {
    return `${(((num || 0) / totalDocentesPart) * 100).toFixed(1)}%`
  }

  topCursor2 = dibujarTabla(p2, {
    x: 52,
    top: topCursor2,
    columnas: [
      { titulo: 'Carga de Cursos en el Periodo', ancho: 190, align: 'left' },
      { titulo: 'Número de Docentes', ancho: 150, align: 'center', bold: true },
      { titulo: '% Respecto a Participantes', ancho: 168, align: 'center' },
    ],
    filas: [
      { valores: ['1 curso completado', dist[1] || 0, pct(dist[1])] },
      { valores: ['2 cursos completados', dist[2] || 0, pct(dist[2])] },
      { valores: ['3 cursos completados', dist[3] || 0, pct(dist[3])] },
      { valores: ['4 cursos completados', dist[4] || 0, pct(dist[4])] },
      { valores: ['5 cursos completados', dist[5] || 0, pct(dist[5])] },
      { valores: ['6 o más cursos completados', dist['6+'] || 0, pct(dist['6+'])] },
      {
        esTotal: true,
        valores: ['TOTAL DOCENTES PARTICIPANTES', reporte.docentesUnicos, '100.0%'],
      },
    ],
    fontSize: 7.2,
    alturaFila: 12.5,
    alturaHeader: 15,
    fontNormal,
    fontBold,
  })

  // ---------------------------------------------------------------------------
  // TABLA IV: CURSOS DE MAYOR DEMANDA E IMPACTO (TOP CURSOS)
  // ---------------------------------------------------------------------------
  topCursor2 += 14
  p2.drawText('4. CURSOS CON MAYOR DEMANDA E IMPACTO INSTITUCIONAL', {
    x: 52,
    y: y(topCursor2),
    size: 8.5,
    font: fontBold,
    color: NAVY,
  })

  topCursor2 += 5
  const topCursos = (reporte.cursosMasDemandados || []).slice(0, 5)
  topCursor2 = dibujarTabla(p2, {
    x: 52,
    top: topCursor2,
    columnas: [
      { titulo: 'Nombre del Curso Acreditado', ancho: 320, align: 'left' },
      { titulo: 'Total Inscritos', ancho: 70, align: 'center', bold: true },
      { titulo: 'Hombres', ancho: 59, align: 'center' },
      { titulo: 'Mujeres', ancho: 59, align: 'center' },
    ],
    filas: topCursos.map((c) => ({
      valores: [
        c.nombre?.length > 58 ? `${c.nombre.slice(0, 56)}…` : c.nombre,
        c.cantidad,
        c.Hombre || 0,
        c.Mujer || 0,
      ],
    })),
    fontSize: 7,
    alturaFila: 12,
    alturaHeader: 14,
    fontNormal,
    fontBold,
  })

  // ---------------------------------------------------------------------------
  // TABLA V: RESUMEN DE PARTICIPACIÓN POR DEPARTAMENTO ACADÉMICO
  // ---------------------------------------------------------------------------
  topCursor2 += 14
  p2.drawText('5. PARTICIPACIÓN POR DEPARTAMENTO ACADÉMICO (RESUMEN)', {
    x: 52,
    y: y(topCursor2),
    size: 8.5,
    font: fontBold,
    color: NAVY,
  })

  topCursor2 += 5
  const topDeptos = (reporte.porDepartamento || []).slice(0, 5)
  const totalDeptosInsc = reporte.totalInscripciones || 1

  topCursor2 = dibujarTabla(p2, {
    x: 52,
    top: topCursor2,
    columnas: [
      { titulo: 'Departamento Académico', ancho: 360, align: 'left' },
      { titulo: 'Inscripciones', ancho: 74, align: 'center', bold: true },
      { titulo: '% Participación', ancho: 74, align: 'center' },
    ],
    filas: topDeptos.map((d) => ({
      valores: [
        d.nombre?.length > 60 ? `${d.nombre.slice(0, 58)}…` : d.nombre,
        d.cantidad,
        `${(((d.cantidad || 0) / totalDeptosInsc) * 100).toFixed(1)}%`,
      ],
    })),
    headerBg: GUINDA,
    fontSize: 7,
    alturaFila: 12,
    alturaHeader: 14,
    fontNormal,
    fontBold,
  })

  // ---------------------------------------------------------------------------
  // SECCIÓN DE VALIDACIÓN Y FIRMAS OFICIALES INSTITUCIONALES
  // ---------------------------------------------------------------------------
  topCursor2 += 14
  p2.drawText('A T E N T A M E N T E', {
    x: 52,
    y: y(topCursor2),
    size: 8,
    font: fontBold,
    color: NAVY,
  })
  topCursor2 += 9
  p2.drawText('Excelencia en Educación Tecnológica®   |   La Técnica al Servicio de la Patria', {
    x: 52,
    y: y(topCursor2),
    size: 7,
    font: fontBoldItalic,
    color: GUINDA,
  })

  // 3 Bloques de firmas alineados horizontalmente
  topCursor2 += 36
  const yLineasFirma = y(topCursor2)

  // Firma 1: Coordinador
  p2.drawLine({
    start: { x: 52, y: yLineasFirma },
    end: { x: 200, y: yLineasFirma },
    color: NAVY,
    thickness: 0.8,
  })
  p2.drawText('M.C. Alejandro Calderón Rentería', {
    x: 52,
    y: yLineasFirma - 9,
    size: 7.2,
    font: fontBold,
    color: TEXTO,
  })
  p2.drawText('Coordinador de Actualización Docente', {
    x: 52,
    y: yLineasFirma - 17,
    size: 6.5,
    font: fontNormal,
    color: GRIS_TEXTO,
  })

  // Firma 2: Jefa de Departamento
  p2.drawLine({
    start: { x: 215, y: yLineasFirma },
    end: { x: 375, y: yLineasFirma },
    color: NAVY,
    thickness: 0.8,
  })
  p2.drawText('M.C. Mónica Rosales Pérez', {
    x: 215,
    y: yLineasFirma - 9,
    size: 7.2,
    font: fontBold,
    color: TEXTO,
  })
  p2.drawText('Jefa del Depto. de Desarrollo Académico', {
    x: 215,
    y: yLineasFirma - 17,
    size: 6.5,
    font: fontNormal,
    color: GRIS_TEXTO,
  })

  // Firma 3: Subdirección Académica
  p2.drawLine({
    start: { x: 390, y: yLineasFirma },
    end: { x: 558, y: yLineasFirma },
    color: NAVY,
    thickness: 0.8,
  })
  p2.drawText('Dra. Adriana Eréndira Murillo', {
    x: 390,
    y: yLineasFirma - 9,
    size: 7.2,
    font: fontBold,
    color: TEXTO,
  })
  p2.drawText('Subdirectora Académica (Vo.Bo.)', {
    x: 390,
    y: yLineasFirma - 17,
    size: 6.5,
    font: fontNormal,
    color: GRIS_TEXTO,
  })

  // Leyendas finales c.c.p.
  const yCcp = yLineasFirma - 28
  p2.drawText('c.c.p. Dirección del Instituto Tecnológico de Durango   ·   c.c.p. TecNM Dirección de Docencia   ·   c.c.p. Archivo', {
    x: 52,
    y: yCcp,
    size: 6,
    font: fontNormal,
    color: GRIS_TEXTO,
  })

  // Pie de página 2
  p2.drawText('Instituto Tecnológico de Durango · Desarrollo Académico · Actualización Docente', {
    x: 52,
    y: y(708),
    size: 7,
    font: fontNormal,
    color: GRIS_TEXTO,
  })
  p2.drawText('Página 2 de 2', {
    x: 512,
    y: y(708),
    size: 7,
    font: fontBold,
    color: GRIS_TEXTO,
  })

  const bytes = await doc.save()

  const nombreArchivo = `Reporte_Ejecutivo_TecNM_${
    esAcumulado
      ? (tipoPeriodo === 'anio' || trimNum >= 4 ? 'Acumulado_Anual' : `Acumulado_${trimNum}T`)
      : `${trimStr}`
  }_${anio}.pdf`

  if (descargar) {
    descargarBytes(bytes, nombreArchivo)
  }

  return {
    doc,
    bytes,
    nombreArchivo,
  }
}
