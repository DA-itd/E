import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const BASE = import.meta.env.BASE_URL?.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL || '/'}`

// Rutas locales y remotas con múltiples respaldos para asegurar que carguen siempre
const RUTAS_LOGO_TECNM = [
  `${BASE}logos/logo-tecnm.jpg`,
  `/logos/logo-tecnm.jpg`,
  'https://raw.githubusercontent.com/DA-itd/E/main/public/logos/logo-tecnm.jpg',
  'https://raw.githubusercontent.com/DA-itd/E/main/public/logos/logo-tecnm.png',
  'https://raw.githubusercontent.com/DA-itd/E/main/LOGO_tecnm.jpg',
]

const RUTAS_LOGO_ITD = [
  `${BASE}logo_itdurango.png`,
  `/logo_itdurango.png`,
  'https://raw.githubusercontent.com/DA-itd/E/main/public/logo_itdurango.png',
  'https://raw.githubusercontent.com/DA-itd/E/main/logo_itdurango.png',
  'https://github.com/DA-itd/E/blob/main/logo_itdurango.png?raw=true',
]

let cacheLogoTecnm = null
let cacheLogoItd = null

async function cargarImagenBase64(rutas) {
  const lista = Array.isArray(rutas) ? rutas : [rutas]
  for (const url of lista) {
    if (!url) continue
    try {
      const res = await fetch(url)
      if (res && res.ok) {
        const blob = await res.blob()
        if (blob.size > 100) {
          return await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
        }
      }
    } catch {
      // Probar siguiente alternativa silenciosamente
    }
  }
  return null
}

/**
 * Genera y descarga el Kardex (historial de cursos) en PDF para el docente
 * con ambos logos oficiales (TecNM a la izquierda e ITD a la derecha).
 */
export async function descargarKardexPDF(docente, cursos) {
  const doc = new jsPDF('p', 'mm', 'letter')
  const pageWidth = doc.internal.pageSize.getWidth()

  // 1. Cargar ambos logotipos con caché
  if (!cacheLogoTecnm) {
    cacheLogoTecnm = await cargarImagenBase64(RUTAS_LOGO_TECNM)
  }
  if (!cacheLogoItd) {
    cacheLogoItd = await cargarImagenBase64(RUTAS_LOGO_ITD)
  }

  // 2. Dibujar Logo TecNM (Izquierda)
  if (cacheLogoTecnm) {
    try {
      const formatoTecnm = cacheLogoTecnm.includes('image/png') ? 'PNG' : 'JPEG'
      doc.addImage(cacheLogoTecnm, formatoTecnm, 14, 8, 32, 14)
    } catch (e) {
      console.warn('Error al dibujar logo TecNM en Kardex:', e)
    }
  }

  // 3. Dibujar Logo ITD (Derecha)
  if (cacheLogoItd) {
    try {
      const formatoItd = cacheLogoItd.includes('image/jpeg') ? 'JPEG' : 'PNG'
      doc.addImage(cacheLogoItd, formatoItd, pageWidth - 33, 6, 19, 22.5)
    } catch (e) {
      console.warn('Error al dibujar logo ITD en Kardex:', e)
    }
  }

  // 4. Encabezados institucionales centrados
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(27, 57, 106)
  doc.text('INSTITUTO TECNOLÓGICO DE DURANGO', pageWidth / 2, 17, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)
  doc.text('Coordinación de Actualización Docente', pageWidth / 2, 23, { align: 'center' })

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(128, 0, 0)
  doc.text('HISTORIAL DE CURSOS', pageWidth / 2, 32, { align: 'center' })

  // Línea divisoria decorativa
  doc.setDrawColor(27, 57, 106)
  doc.setLineWidth(0.5)
  doc.line(14, 35, pageWidth - 14, 35)

  // 5. Datos del docente
  doc.setTextColor(0)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Docente:', 14, 42)
  doc.setFont('helvetica', 'normal')
  doc.text(docente.nombre_completo || 'No especificado', 33, 42)

  const hoy = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
  doc.setFont('helvetica', 'bold')
  doc.text('Fecha de emisión:', 14, 47)
  doc.setFont('helvetica', 'normal')
  doc.text(hoy, 48, 47)

  // 6. Tabla de cursos
  const tableBody =
    cursos.length > 0
      ? cursos.map((c) => [c.anio || 'N/A', c.folio || 'N/A', c.curso || 'N/A', c.fechas || 'N/A', c.horas || 'N/A', c.tipo || 'N/A', c.departamento || 'N/A'])
      : [['N/A', 'N/A', 'Sin cursos registrados', 'N/A', 'N/A', 'N/A', 'N/A']]

  autoTable(doc, {
    head: [['Año', 'Folio', 'Curso', 'Fechas', 'Hrs', 'Tipo', 'Depto. Origen']],
    body: tableBody,
    startY: 52,
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

  // Pie de página
  const pageCount = doc.internal.getNumberOfPages()
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text(`Página 1 de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' })

  doc.save(`Kardex_${(docente.nombre_completo || 'docente').replace(/\s+/g, '_')}.pdf`)
}
