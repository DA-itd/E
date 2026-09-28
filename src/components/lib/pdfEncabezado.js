// src/lib/pdfEncabezado.js
// Helper compartido para dibujar el encabezado (logo TecNM + logo ITD +
// título) en cualquier PDF del sistema (reporte de inscripciones,
// reporte de encuesta, etc.), para que todos los PDF se vean iguales.

export const URL_LOGO_TECNM = 'https://raw.githubusercontent.com/DA-itd/E/main/LOGO_tecnm.jpg'
export const URL_LOGO_ITD = 'https://raw.githubusercontent.com/DA-itd/E/main/logo_itdurango.png'
export const URL_LOGO_ITD_FALLBACK = 'https://github.com/DA-itd/E/blob/main/logo_itdurango.png?raw=true'
export const RUTA_LOCAL_LOGO_ITD = `${import.meta.env.BASE_URL || '/'}logo_itdurango.png`

async function fetchConFallback(url, fallbacks = []) {
  try {
    const res = await fetch(url)
    if (res && res.ok) return res
  } catch {
    // ignorar y probar alternativas
  }
  for (const fb of fallbacks) {
    try {
      const res = await fetch(fb)
      if (res && res.ok) return res
    } catch {
      // continuar con la siguiente
    }
  }
  throw new Error(`No se pudo cargar la imagen: ${url}`)
}

export async function cargarImagenBase64(url) {
  const fallbacks = url === URL_LOGO_ITD ? [RUTA_LOCAL_LOGO_ITD, URL_LOGO_ITD_FALLBACK] : []
  const res = await fetchConFallback(url, fallbacks)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function cargarImagenArrayBuffer(url) {
  const fallbacks = url === URL_LOGO_ITD ? [RUTA_LOCAL_LOGO_ITD, URL_LOGO_ITD_FALLBACK] : []
  const res = await fetchConFallback(url, fallbacks)
  return res.arrayBuffer()
}

// Dibuja el logo del TecNM (izquierda), el del ITD (derecha) y el título
// centrado en la parte superior del PDF. Devuelve el startY sugerido para
// la tabla que sigue (autoTable), dejando espacio debajo del encabezado.
export async function dibujarEncabezadoPDF(doc, titulo, subtitulos = []) {
  try {
    const [logoTecnm, logoItd] = await Promise.all([
      cargarImagenBase64(URL_LOGO_TECNM),
      cargarImagenBase64(URL_LOGO_ITD),
    ])
    doc.addImage(logoTecnm, 'JPEG', 14, 8, 32, 14)
    doc.addImage(logoItd, 'PNG', 181, 5, 17, 20)
  } catch (err) {
    console.warn('No se pudieron cargar los logotipos para el PDF:', err)
  }

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(titulo, 105, 15, { align: 'center' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  let y = 21
  for (const linea of subtitulos) {
    doc.text(linea, 105, y, { align: 'center' })
    y += 5
  }
  doc.setDrawColor(27, 57, 106)
  doc.line(14, y + 1, 196, y + 1)

  return y + 6
}