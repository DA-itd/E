import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { formatearRangoFechas } from './formatoFechas'
import { supabase } from './supabaseClient'

// Tamaño de página tal como está en tu PDF original (Carta: 612 x 792 pt)
const ANCHO_PAGINA = 612
const ALTO_PAGINA = 792
const BASE = import.meta.env.BASE_URL // respeta el "base" de vite.config.js (ej. "/E/")

const COLOR_TEXTO = '#1f2937'
const COLOR_DORADO = '#B48A00'
const COLOR_GRIS = '#6b7280'

// Campos pequeños de una sola línea (posiciones extraídas de tu PDF original,
// en puntos, origen arriba-izquierda -- se convierten a coordenadas de
// pdf-lib al dibujar).
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
    // Área completa del párrafo (se borró de la imagen de fondo -- se
    // redibuja entero aquí con salto de línea real y letra uniforme).
    parrafo: { top: 425, bottom: 468, tam: 10.5, interlineado: 15 },
    // Línea "VICTORIA DE DURANGO, DGO., A <fecha>" completa (también se
    // borró de la imagen de fondo -- se redibuja entera en dorado).
    lineaFecha: { top: 645, bottom: 660.5, tam: 10.5 },
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
  },
}

function hexARgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

// Reduce el tamaño de fuente hasta que el texto quepa en el ancho disponible.
// Si ni con la letra más chica permitida cabe, se recorta con "…".
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

// ---------------------------------------------------------------
// Texto con salto de línea real y estilos mixtos (negrita/normal).
// Arma líneas palabra por palabra según el ancho disponible, y al
// DIBUJAR agrupa palabras consecutivas del mismo estilo en un solo
// trazo de texto (en vez de palabra por palabra) -- así el espaciado
// entre palabras lo calcula el propio motor de fuentes, sin riesgo de
// que se vean pegadas.
// ---------------------------------------------------------------
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

// Agrupa palabras consecutivas del mismo estilo en "runs" (para dibujarlas
// de un solo trazo, con espacios internos reales).
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
 * Descarga una constancia o reconocimiento. Si ya se había generado antes
 * para ese docente+curso, la trae de la copia guardada en Drive (no
 * regenera). Si es la primera vez, la genera con pdf-lib y sube una copia
 * oculta a Drive en segundo plano.
 *
 * datos: {
 *   docenteId, cursoId, nombreCompleto, curso, fechaInicio, fechaFin,
 *   horas, departamento, folioPersonal, tipo  // "Docente" | "Profesional"
 * }
 */
export async function descargarConstancia(tipoDocumento, datos) {
  const nombreArchivo = `${tipoDocumento}_${(datos.folioPersonal || 'ITD').replace(/\s+/g, '_')}.pdf`

  try {
    const { data } = await supabase.functions.invoke('constancia-drive', {
      body: { accion: 'obtener', tipo: tipoDocumento, docenteId: datos.docenteId, cursoId: datos.cursoId },
    })
    if (data?.existe && data?.pdfBase64) {
      descargarBase64(data.pdfBase64, nombreArchivo)
      return
    }
  } catch (e) {
    // Sin Drive configurado todavía -- no bloquea, se genera normal.
  }

  const bytes = await generarPdfBytes(tipoDocumento, datos)
  descargarBytes(bytes, nombreArchivo)

  const pdfBase64 = btoa(String.fromCharCode(...bytes))
  supabase.functions
    .invoke('constancia-drive', {
      body: {
        accion: 'guardar',
        tipo: tipoDocumento,
        docenteId: datos.docenteId,
        cursoId: datos.cursoId,
        pdfBase64,
        nombreArchivo,
      },
    })
    .catch(() => {})
}

async function generarPdfBytes(tipoDocumento, datos) {
  const config = CAMPOS[tipoDocumento]
  if (!config) throw new Error('Tipo de documento no válido')

  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)
  const page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA])

  const imgResp = await fetch(config.imagen)
  const imgBytes = await imgResp.arrayBuffer()
  const imagen = await pdfDoc.embedJpg(imgBytes)
  page.drawImage(imagen, { x: 0, y: 0, width: ANCHO_PAGINA, height: ALTO_PAGINA })

  // Se usa una fuente real incrustada (Roboto) en vez de la fuente estándar
  // "Helvetica" de pdf-lib -- esa fuente estándar calcula MAL el ancho de
  // letras acentuadas (Ó, Í, Á...) y eso hacía que las palabras se
  // encimaran cuando había acentos en el texto.
  const [regularBytes, boldBytes] = await Promise.all([
    fetch(`${BASE}fuentes/Roboto-Regular.ttf`).then((r) => r.arrayBuffer()),
    fetch(`${BASE}fuentes/Roboto-Bold.ttf`).then((r) => r.arrayBuffer()),
  ])
  const fontNormal = await pdfDoc.embedFont(regularBytes)
  const fontNegrita = await pdfDoc.embedFont(boldBytes)

  const hoy = new Date()
  const fechaCreacionTexto = hoy.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })

  // La fecha del pie ("VICTORIA DE DURANGO...A <fecha>") es el último día
  // de la semana del curso (fecha_fin), como se definió con Alejandro.
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

    page.drawText(texto, { x, y: yBase, size: tam, font, color })
  }

  // Párrafo completo, con salto de línea real y letra uniforme
  const p = config.parrafo
  const segmentosP = segmentosParrafo(tipoDocumento, valores)
  const lineasP = armarLineas(segmentosP, fontNormal, fontNegrita, p.tam, 480)
  const altoBloqueP = lineasP.length * p.interlineado
  const centroVerticalP = ALTO_PAGINA - (p.top + p.bottom) / 2
  const yInicialP = centroVerticalP + altoBloqueP / 2 - p.tam
  dibujarLineasCentradas(page, lineasP, fontNormal, fontNegrita, p.tam, p.interlineado, yInicialP, ANCHO_PAGINA / 2, COLOR_TEXTO)

  // Línea completa de fecha, en dorado
  const lf = config.lineaFecha
  const segmentosF = [{ texto: `VICTORIA DE DURANGO, DGO., A ${fechaSemana}`, negrita: true }]
  const lineasF = armarLineas(segmentosF, fontNegrita, fontNegrita, lf.tam, 480)
  const yF = ALTO_PAGINA - (lf.top + lf.bottom) / 2 - lf.tam / 2.8
  dibujarLineasCentradas(page, lineasF, fontNegrita, fontNegrita, lf.tam, 0, yF, ANCHO_PAGINA / 2, COLOR_DORADO)

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

function descargarBase64(base64, nombreArchivo) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  descargarBytes(bytes, nombreArchivo)
}
