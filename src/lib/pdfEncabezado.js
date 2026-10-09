import { HEADER_OFICIO_BASE64, FOOTER_OFICIO_BASE64 } from './plantillaMembrete'

/**
 * Dibuja el membrete institucional oficial en el documento jsPDF.
 * @param {import('jspdf').jsPDF} doc
 * @param {string} titulo
 * @param {string[]} subtitulos
 * @returns {Promise<number>} posición Y donde inicia el contenido
 */
export async function dibujarEncabezadoPDF(doc, titulo, subtitulos = []) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Membrete Superior Oficial (ancho completo)
  const headerHeight = (pageWidth * 210) / 1275
  try {
    doc.addImage(HEADER_OFICIO_BASE64, 'PNG', 0, 0, pageWidth, headerHeight, undefined, 'FAST')
  } catch {
    // Respaldo de dibujo vectorial si no estuviera disponible la imagen
    doc.setFillColor(27, 57, 106)
    doc.rect(0, 0, pageWidth, 6, 'F')
    doc.setFillColor(159, 34, 65)
    doc.rect(0, 6, pageWidth, 2.5, 'F')
  }

  // Membrete Inferior Oficial
  const footerHeight = (pageWidth * 230) / 1275
  const footerY = pageHeight - footerHeight
  try {
    doc.addImage(FOOTER_OFICIO_BASE64, 'PNG', 0, footerY, pageWidth, footerHeight, undefined, 'FAST')
  } catch {
    doc.setFillColor(159, 34, 65)
    doc.rect(0, pageHeight - 4, pageWidth, 1.5, 'F')
    doc.setFillColor(27, 57, 106)
    doc.rect(0, pageHeight - 2.5, pageWidth, 2.5, 'F')
  }

  // Título institucional bajo el membrete
  let y = headerHeight + 5
  if (titulo) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(27, 57, 106)
    doc.text(titulo, 14, y)
    y += 5
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(71, 85, 105)
  for (const sub of subtitulos) {
    doc.text(sub, 14, y)
    y += 4.5
  }

  // Línea divisoria
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.5)
  doc.line(14, y + 1, pageWidth - 14, y + 1)

  return y + 6
}

