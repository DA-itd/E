import { HEADER_OFICIO_BASE64, FOOTER_OFICIO_BASE64, HEADER_RATIO, FOOTER_RATIO } from './plantillaMembrete.js'

/**
 * MEMBRETE POR AÑO (igual que las constancias)
 * --------------------------------------------
 * Para un año nuevo basta con subir  public/plantillas/membrete_2027.png  (o .jpg/.jpeg):
 * una página carta con el membrete y el cuerpo en blanco. El sistema detecta solo el
 * alto del encabezado y del pie y los recorta. Si no existe el archivo del año, usa el
 * membrete incrustado en plantillaMembrete.js (2026).
 */
const BASE = import.meta.env?.BASE_URL || '/'
const ANIO_BASE = 2026
export const MARGEN_X = 14

const MEMBRETE_BASE = {
  anio: ANIO_BASE,
  header: HEADER_OFICIO_BASE64,
  footer: FOOTER_OFICIO_BASE64,
  headerRatio: HEADER_RATIO,
  footerRatio: FOOTER_RATIO,
  origen: 'incrustado',
}

const cache = new Map() // año -> Promise<membrete>

/** Pura y testeable: alto (px) del encabezado y del pie en una plantilla en blanco. */
export function detectarBandas(data, W, H, canales = 4) {
  const filaConContenido = (y) => {
    const base = y * W * canales
    for (let x = 0; x < W; x++) {
      const i = base + x * canales
      if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) return true
    }
    return false
  }
  const pad = Math.round(W * 0.005)
  let ultima = -1
  for (let y = 0; y < H / 2; y++) if (filaConContenido(y)) ultima = y
  let primera = -1
  for (let y = H - 1; y >= H / 2; y--) if (filaConContenido(y)) primera = y
  if (ultima < 0 || primera < 0) return null
  return {
    headerPx: Math.min(Math.floor(H / 2), ultima + 1 + pad),
    footerPx: Math.min(Math.floor(H / 2), H - (primera - pad)),
  }
}

async function recortarMembrete(blob, anio) {
  const bmp = await createImageBitmap(blob)
  const W = bmp.width
  const H = bmp.height
  const lienzo = document.createElement('canvas')
  lienzo.width = W
  lienzo.height = H
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(bmp, 0, 0)
  const bandas = detectarBandas(ctx.getImageData(0, 0, W, H).data, W, H, 4)
  if (!bandas) throw new Error('La plantilla parece estar vacía (sin encabezado ni pie)')

  const cortar = (y, alto) => {
    const c = document.createElement('canvas')
    c.width = W
    c.height = alto
    c.getContext('2d').drawImage(lienzo, 0, y, W, alto, 0, 0, W, alto)
    return c.toDataURL('image/png')
  }
  return {
    anio,
    header: cortar(0, bandas.headerPx),
    footer: cortar(H - bandas.footerPx, bandas.footerPx),
    headerRatio: bandas.headerPx / W,
    footerRatio: bandas.footerPx / W,
    origen: 'archivo',
  }
}

async function cargarMembreteAnio(anio) {
  if (typeof document !== 'undefined') {
    for (const ext of ['png', 'jpg', 'jpeg']) {
      try {
        const resp = await fetch(`${BASE}plantillas/membrete_${anio}.${ext}`)
        if (!resp.ok) continue
        const blob = await resp.blob()
        // Evita falsos positivos: el router de la SPA devuelve index.html para rutas inexistentes
        if (!String(blob.type).startsWith('image/')) continue
        return await recortarMembrete(blob, anio)
      } catch (e) {
        console.warn(`[membrete] No se pudo usar membrete_${anio}.${ext}:`, e)
      }
    }
  }
  if (anio !== ANIO_BASE) {
    console.warn(`[membrete] No hay plantillas/membrete_${anio}.png; se usa el membrete base ${ANIO_BASE}.`)
  }
  return { ...MEMBRETE_BASE }
}

/** Membrete (imágenes + proporciones) para un año. Por defecto, el año actual. */
export function obtenerMembrete(anio) {
  const a = Number(anio) || new Date().getFullYear()
  if (!cache.has(a)) cache.set(a, cargarMembreteAnio(a))
  return cache.get(a)
}

/** Asocia el membrete del año a un documento jsPDF (hay que llamarla una vez, con await). */
export async function prepararMembrete(doc, anio) {
  doc.__membrete = await obtenerMembrete(anio)
  return doc.__membrete
}

function membreteDe(doc) {
  return doc.__membrete || MEMBRETE_BASE
}

/** Detecta el formato de imagen (PNG/JPEG) a partir del data URL. */
function formatoImagen(src) {
  const m = /^data:image\/(png|jpe?g|webp)/i.exec(src || '')
  if (!m) return 'PNG'
  const f = m[1].toUpperCase()
  return f === 'JPG' ? 'JPEG' : f
}

/** Medidas del membrete para un documento dado (mm). */
export function medidasMembrete(doc) {
  const mem = membreteDe(doc)
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const headerHeight = pageWidth * mem.headerRatio
  const footerHeight = pageWidth * mem.footerRatio
  return {
    pageWidth,
    pageHeight,
    headerHeight,
    footerHeight,
    topSeguro: headerHeight + 6,
    bottomSeguro: footerHeight + 4,
  }
}

/** Dibuja membrete superior e inferior en la página ACTUAL (una sola vez por página). */
export function dibujarMembretePagina(doc) {
  const nPag = doc.internal.getCurrentPageInfo().pageNumber
  doc.__membretePags = doc.__membretePags || new Set()
  if (doc.__membretePags.has(nPag)) return
  doc.__membretePags.add(nPag)

  const mem = membreteDe(doc)
  const { pageWidth, pageHeight, headerHeight, footerHeight } = medidasMembrete(doc)
  const alias = `membrete-${mem.anio}`

  try {
    doc.addImage(mem.header, formatoImagen(mem.header), 0, 0, pageWidth, headerHeight, `${alias}-sup`, 'FAST')
  } catch (e) {
    console.error('[membrete] No se pudo dibujar el encabezado:', e)
    doc.setFillColor(27, 57, 106)
    doc.rect(0, 0, pageWidth, 6, 'F')
    doc.setFillColor(159, 34, 65)
    doc.rect(0, 6, pageWidth, 2.5, 'F')
  }

  try {
    doc.addImage(mem.footer, formatoImagen(mem.footer), 0, pageHeight - footerHeight, pageWidth, footerHeight, `${alias}-inf`, 'FAST')
  } catch (e) {
    console.error('[membrete] No se pudo dibujar el pie:', e)
    doc.setFillColor(159, 34, 65)
    doc.rect(0, pageHeight - 4, pageWidth, 1.5, 'F')
    doc.setFillColor(27, 57, 106)
    doc.rect(0, pageHeight - 2.5, pageWidth, 2.5, 'F')
  }
}

/** Crea un documento carta (la plantilla institucional es tamaño carta). */
export function crearDocumentoCarta(jsPDFClass, opciones = {}) {
  return new jsPDFClass({ unit: 'mm', format: 'letter', ...opciones })
}

/**
 * Prepara el membrete del año, lo dibuja en la primera página y escribe título/subtítulos.
 * @param {number} [anio] año del membrete (por defecto, el año actual)
 * @returns {Promise<number>} Y donde inicia el contenido
 */
export async function dibujarEncabezadoPDF(doc, titulo, subtitulos = [], anio) {
  if (!doc.__membrete) await prepararMembrete(doc, anio)
  const { pageWidth, headerHeight } = medidasMembrete(doc)
  dibujarMembretePagina(doc)
  activarMembreteAutomatico(doc)

  const marginX = MARGEN_X
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

/** Opciones de autoTable para que la tabla respete el membrete en TODAS las páginas. */
export function opcionesTablaMembrete(doc) {
  const { topSeguro, bottomSeguro } = medidasMembrete(doc)
  return {
    margin: { top: topSeguro, bottom: bottomSeguro, left: MARGEN_X, right: MARGEN_X },
    didDrawPage: () => dibujarMembretePagina(doc),
  }
}

/** Cualquier doc.addPage() (incluidos los saltos de página de autoTable) dibuja el membrete. */
export function activarMembreteAutomatico(doc) {
  if (doc.__membreteAuto) return
  doc.__membreteAuto = true
  const addPageOriginal = doc.addPage.bind(doc)
  doc.addPage = (...args) => {
    const r = addPageOriginal(...args)
    dibujarMembretePagina(doc)
    return r
  }
}

/** Margen para autoTable que deja libre el membrete arriba y abajo. */
export function margenTabla(doc, lados = MARGEN_X) {
  const { topSeguro, bottomSeguro } = medidasMembrete(doc)
  return { top: topSeguro, bottom: bottomSeguro, left: lados, right: lados }
}