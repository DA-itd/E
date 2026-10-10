import { HEADER_OFICIO_BASE64, FOOTER_OFICIO_BASE64 } from './plantillaMembrete.js'

// Proporciones reales del membrete (px de la plantilla carta a 150 dpi: 1275 x 1650)
const HEADER_RATIO = 210 / 1275
const FOOTER_RATIO = 230 / 1275

/** Detecta el formato de imagen (PNG/JPEG) a partir del data URL. */
function formatoImagen(src) {
  const m = /^data:image\/(png|jpe?g|webp)/i.exec(src || '')
  if (!m) return 'PNG'
  const f = m[1].toUpperCase()
  return f === 'JPG' ? 'JPEG' : f
}

/** Medidas del membrete para un documento dado (mm). */
export function medidasMembrete(doc) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const headerHeight = pageWidth * HEADER_RATIO
  const footerHeight = pageWidth * FOOTER_RATIO
  return {
    pageWidth,
    pageHeight,
    headerHeight,
    footerHeight,
    // Zona libre para contenido
    topSeguro: headerHeight + 6,
    bottomSeguro: footerHeight + 4,
  }
}

/**
 * Dibuja membrete superior e inferior en la página ACTUAL del documento.
 * Úsalo en cada página (por ejemplo desde didDrawPage de autoTable).
 */
export function dibujarMembretePagina(doc) {
  const { pageWidth, pageHeight, headerHeight, footerHeight } = medidasMembrete(doc)

  try {
    doc.addImage(HEADER_OFICIO_BASE64, formatoImagen(HEADER_OFICIO_BASE64), 0, 0, pageWidth, headerHeight, 'membrete-sup', 'FAST')
  } catch (e) {
    console.error('[membrete] No se pudo dibujar el encabezado:', e)
    doc.setFillColor(27, 57, 106)
    doc.rect(0, 0, pageWidth, 6, 'F')
    doc.setFillColor(159, 34, 65)
    doc.rect(0, 6, pageWidth, 2.5, 'F')
  }

  try {
    doc.addImage(FOOTER_OFICIO_BASE64, formatoImagen(FOOTER_OFICIO_BASE64), 0, pageHeight - footerHeight, pageWidth, footerHeight, 'membrete-inf', 'FAST')
  } catch (e) {
    console.error('[membrete] No se pudo dibujar el pie:', e)
    doc.setFillColor(159, 34, 65)
    doc.rect(0, pageHeight - 4, pageWidth, 1.5, 'F')
    doc.setFillColor(27, 57, 106)
    doc.rect(0, pageHeight - 2.5, pageWidth, 2.5, 'F')
  }
}

/**
 * Crea un documento carta (la plantilla institucional es tamaño carta).
 */
export function crearDocumentoCarta(jsPDFClass, opciones = {}) {
  return new jsPDFClass({ unit: 'mm', format: 'letter', ...opciones })
}

/**
 * Dibuja membrete en la primera página + título/subtítulos.
 * @returns {Promise<number>} Y donde inicia el contenido
 */
export async function dibujarEncabezadoPDF(doc, titulo, subtitulos = []) {
  const { pageWidth, headerHeight } = medidasMembrete(doc)
  dibujarMembretePagina(doc)

  const marginX = 20
  let y = headerHeight + 8
  if (titulo) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(27, 57, 106)
    doc.text(titulo, marginX, y)
    y += 5.5
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(71, 85, 105)
  for (const sub of subtitulos) {
    doc.text(sub, marginX, y)
    y += 4.5
  }

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.5)
  doc.line(marginX, y + 1, pageWidth - marginX, y + 1)

  return y + 6
}

/**
 * Opciones de autoTable para que la tabla respete membrete en TODAS las páginas.
 * Uso: autoTable(doc, { startY, ...opcionesTablaMembrete(doc), head, body, ... })
 */
export function opcionesTablaMembrete(doc) {
  const { topSeguro, bottomSeguro } = medidasMembrete(doc)
  return {
    margin: { top: topSeguro, bottom: bottomSeguro, left: 20, right: 20 },
    didDrawPage: () => {
      // La página 1 ya tiene membrete, pero redibujar es inocuo (mismo alias de imagen);
      // en páginas 2+ es lo que lo agrega.
      dibujarMembretePagina(doc)
    },
  }
}