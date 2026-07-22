import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const LOGO_ITD = 'https://raw.githubusercontent.com/DA-itd/E/main/logo%20itd%20original.jpg'

async function imagenABase64(url) {
  try {
    const resp = await fetch(url)
    const blob = await resp.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Genera y descarga el Kardex (historial de cursos) en PDF para el docente
 * y la lista de cursos que se le pasen -- reutilizable desde "Mi historial"
 * o desde la búsqueda de administrador.
 */
export async function descargarKardexPDF(docente, cursos) {
  const doc = new jsPDF('p', 'mm', 'letter')
  const pageWidth = doc.internal.pageSize.getWidth()

  const logo = await imagenABase64(LOGO_ITD)
  if (logo) {
    try {
      doc.addImage(logo, 'JPEG', pageWidth - 35, 10, 25, 25)
    } catch {
      // si el formato de imagen no coincide, se omite el logo sin romper el PDF
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(27, 57, 106)
  doc.text('INSTITUTO TECNOLÓGICO DE DURANGO', pageWidth / 2, 18, { align: 'center' })
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text('Coordinación de Actualización Docente', pageWidth / 2, 23, { align: 'center' })
  doc.setFontSize(13)
  doc.setTextColor(128, 0, 0)
  doc.text('HISTORIAL DE CURSOS', pageWidth / 2, 32, { align: 'center' })

  doc.setTextColor(0)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Docente:', 14, 41)
  doc.setFont('helvetica', 'normal')
  doc.text(docente.nombre_completo || 'No especificado', 33, 41)

  const hoy = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
  doc.setFont('helvetica', 'bold')
  doc.text('Fecha de emisión:', 14, 46)
  doc.setFont('helvetica', 'normal')
  doc.text(hoy, 48, 46)

  const tableBody =
    cursos.length > 0
      ? cursos.map((c) => [c.anio || 'N/A', c.folio || 'N/A', c.curso || 'N/A', c.fechas || 'N/A', c.horas || 'N/A', c.tipo || 'N/A', c.departamento || 'N/A'])
      : [['N/A', 'N/A', 'Sin cursos registrados', 'N/A', 'N/A', 'N/A', 'N/A']]

  autoTable(doc, {
    head: [['Año', 'Folio', 'Curso', 'Fechas', 'Hrs', 'Tipo', 'Depto. Origen']],
    body: tableBody,
    startY: 51,
    theme: 'striped',
    headStyles: { fillColor: [27, 57, 106], textColor: 255, fontSize: 8, halign: 'center' },
    styles: { fontSize: 7, cellPadding: 1.8, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 25, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 25 },
      4: { cellWidth: 10, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 30, halign: 'left' },
    },
  })

  const pageCount = doc.internal.getNumberOfPages()
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text(`Página 1 de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' })

  doc.save(`Kardex_${(docente.nombre_completo || 'docente').replace(/\s+/g, '_')}.pdf`)
}
