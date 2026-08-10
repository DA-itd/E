import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

const ANCHO_PAGINA = 612
const ALTO_PAGINA = 792
const BASE = import.meta.env.BASE_URL

const BLANCO = rgb(1, 1, 1)
const NEGRO = rgb(0.1, 0.1, 0.1)

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function partesFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split('-').map(Number)
  return { anio, mes, dia }
}

// Departamento que emite el oficio -- fijo, ajústalo aquí si cambia.
const DEPTO_HEADER = 'Coordinación de Actualización Docente'

// Posiciones exactas tomadas del PDF original (TD-AD-FO-07), origen
// arriba-izquierda en puntos, tal como las reporta pdfplumber.
const CAMPOS = {
  nombre_depto_header: { x0: 483.9, x1: 569.5, top: 111.1, bottom: 118.1, tam: 7, negrita: false },
  fecha: { x0: 530.4, x1: 567.2, top: 135.0, bottom: 144.0, tam: 9, negrita: false },
  oficio_no: { x0: 514.4, x1: 567.2, top: 147.3, bottom: 156.3, tam: 9, negrita: false },
  nombre_jefe: { x0: 56.7, top: 624.5, bottom: 634.5, tam: 10, negrita: true },
  jefatura: { x0: 56.7, top: 640.1, bottom: 650.1, tam: 10, negrita: false },
}

// Área en blanco del cuerpo del oficio (entre el bloque "At'n" y "ATENTAMENTE").
const CUERPO = { top: 260, bottom: 545, tam: 10.5, interlineado: 15, izquierda: 56.7, derecha: 555 }

function ajustarTexto(texto, font, tamInicial, anchoMax, tamMinimo = 6) {
  let tam = tamInicial
  while (tam > tamMinimo && font.widthOfTextAtSize(texto, tam) > anchoMax) tam -= 0.5
  return { texto, tam }
}

function armarLineasSimple(texto, font, tam, anchoMax) {
  const parrafos = texto.split('\n\n')
  const lineas = []
  parrafos.forEach((parrafo, i) => {
    const palabras = parrafo.split(' ').filter(Boolean)
    let actual = ''
    for (const palabra of palabras) {
      const intento = actual ? `${actual} ${palabra}` : palabra
      if (font.widthOfTextAtSize(intento, tam) > anchoMax && actual) {
        lineas.push(actual)
        actual = palabra
      } else {
        actual = intento
      }
    }
    if (actual) lineas.push(actual)
    if (i < parrafos.length - 1) lineas.push('') // línea en blanco entre párrafos
  })
  return lineas
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
 * Genera y descarga el oficio de registro de un curso propuesto en Preregistro.
 * item: fila de preregistro_cursos (con oficio_no, curso, objetivo, duracion_horas,
 * modalidad, lugar, dirigido_a, nombre_jefe, jefatura_cargo, created_at).
 * convocatoria: { periodo1_inicio, periodo1_fin, periodo2_inicio, periodo2_fin }
 * de la convocatoria activa, para calcular las fechas del periodo elegido.
 */
export async function descargarOficioRegistro(item, convocatoria) {
  const resp = await fetch(`${BASE}plantillas/oficio_registro.pdf`)
  const plantillaBytes = await resp.arrayBuffer()
  const pdfDoc = await PDFDocument.load(plantillaBytes)
  const page = pdfDoc.getPages()[0]

  const [regularBytes, boldBytes] = await Promise.all([
    fetch(`${BASE}fuentes/Roboto-Regular.ttf`).then((r) => r.arrayBuffer()),
    fetch(`${BASE}fuentes/Roboto-Bold.ttf`).then((r) => r.arrayBuffer()),
  ])
  pdfDoc.registerFontkit(fontkit)
  const fontNormal = await pdfDoc.embedFont(regularBytes)
  const fontNegrita = await pdfDoc.embedFont(boldBytes)

  const fechaEmision = new Date(item.created_at || Date.now())
  const fechaTexto = fechaEmision.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })

  const inicioISO = item.periodo === 'PERIODO_2' ? convocatoria?.periodo2_inicio : convocatoria?.periodo1_inicio
  const finISO = item.periodo === 'PERIODO_2' ? convocatoria?.periodo2_fin : convocatoria?.periodo1_fin
  const ini = inicioISO ? partesFecha(inicioISO) : null
  const fin = finISO ? partesFecha(finISO) : null

  const valores = {
    nombre_depto_header: DEPTO_HEADER,
    fecha: fechaTexto,
    oficio_no: item.oficio_no || '',
    nombre_jefe: item.nombre_jefe || '',
    jefatura: item.jefatura_cargo || '',
  }

  // Cubre cada placeholder con un rectángulo blanco y escribe el valor real encima.
  for (const [nombreCampo, pos] of Object.entries(CAMPOS)) {
    const alto = pos.bottom - pos.top
    const y = ALTO_PAGINA - pos.bottom
    const anchoRect = (pos.x1 ?? pos.x0 + 250) - pos.x0
    page.drawRectangle({ x: pos.x0 - 1, y: y - 1, width: anchoRect + 2, height: alto + 2, color: BLANCO })

    const font = pos.negrita ? fontNegrita : fontNormal
    let texto = valores[nombreCampo] ?? ''
    let tam = pos.tam
    if (pos.x1) {
      const ajustado = ajustarTexto(texto, font, pos.tam, pos.x1 - pos.x0)
      texto = ajustado.texto
      tam = ajustado.tam
    }
    page.drawText(texto, { x: pos.x0, y: y + 2, size: tam, font, color: NEGRO })
  }

  // Párrafo del cuerpo -- el mismo texto de la plantilla, con las llaves sustituidas tal cual.
  const textoCuerpo =
    `Por este conducto me permito solicitar su amable intervención para la validación y registro del ` +
    `CURSO: ${item.curso}, mismo que tiene una duración de ${item.duracion_horas} horas, en modalidad ` +
    `${item.modalidad}. comprendido del ${ini ? ini.dia : ''} de ${ini ? MESES[ini.mes - 1] : ''} al ` +
    `${fin ? fin.dia : ''} de ${fin ? MESES[fin.mes - 1] : ''} dirigido al personal docente del ${item.dirigido_a} ` +
    `cuyo objetivo general es: ${item.objetivo} y del cual se envía ficha técnica, tabla de cronograma y ` +
    `currículum de instructor(a) anexos al presente, para impartirse en: ${item.lugar}\n\n` +
    `Agradeciendo de antemano su atención, me es grato reiterarle mi consideración alta y distinguida.`

  const anchoMax = CUERPO.derecha - CUERPO.izquierda
  const lineas = armarLineasSimple(textoCuerpo, fontNormal, CUERPO.tam, anchoMax)
  const yInicial = ALTO_PAGINA - CUERPO.top - CUERPO.tam
  let y = yInicial
  for (const linea of lineas) {
    page.drawText(linea, { x: CUERPO.izquierda, y, size: CUERPO.tam, font: fontNormal, color: NEGRO })
    y -= CUERPO.interlineado
  }

  const bytes = await pdfDoc.save()
  descargarBytes(bytes, `Oficio_registro_${(item.oficio_no || 'ITD').replace('/', '-')}.pdf`)
}