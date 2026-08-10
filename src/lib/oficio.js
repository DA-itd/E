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
  fecha: { x0: 530.4, x1: 567.2, top: 135.0, bottom: 144.0, tam: 10, negrita: false },
  oficio_no: { x0: 514.4, x1: 567.2, top: 147.3, bottom: 156.3, tam: 10, negrita: false },
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

function armarLineasConEstilo(segmentos, fontNormal, fontNegrita, tam, anchoMax) {
  // Cada segmento trae su propio texto y si va en negrita; se tokeniza a
  // nivel palabra conservando el estilo, y se separan párrafos con '\n\n'.
  const parrafos = [[]]
  for (const seg of segmentos) {
    seg.texto.split('\n\n').forEach((parte, i) => {
      if (i > 0) parrafos.push([])
      parte.split(' ').filter(Boolean).forEach((palabra) => {
        parrafos[parrafos.length - 1].push({ texto: palabra, negrita: seg.negrita })
      })
    })
  }

  const espacio = fontNormal.widthOfTextAtSize(' ', tam)
  const lineas = []
  parrafos.forEach((palabras, i) => {
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
    if (i < parrafos.length - 1) lineas.push([]) // línea en blanco entre párrafos
  })
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

function dibujarParrafoConEstilo(page, lineas, fontNormal, fontNegrita, tam, interlineado, yInicial, x) {
  const espacio = fontNormal.widthOfTextAtSize(' ', tam)
  let y = yInicial
  for (const linea of lineas) {
    let cursorX = x
    for (const run of agruparEnRuns(linea)) {
      const font = run.negrita ? fontNegrita : fontNormal
      page.drawText(run.texto, { x: cursorX, y, size: tam, font, color: NEGRO })
      cursorX += font.widthOfTextAtSize(run.texto, tam) + espacio
    }
    y -= interlineado
  }
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

  // Párrafo del cuerpo -- mismo texto de la plantilla, con negrita en los
  // datos clave: horas, fechas del curso, a quién va dirigido, y objetivo.
  const diaMes1 = ini ? `${ini.dia} de ${MESES[ini.mes - 1]}` : ''
  const diaMes2 = fin ? `${fin.dia} de ${MESES[fin.mes - 1]}` : ''

  const segmentos = [
    { texto: `Por este conducto me permito solicitar su amable intervención para la validación y registro del CURSO: ${item.curso}, mismo que tiene una duración de `, negrita: false },
    { texto: `${item.duracion_horas} horas,`, negrita: true },
    { texto: ` en modalidad ${item.modalidad}. comprendido del `, negrita: false },
    { texto: `${diaMes1} al ${diaMes2}`, negrita: true },
    { texto: ` dirigido al personal docente del `, negrita: false },
    { texto: `${item.dirigido_a}`, negrita: true },
    { texto: ` cuyo objetivo general es: `, negrita: false },
    { texto: `${item.objetivo}`, negrita: true },
    { texto: ` y del cual se envía ficha técnica, tabla de cronograma y currículum de instructor(a) anexos al presente, para impartirse en: ${item.lugar}`, negrita: false },
    { texto: `\n\nAgradeciendo de antemano su atención, me es grato reiterarle mi consideración alta y distinguida.`, negrita: false },
  ]

  const anchoMax = CUERPO.derecha - CUERPO.izquierda
  const lineas = armarLineasConEstilo(segmentos, fontNormal, fontNegrita, CUERPO.tam, anchoMax)
  const yInicial = ALTO_PAGINA - CUERPO.top - CUERPO.tam
  dibujarParrafoConEstilo(page, lineas, fontNormal, fontNegrita, CUERPO.tam, CUERPO.interlineado, yInicial, CUERPO.izquierda)

  const bytes = await pdfDoc.save()
  descargarBytes(bytes, `Oficio_registro_${(item.oficio_no || 'ITD').replace('/', '-')}.pdf`)
}