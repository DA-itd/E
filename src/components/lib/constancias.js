 import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import QRCode from 'qrcode'
import { formatearRangoFechas } from './formatoFechas'
import { supabase } from './supabaseClient'

// Tamaño de página tal como está en tu PDF original (Carta: 612 x 792 pt)
const ANCHO_PAGINA = 612
const ALTO_PAGINA = 792
const BASE = import.meta.env.BASE_URL // respeta el "base" de vite.config.js (ej. "/E/")

const COLOR_TEXTO = '#1f2937'
const COLOR_DORADO = '#B48A00'
const COLOR_GRIS = '#6b7280'

// Campos pequeños de una sola línea (Configuración base / 2026)
const CAMPOS = {
  constancia: {
    imagen: `${BASE}plantillas/constancia.jpg`,
    campos: {
      NombreCompleto: { x0: 209.6, top: 345.6, x1: 394.6, bottom: 365.6, tam: 16, negrita: true, color: COLOR_TEXTO, centrado: true, anchoCentro: 612, anchoMax: 520 },
      Departamento: { x1: 571.3, top: 689.0, bottom: 696.0, tam: 7, color: COLOR_GRIS, alinDerecha: true, anchoMax: 150 },
      FolioPersonal: { x0: 75.1, top: 692.3, x1: 142.1, bottom: 700.3, tam: 7, color: COLOR_GRIS },
      tipo: { x0: 75.1, top: 712.8, x1: 142.1, bottom: 719.8, tam: 7, color: COLOR_GRIS },
      FECHA_CREACION: { x0: 70.2, top: 731.2, x1: 144.0, bottom: 738.2, tam: 7, color: COLOR_GRIS },
    },
    parrafo: { top: 425, bottom: 468, tam: 10.5, interlineado: 15 },
    lineaFecha: { top: 645, bottom: 660.5, tam: 10.5 },
    qr: { x: 164.8, top: 682, tamano: 50 },
  },
  reconocimiento: {
    imagen: `${BASE}plantillas/reconocimiento.jpg`,
    campos: {
      NombreCompleto: { x0: 209.6, top: 339.2, x1: 394.6, bottom: 359.2, tam: 16, negrita: true, color: COLOR_TEXTO, centrado: true, anchoCentro: 612, anchoMax: 520 },
      Departamento: { x1: 573.0, top: 687.8, bottom: 694.8, tam: 7, color: COLOR_GRIS, alinDerecha: true, anchoMax: 150 },
      FolioPersonal: { x0: 74.6, top: 697.3, x1: 141.7, bottom: 705.3, tam: 7, color: COLOR_GRIS },
      tipo: { x0: 74.6, top: 717.8, x1: 141.7, bottom: 724.8, tam: 7, color: COLOR_GRIS },
      FECHA_CREACION: { x0: 67.8, top: 736.2, x1: 141.6, bottom: 743.2, tam: 7, color: COLOR_GRIS },
    },
    parrafo: { top: 427, bottom: 472, tam: 10.5, interlineado: 15 },
    lineaFecha: { top: 645, bottom: 660.5, tam: 10.5 },
    qr: { x: 164.8, top: 682, tamano: 50 },
  },
}

// Registro para años futuros (ej. 2027, 2028). Si algún año nuevo tiene cambios en coordenadas
// de texto o posición de firma, se agrega aquí. Si no está registrado, usará la configuración base.
const CONFIG_POR_ANIO = {
  // Ejemplo futuro:
  // 2027: {
  //   constancia: { ...CAMPOS.constancia, parrafo: { ... } },
  //   reconocimiento: { ...CAMPOS.reconocimiento }
  // }
}

function deducirAnio(datos) {
  // 1. Del folio personal (ej. TNM-054-40-2027-01 o TNM-054-40-2026-10)
  const matchFolio = (datos.folioPersonal || '').match(/-(20\d\d)-/)
  if (matchFolio) return parseInt(matchFolio[1], 10)

  const matchFolioFin = (datos.folioPersonal || '').match(/-(20\d\d)$/)
  if (matchFolioFin) return parseInt(matchFolioFin[1], 10)

  // 2. De las fechas del curso
  if (datos.fechaInicio && datos.fechaInicio.length >= 4) {
    const a = parseInt(datos.fechaInicio.slice(0, 4), 10)
    if (!isNaN(a) && a >= 2000 && a <= 2050) return a
  }
  if (datos.fechaFin && datos.fechaFin.length >= 4) {
    const a = parseInt(datos.fechaFin.slice(0, 4), 10)
    if (!isNaN(a) && a >= 2000 && a <= 2050) return a
  }

  // 3. De la fecha de creación / descarga
  if (datos.fechaDescarga || datos.fechaCreacion) {
    const d = new Date(datos.fechaDescarga || datos.fechaCreacion)
    if (!isNaN(d.getFullYear())) return d.getFullYear()
  }

  return new Date().getFullYear()
}

// Carga resiliente de plantilla: busca primero versión específica del año (ej. constancia_2027.jpg)
// y si no existe hace fallback automático a la plantilla base (constancia.jpg)
async function cargarImagenPlantilla(tipoDocumento, anio) {
  const candidatos = [
    `${BASE}plantillas/${tipoDocumento}_${anio}.jpg`,
    `${BASE}plantillas/${tipoDocumento}_${anio}.png`,
    `${BASE}plantillas/${anio}/${tipoDocumento}.jpg`,
    `${BASE}plantillas/${anio}/${tipoDocumento}.png`,
    `${BASE}plantillas/${tipoDocumento}.jpg`,
    `${BASE}plantillas/${tipoDocumento}.png`,
  ]

  for (const url of candidatos) {
    try {
      const resp = await fetch(url)
      if (resp.ok) {
        const buffer = await resp.arrayBuffer()
        // Evita falsos positivos de SPA router que devuelve index.html (404)
        const primero = new Uint8Array(buffer.slice(0, 4))
        if (primero[0] === 0x3C) continue // '<' indica HTML
        return { buffer, url }
      }
    } catch {
      // Intenta siguiente candidato
    }
  }

  throw new Error(`No se encontró la plantilla para ${tipoDocumento} (año ${anio}).`)
}

function hexARgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

function ajustarTexto(texto, font, tamInicial, anchoMax, tamMinimo = 6.5) {
  let tam = tamInicial
  while (tam > tamMinimo && font.widthOfTextAtSize(texto, tam) > anchoMax) {
    tam -= 0.5
  }
  let textoFinal = texto
  while (textoFinal.length > 3 && font.widthOfTextAtSize(textoFinal, tam) > anchoMax) {
    textoFinal = textoFinal.slice(0, -1)
  }
  if (textoFinal !== texto) textoFinal = textoFinal.trimEnd() + '…'
  return { texto: textoFinal, tam }
}

function armarLineas(segmentos, fontNormal, fontNegrita, tam, anchoMax) {
  const palabras = []
  for (const seg of segmentos) {
    seg.texto.split(' ').filter(Boolean).forEach((p) => palabras.push({ texto: p, negrita: seg.negrita }))
  }

  const espacio = fontNormal.widthOfTextAtSize(' ', tam)
  const lineas = []
  let actual = []
  let ancho = 0

  for (const palabra of palabras) {
    const font = palabra.negrita ? fontNegrita : fontNormal
    const anchoPalabra = font.widthOfTextAtSize(palabra.texto, tam)
    const anchoNuevo = actual.length ? ancho + espacio + anchoPalabra : anchoPalabra
    if (anchoNuevo > anchoMax && actual.length > 0) {
      lineas.push(actual)
      actual = [palabra]
      ancho = anchoPalabra
    } else {
      actual.push(palabra)
      ancho = anchoNuevo
    }
  }
  if (actual.length) lineas.push(actual)
  return lineas
}

function agruparEnRuns(linea) {
  const runs = []
  for (const palabra of linea) {
    const ultimo = runs[runs.length - 1]
    if (ultimo && ultimo.negrita === palabra.negrita) {
      ultimo.texto += ' ' + palabra.texto
    } else {
      runs.push({ texto: palabra.texto, negrita: palabra.negrita })
    }
  }
  return runs
}

function dibujarLineasCentradas(page, lineas, fontNormal, fontNegrita, tam, interlineado, yInicial, centroX, color) {
  const espacio = fontNormal.widthOfTextAtSize(' ', tam)
  let y = yInicial
  const colorRgb = hexARgb(color)

  for (const linea of lineas) {
    const runs = agruparEnRuns(linea)
    const anchoTotal = runs.reduce((acc, r, i) => {
      const font = r.negrita ? fontNegrita : fontNormal
      return acc + font.widthOfTextAtSize(r.texto, tam) + (i > 0 ? espacio : 0)
    }, 0)

    let x = centroX - anchoTotal / 2
    for (const run of runs) {
      const font = run.negrita ? fontNegrita : fontNormal
      page.drawText(run.texto, { x, y, size: tam, font, color: colorRgb })
      x += font.widthOfTextAtSize(run.texto, tam) + espacio
    }
    y -= interlineado
  }
}

function segmentosParrafo(tipoDocumento, valores) {
  if (tipoDocumento === 'constancia') {
    return [
      { texto: 'POR SU DESTACADA PARTICIPACIÓN EN EL CURSO-TALLER', negrita: false },
      { texto: `${valores.Curso},`, negrita: true },
      { texto: 'REALIZADO', negrita: false },
      { texto: `${valores.FechaCurso},`, negrita: false },
      { texto: 'CON UNA DURACIÓN DE', negrita: false },
      { texto: `${valores.Horas}`, negrita: true },
      { texto: 'HORAS.', negrita: false },
    ]
  }
  return [
    { texto: 'POR SU VALIOSA LABOR ACADÉMICA AL IMPARTIR EL CURSO-TALLER', negrita: false },
    { texto: `${valores.Curso},`, negrita: true },
    { texto: 'REALIZADO', negrita: false },
    { texto: `${valores.FechaCurso},`, negrita: false },
    { texto: 'CON UNA DURACIÓN DE', negrita: false },
    { texto: `${valores.Horas}`, negrita: true },
    { texto: 'HORAS.', negrita: false },
  ]
}

/**
 * Descarga una constancia o reconocimiento.
 * Se genera 100% "al vuelo" en el navegador del docente (0 MB en Storage de Supabase).
 * No almacena archivos pesados en el servidor, permitiendo descargas ilimitadas.
 */
export async function descargarConstancia(tipoDocumento, datos) {
  // Si la petición solo requiere los bytes (ej. para empaquetar en el ZIP de Recursos Humanos)
  if (datos.retornarBytes) {
    return await generarPdfBytes(tipoDocumento, datos)
  }

  const nombreArchivo = `${tipoDocumento}_${(datos.folioPersonal || 'ITD').replace(/\s+/g, '_')}.pdf`

  // Genera el PDF directamente en memoria
  const bytes = await generarPdfBytes(tipoDocumento, datos)
  descargarBytes(bytes, nombreArchivo)

  // Registra la fecha de primera descarga en la base de datos (solo una fecha en texto, 0 bytes en storage)
  try {
    if (datos.docenteId && datos.cursoId) {
      supabase
        .from('inscripciones')
        .update({ fecha_descarga: new Date().toISOString() })
        .eq('docente_id', datos.docenteId)
        .eq('curso_id', datos.cursoId)
        .is('fecha_descarga', null)
        .then(() => {})
        .catch(() => {})
    }
  } catch {
    // Continúa si no existe la columna
  }
}

// Función que genera la URL de validación completamente limpia, SIN punto ni diagonales erróneas
export function obtenerUrlValidacion(folioPersonal, tipoDocumento) {
  const folioEnc = encodeURIComponent((folioPersonal || '').trim())
  const tipoEnc = encodeURIComponent(tipoDocumento || 'constancia')
  const origin = window.location.origin.replace(/\.+$/, '')
  return `${origin}/?validar=${folioEnc}&tipo=${tipoEnc}`
}

export async function generarPdfBytes(tipoDocumento, datos) {
  const anioDoc = deducirAnio(datos)
  const config = CONFIG_POR_ANIO[anioDoc]?.[tipoDocumento] || CAMPOS[tipoDocumento]
  if (!config) throw new Error(`Tipo de documento "${tipoDocumento}" no válido para el año ${anioDoc}`)

  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)
  const page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA])

  // Carga inteligente de plantilla por año (ej. constancia_2027.jpg o constancia.jpg)
  const { buffer: imgBytes, url: urlCargada } = await cargarImagenPlantilla(tipoDocumento, anioDoc)
  const u8 = new Uint8Array(imgBytes.slice(0, 8))
  const esPng = (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47) || urlCargada.toLowerCase().endsWith('.png')
  const imagen = esPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes)
  page.drawImage(imagen, { x: 0, y: 0, width: ANCHO_PAGINA, height: ALTO_PAGINA })

  const [regularBytes, boldBytes] = await Promise.all([
    fetch(`${BASE}fuentes/Roboto-Regular.ttf`).then((r) => r.arrayBuffer()),
    fetch(`${BASE}fuentes/Roboto-Bold.ttf`).then((r) => r.arrayBuffer()),
  ])
  const fontNormal = await pdfDoc.embedFont(regularBytes)
  const fontNegrita = await pdfDoc.embedFont(boldBytes)

  // La fecha de emisión se mantiene consistente: si ya tenía fecha registrada la usa; si no, la fecha actual
  const fechaReferencia = datos.fechaDescarga || datos.fechaCreacion || datos.created_at
  const fechaObj = fechaReferencia ? new Date(fechaReferencia) : new Date()
  const fechaCreacionTexto = fechaObj.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })

  // La fecha oficial de fin del curso en el pie ("VICTORIA DE DURANGO...A <fecha>") siempre es fija
  const fechaSemana = formatearRangoFechas(datos.fechaFin, datos.fechaFin)

  const valores = {
    NombreCompleto: (datos.nombreCompleto || '').toUpperCase(),
    Curso: (datos.curso || '').toUpperCase(),
    FechaCurso: formatearRangoFechas(datos.fechaInicio, datos.fechaFin),
    Horas: `${datos.horas || ''}`,
    Departamento: datos.departamento || '',
    FolioPersonal: datos.folioPersonal || '',
    tipo: (datos.tipo || '').toUpperCase(),
    FECHA_CREACION: fechaCreacionTexto,
  }

  // Campos de una sola línea
  for (const [nombreCampo, pos] of Object.entries(config.campos)) {
    let texto = valores[nombreCampo] ?? ''
    const font = pos.negrita ? fontNegrita : fontNormal
    const color = hexARgb(pos.color)
    const yBase = ALTO_PAGINA - pos.bottom + 2

    let tam = pos.tam
    if (pos.anchoMax) {
      const ajustado = ajustarTexto(texto, font, pos.tam, pos.anchoMax)
      texto = ajustado.texto
      tam = ajustado.tam
    }

    let x = pos.x0
    if (pos.centrado) {
      const anchoTexto = font.widthOfTextAtSize(texto, tam)
      x = (pos.anchoCentro - anchoTexto) / 2
    } else if (pos.alinDerecha) {
      const anchoTexto = font.widthOfTextAtSize(texto, tam)
      x = pos.x1 - anchoTexto
    }

    page.drawText(texto, { x, y, size: tam, font, color })
  }

  // Párrafo principal
  const p = config.parrafo
  const segmentosP = segmentosParrafo(tipoDocumento, valores)
  const lineasP = armarLineas(segmentosP, fontNormal, fontNegrita, p.tam, 480)
  const altoBloqueP = lineasP.length * p.interlineado
  const centroVerticalP = ALTO_PAGINA - (p.top + p.bottom) / 2
  const yInicialP = centroVerticalP + altoBloqueP / 2 - p.tam
  dibujarLineasCentradas(page, lineasP, fontNormal, fontNegrita, p.tam, p.interlineado, yInicialP, ANCHO_PAGINA / 2, COLOR_TEXTO)

  // Línea oficial de fecha en dorado
  const lf = config.lineaFecha
  const segmentosF = [{ texto: `VICTORIA DE DURANGO, DGO., A ${fechaSemana}`, negrita: true }]
  const lineasF = armarLineas(segmentosF, fontNegrita, fontNegrita, lf.tam, 480)
  const yF = ALTO_PAGINA - (lf.top + lf.bottom) / 2 - lf.tam / 2.8
  dibujarLineasCentradas(page, lineasF, fontNegrita, fontNegrita, lf.tam, 0, yF, ANCHO_PAGINA / 2, COLOR_DORADO)

  // Código QR oficial de validación
  if (config.qr && datos.folioPersonal) {
    try {
      // ✅ AHORA SÍ usa obtenerUrlValidacion (completamente limpia sin el punto de BASE)
      const urlValidacion = obtenerUrlValidacion(datos.folioPersonal, tipoDocumento)
      const qrDataUrl = await QRCode.toDataURL(urlValidacion, { margin: 0, width: 256 })
      const qrBytes = await fetch(qrDataUrl).then((r) => r.arrayBuffer())
      const qrImagen = await pdfDoc.embedPng(qrBytes)
      const q = config.qr
      page.drawImage(qrImagen, {
        x: q.x,
        y: ALTO_PAGINA - q.top - q.tamano,
        width: q.tamano,
        height: q.tamano,
      })
    } catch (err) {
      console.error('No se pudo generar el QR de validación:', err)
    }
  }

  return await pdfDoc.save()
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