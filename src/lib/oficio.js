// src/lib/oficio.js
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const ALTO_PAGINA = 792;
const BASE = import.meta.env.BASE_URL?.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL || '/'}`;
const NEGRO = rgb(0.1, 0.1, 0.1);

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function partesFecha(fechaISO) {
  if (!fechaISO) return null;
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  return { anio, mes, dia };
}

function normalizarTexto(texto) {
  if (!texto) return '';
  const minusculas = String(texto).toLowerCase();
  return minusculas.replace(/(^\s*[a-záéíóúñü]|[.!?]\s+[a-záéíóúñü])/g, (m) => m.toUpperCase());
}

const DEPTO_HEADER = 'de Desarrollo Académico';
const DESTINATARIO = ['M.C. MÓNICA ROSALES PÉREZ', 'JEFA DEL DEPTO.  DESARROLLO ACADÉMICO', 'PRESENTE'];
const ATENCION = ['At’n: M.C. Alejandro Calderón Rentería', 'Coordinador de Actualización Docente'];

function esBufferPDF(buffer) {
  if (!buffer || buffer.byteLength < 5) return false;
  const h = new Uint8Array(buffer.slice(0, 5));
  return h[0] === 37 && h[1] === 80 && h[2] === 68 && h[3] === 70 && h[4] === 45;
}

// Busca primero oficio_registro_blanco_AAAA.pdf (ej. _2027) y si no existe usa la plantilla base
async function cargarPlantillaOficio(anio) {
  const rutas = [
    `${BASE}plantillas/oficio_registro_blanco_${anio}.pdf`,
    `${BASE}plantillas/oficio_registro_blanco.pdf`,
    `/plantillas/oficio_registro_blanco.pdf`,
    `./plantillas/oficio_registro_blanco.pdf`,
    `https://raw.githubusercontent.com/DA-itd/E/main/public/plantillas/oficio_registro_blanco.pdf`
  ];

  for (const url of rutas) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const buffer = await resp.arrayBuffer();
        if (esBufferPDF(buffer)) {
          return await PDFDocument.load(buffer);
        }
      }
    } catch {}
  }

  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  return doc;
}

async function cargarFuente(pdfDoc, nombreFuente, fallback) {
  const rutas = [
    `${BASE}fuentes/${nombreFuente}`,
    `/fuentes/${nombreFuente}`,
    `https://raw.githubusercontent.com/DA-itd/E/main/public/fuentes/${nombreFuente}`
  ];

  for (const url of rutas) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const buffer = await resp.arrayBuffer();
        if (buffer.byteLength > 1000) {
          pdfDoc.registerFontkit(fontkit);
          return await pdfDoc.embedFont(buffer);
        }
      }
    } catch {}
  }
  return await pdfDoc.embedFont(fallback);
}

function y(top) {
  return ALTO_PAGINA - top;
}

function dibujarTexto(page, texto, x, top, font, tam) {
  page.drawText(String(texto || ''), { x, y: y(top), size: tam, font, color: NEGRO });
}

function dibujarTextoDerecha(page, texto, xDerecha, top, font, tam) {
  const ancho = font.widthOfTextAtSize(String(texto || ''), tam);
  dibujarTexto(page, texto, xDerecha - ancho, top, font, tam);
}

function armarLineasConEstilo(segmentos, fontNormal, fontNegrita, tam, anchoMax) {
  const parrafos = [[]];
  for (const seg of segmentos) {
    seg.texto.split('\n\n').forEach((parte, i) => {
      if (i > 0) parrafos.push([]);
      parte.split(' ').filter(Boolean).forEach((palabra) => {
        parrafos[parrafos.length - 1].push({ texto: palabra, negrita: seg.negrita });
      });
    });
  }
  const espacio = fontNormal.widthOfTextAtSize(' ', tam);
  const lineas = [];
  parrafos.forEach((palabras, i) => {
    let actual = [];
    let ancho = 0;
    for (const palabra of palabras) {
      const font = palabra.negrita ? fontNegrita : fontNormal;
      const anchoPalabra = font.widthOfTextAtSize(palabra.texto, tam);
      const anchoNuevo = actual.length ? ancho + espacio + anchoPalabra : anchoPalabra;
      if (anchoNuevo > anchoMax && actual.length > 0) {
        lineas.push(actual);
        actual = [palabra];
        ancho = anchoPalabra;
      } else {
        actual.push(palabra);
        ancho = anchoNuevo;
      }
    }
    if (actual.length) lineas.push(actual);
    if (i < parrafos.length - 1) lineas.push([]);
  });
  return lineas;
}

function agruparEnRuns(linea) {
  const runs = [];
  for (const palabra of linea) {
    const ultimo = runs[runs.length - 1];
    if (ultimo && ultimo.negrita === palabra.negrita) {
      ultimo.texto += ' ' + palabra.texto;
    } else {
      runs.push({ texto: palabra.texto, negrita: palabra.negrita });
    }
  }
  return runs;
}

function dibujarParrafoConEstilo(page, lineas, fontNormal, fontNegrita, tam, interlineado, yInicial, x) {
  const espacio = fontNormal.widthOfTextAtSize(' ', tam);
  let yCursor = yInicial;
  for (const linea of lineas) {
    let cursorX = x;
    for (const run of agruparEnRuns(linea)) {
      const font = run.negrita ? fontNegrita : fontNormal;
      page.drawText(run.texto, { x: cursorX, y: yCursor, size: tam, font, color: NEGRO });
      cursorX += font.widthOfTextAtSize(run.texto, tam) + espacio;
    }
    yCursor -= interlineado;
  }
}

function descargarBytes(bytes, nombreArchivo) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function descargarOficioRegistro(item, convocatoria) {
  try {
    const anioPlantilla = new Date(item.created_at || Date.now()).getFullYear();
    const pdfDoc = await cargarPlantillaOficio(anioPlantilla);
    const page = pdfDoc.getPages()[0];

    const fontNormal = await cargarFuente(pdfDoc, 'Roboto-Regular.ttf', StandardFonts.Helvetica);
    const fontNegrita = await cargarFuente(pdfDoc, 'Roboto-Bold.ttf', StandardFonts.HelveticaBold);
    const fontNegritaItalica = await cargarFuente(pdfDoc, 'Roboto-BoldItalic.ttf', StandardFonts.HelveticaBoldOblique);

    const fechaEmision = new Date(item.created_at || Date.now());
    const fechaTexto = fechaEmision.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    const anioEmision = fechaEmision.getFullYear();
    const numeroOficio = String(item.oficio_no || '').split('/')[0].trim();
    const oficioNoCompleto = `${numeroOficio || '1'}/${anioEmision}`;

    const xDerecha = 569.5;
    dibujarTextoDerecha(page, 'Instituto Tecnológico de Durango', xDerecha, 108.6, fontNegrita, 9);
    dibujarTextoDerecha(page, `Departamento ${DEPTO_HEADER}`, xDerecha, 118.1, fontNormal, 8);
    dibujarTextoDerecha(page, `Durango, Dgo., ${fechaTexto}`, xDerecha, 144.0, fontNormal, 9);
    dibujarTextoDerecha(page, `Oficio No. ${oficioNoCompleto}`, xDerecha, 156.3, fontNormal, 9);

    DESTINATARIO.forEach((linea, i) => {
      dibujarTexto(page, linea, 56.7, 187.4 + i * 13.6, fontNegrita, 10);
    });

    ATENCION.forEach((linea, i) => {
      dibujarTexto(page, linea, 374.7, 228.3 + i * 13.6, fontNegrita, 10);
    });

    const inicioISO = item.periodo === 'PERIODO_2' ? convocatoria?.periodo2_inicio : convocatoria?.periodo1_inicio;
    const finISO = item.periodo === 'PERIODO_2' ? convocatoria?.periodo2_fin : convocatoria?.periodo1_fin;
    const ini = inicioISO ? partesFecha(inicioISO) : null;
    const fin = finISO ? partesFecha(finISO) : null;
    const diaMes1 = ini ? `${ini.dia} de ${MESES[ini.mes - 1]}` : '';
    const diaMes2 = fin ? `${fin.dia} de ${MESES[fin.mes - 1]}` : '';

    const CUERPO = { top: 275, izquierda: 56.7, derecha: 555, tam: 10.5, interlineado: 15 };
    const cursoTexto = normalizarTexto(item.curso);
    const dirigidoATexto = normalizarTexto(item.dirigido_a);
    const objetivoTexto = normalizarTexto(item.objetivo);
    const lugarTexto = normalizarTexto(item.lugar || 'ITD');
    const modalidadTexto = item.modalidad || 'Presencial';

    const segmentos = [
      { texto: `Por este conducto me permito solicitar su amable intervención para la validación y registro del curso: `, negrita: false },
      { texto: `${cursoTexto},`, negrita: true },
      { texto: ` mismo que tiene una duración de `, negrita: false },
      { texto: `${item.duracion_horas || 30} horas,`, negrita: true },
      { texto: ` en modalidad ${modalidadTexto}. comprendido del `, negrita: false },
      { texto: `${diaMes1} al ${diaMes2}`, negrita: true },
      { texto: ` dirigido al personal docente del `, negrita: false },
      { texto: `${dirigidoATexto}`, negrita: true },
      { texto: ` cuyo objetivo general es: `, negrita: false },
      { texto: `${objetivoTexto}`, negrita: true },
      { texto: ` y del cual se envía ficha técnica, tabla de cronograma y currículum de instructor(a) anexos al presente, para impartirse en: `, negrita: false },
      { texto: `${lugarTexto}.`, negrita: true },
      { texto: `\n\nAgradeciendo de antemano su atención, me es grato reiterarle mi consideración alta y distinguida.`, negrita: false },
    ];
    const anchoMax = CUERPO.derecha - CUERPO.izquierda;
    const lineas = armarLineasConEstilo(segmentos, fontNormal, fontNegrita, CUERPO.tam, anchoMax);
    dibujarParrafoConEstilo(page, lineas, fontNormal, fontNegrita, CUERPO.tam, CUERPO.interlineado, y(CUERPO.top), CUERPO.izquierda);

    dibujarTexto(page, 'ATENTAMENTE', 56.7, 562.5, fontNegrita, 10);
    dibujarTexto(page, 'Excelencia en Educación Tecnológica®', 56.7, 575.4, fontNegritaItalica, 8);
    dibujarTexto(page, 'La Técnica al Servicio de la Patria', 56.7, 585.0, fontNegritaItalica, 8);

    dibujarTexto(page, item.nombre_jefe || '', 56.7, 634.5, fontNegrita, 10);
    dibujarTexto(page, item.jefatura_cargo || '', 56.7, 650.1, fontNormal, 10);
    dibujarTexto(page, 'c.c.p Archivo', 56.7, 672.6, fontNormal, 8);

    const bytes = await pdfDoc.save();
    if (item.retornarBytes) return bytes;

    descargarBytes(bytes, `Oficio_registro_${oficioNoCompleto.replace('/', '-')}.pdf`);
  } catch (error) {
    console.error('❌ Error al generar Oficio de Registro:', error);
    alert('No se pudo generar el oficio: ' + error.message);
  }
}