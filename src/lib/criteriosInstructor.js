// src/lib/criteriosInstructor.js
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { supabase } from './supabaseClient';

const ALTO_PAGINA = 792;
const BASE = import.meta.env.BASE_URL?.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL || '/'}`;
const NEGRO = rgb(0.1, 0.1, 0.1);
const AZUL = rgb(0.106, 0.224, 0.416);
const VERDE = rgb(0, 0.5, 0);
const ROJO = rgb(0.75, 0, 0);

const VOBO_NOMBRE_DEFAULT = 'Adriana Eréndira Murillo';
const VOBO_CARGO_DEFAULT = 'Subdirección Académica';

function esBufferPDF(buffer) {
  if (!buffer || buffer.byteLength < 5) return false;
  const h = new Uint8Array(buffer.slice(0, 5));
  // %PDF- => 37, 80, 68, 70, 45
  return h[0] === 37 && h[1] === 80 && h[2] === 68 && h[3] === 70 && h[4] === 45;
}

// Carga la plantilla intentando ruta local y con respaldo a GitHub Raw
async function cargarPlantillaSegura(nombreArchivo) {
  const rutas = [
    `${BASE}plantillas/${nombreArchivo}`,
    `/plantillas/${nombreArchivo}`,
    `./plantillas/${nombreArchivo}`,
    `https://raw.githubusercontent.com/DA-itd/E/main/public/plantillas/${nombreArchivo}`
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
    } catch (e) {
      console.warn(`No se pudo cargar desde ${url}, probando siguiente ruta...`);
    }
  }

  // Si todas fallan, crea un documento PDF en blanco para no romper el flujo
  console.warn('Creando PDF base desde cero...');
  const nuevoDoc = await PDFDocument.create();
  nuevoDoc.addPage([612, 792]);
  return nuevoDoc;
}

// Carga las fuentes con respaldo a Helvetica estándar para garantizar que no truene
async function cargarFuente(pdfDoc, nombreFuente, fallbackEstandar) {
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
  return await pdfDoc.embedFont(fallbackEstandar);
}

function descargarPDFLocal(bytes, nombreArchivo) {
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

function y(top) {
  return ALTO_PAGINA - top;
}

function texto(page, str, x, top, font, tam, color = NEGRO) {
  if (str === null || str === undefined || str === '') return;
  page.drawText(String(str), { x, y: y(top), size: tam, font, color });
}

function textoCentrado(page, str, xIzq, xDer, top, font, tam, color = NEGRO) {
  if (str === null || str === undefined || str === '') return;
  const s = String(str);
  const ancho = font.widthOfTextAtSize(s, tam);
  const x = xIzq + (xDer - xIzq - ancho) / 2;
  page.drawText(s, { x, y: y(top), size: tam, font, color });
}

function linea(page, x1, top, x2, grosor = 0.75) {
  page.drawLine({ start: { x: x1, y: y(top) }, end: { x: x2, y: y(top) }, thickness: grosor, color: NEGRO });
}

function lineaV(page, x, top1, top2, grosor = 0.75) {
  page.drawLine({ start: { x, y: y(top1) }, end: { x, y: y(top2) }, thickness: grosor, color: NEGRO });
}

function limpiarNombre(t) {
  if (!t) return '';
  const m = t.match(/^([^(]+)/);
  return m ? m[0].trim() : t.trim();
}

function aTitulo(t) {
  if (!t) return '';
  return t
    .toLowerCase()
    .split(' ')
    .map((palabra) => (palabra ? palabra.charAt(0).toUpperCase() + palabra.slice(1) : ''))
    .join(' ');
}

async function obtenerConfigVoBo() {
  try {
    const { data } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .in('clave', ['vobo_nombre', 'vobo_cargo']);
    const map = Object.fromEntries((data || []).map((r) => [r.clave, r.valor]));
    return {
      nombre: map.vobo_nombre || VOBO_NOMBRE_DEFAULT,
      cargo: map.vobo_cargo || VOBO_CARGO_DEFAULT,
    };
  } catch {
    return { nombre: VOBO_NOMBRE_DEFAULT, cargo: VOBO_CARGO_DEFAULT };
  }
}

const CRITERIOS_TEXTO = [
  ['1. Formación profesional relacionada a la ', 'capacitación a impartir.'],
  ['2. Experiencia en capacitación y en la temática a ', 'impartir.'],
  ['3. Materiales didácticos a utilizar.'],
  ['4. Empresas diferentes en las que ha participado ', 'como instructor (a).'],
  ['5. Certificaciones y acreditaciones relacionadas ', 'al área de capacitación.'],
];

const TABLA = {
  xIzq: 56.2,
  xDer: 555.9,
  colCriterio: 307.2,
  cols: [307.2, 340.9, 374.7, 408.3, 442.1, 472.7],
  yTop: 264.2,
  filas: [289.4, 327.1, 365.0, 393.6, 431.5, 469.2],
  yBottom: 484.1,
};
const Y_SCORE = [315.4, 353.2, 380.2, 419.7, 457.5];

export async function descargarCriteriosInstructor(item) {
  try {
    // 1. Cargar plantilla segura con fallback
    const pdfDoc = await cargarPlantillaSegura('Instructores_minimal.pdf');

    // 2. Cargar fuentes seguras
    const fN = await cargarFuente(pdfDoc, 'Roboto-Regular.ttf', StandardFonts.Helvetica);
    const fB = await cargarFuente(pdfDoc, 'Roboto-Bold.ttf', StandardFonts.HelveticaBold);
    const page = pdfDoc.getPages()[0];

    const vobo = await obtenerConfigVoBo();

    // TÍTULO
    textoCentrado(page, 'Criterios para seleccionar instructor (a)', 56, 556, 141.7, fB, 12);

    // DATOS GENERALES
    texto(page, 'Nombre del instructor (a):', 56.8, 187.2, fB, 11);
    texto(page, (item.instructor_nombre || '').toUpperCase(), 197, 186, fN, 10.5, AZUL);
    linea(page, 186.6, 189.5, 548.0);

    texto(page, 'Fecha de evaluación:', 56.8, 206.4, fN, 11);
    const fecha = item.fecha_evaluacion ? new Date(item.fecha_evaluacion + 'T00:00:00') : new Date();
    texto(page, fecha.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }), 172, 205, fN, 10);
    linea(page, 163.2, 206.9, 550.2);

    texto(page, 'Nombre del curso a impartir:', 56.8, 225.4, fB, 11);
    texto(page, (item.curso_nombre || '').toUpperCase(), 212, 224, fN, 9.5, AZUL);
    linea(page, 173.7, 225.0, 560.8);

    texto(page, 'Nombre de la empresa o plantel:', 56.8, 244.4, fN, 11);
    texto(page, (item.empresa_plantel || 'ITD').toUpperCase(), 221, 243, fN, 9.5);
    linea(page, 217.9, 246.2, 550.2);

    // TABLA DE CRITERIOS
    linea(page, TABLA.xIzq, TABLA.yTop, TABLA.xDer, 1);
    TABLA.filas.forEach((t) => linea(page, TABLA.xIzq, t, TABLA.xDer));
    linea(page, TABLA.xIzq, TABLA.yBottom, TABLA.xDer, 1);
    lineaV(page, TABLA.xIzq, TABLA.yTop, TABLA.yBottom, 1);
    lineaV(page, TABLA.xDer, TABLA.yTop, TABLA.yBottom, 1);
    [TABLA.cols[0], TABLA.cols[1], TABLA.cols[2], TABLA.cols[3], TABLA.cols[4]].forEach((x) =>
      lineaV(page, x, TABLA.yTop, TABLA.filas[5])
    );
    lineaV(page, TABLA.cols[5], TABLA.yTop, TABLA.yBottom);

    textoCentrado(page, 'CRITERIO', TABLA.xIzq, TABLA.colCriterio, 288.7, fB, 11);
    const centros1a5 = [
      [TABLA.cols[0], TABLA.cols[1]],
      [TABLA.cols[1], TABLA.cols[2]],
      [TABLA.cols[2], TABLA.cols[3]],
      [TABLA.cols[3], TABLA.cols[4]],
      [TABLA.cols[4], TABLA.cols[5]],
    ];
    ['1', '2', '3', '4', '5'].forEach((n, i) =>
      textoCentrado(page, n, centros1a5[i][0], centros1a5[i][1], 282.7, fB, 11)
    );
    textoCentrado(page, 'TOTAL', TABLA.cols[5], TABLA.xDer, 282.7, fB, 11);

    const yLinea1 = [313.9, 351.7, 391.2, 418.2, 456.0];
    const yLinea2 = [326.5, 364.3, null, 430.8, 468.6];
    CRITERIOS_TEXTO.forEach((lineas, i) => {
      texto(page, lineas[0], 61.7, yLinea1[i], fN, 11);
      if (lineas[1]) texto(page, lineas[1], 73.0, yLinea2[i], fN, 11);
    });

    for (let i = 0; i < 5; i++) {
      const valor = item[`criterio_${i + 1}`];
      textoCentrado(page, valor ?? '-', TABLA.cols[5], TABLA.xDer, Y_SCORE[i], fB, 12, AZUL);
    }
    const total = [1, 2, 3, 4, 5].reduce((s, i) => s + (Number(item[`criterio_${i}`]) || 0), 0);
    textoCentrado(page, total, TABLA.cols[5], TABLA.xDer, 483.4, fB, 13, AZUL);

    texto(page, 'Nota: Evaluar considerando la siguiente escala', 47.8, 508.2, fN, 11);

    const escalaX = [57.0, 161.3, 251.4, 350.3, 449.4, 557.4];
    linea(page, escalaX[0], 521.5, escalaX[5]);
    linea(page, escalaX[0], 534.7, escalaX[5]);
    escalaX.forEach((x) => lineaV(page, x, 521.3, 534.9));
    const escalaTextos = ['1        Malo', '2      Regular', '3         Bien', '4    Muy bien', '5    Excelente'];
    escalaTextos.forEach((t, i) => texto(page, t, escalaX[i] + 6, 534.0, fN, 11));

    texto(page, 'Aceptado :', 405.0, 561.0, fB, 11);
    const aceptadoTxt = item.aceptado ? 'SÍ' : 'NO';
    texto(page, aceptadoTxt, 490, 560, fB, 12, item.aceptado ? VERDE : ROJO);
    linea(page, 483.0, 559.8, 556.3);

    textoCentrado(page, 'Evaluó', 47.7, 276.0, 599.5, fN, 11);
    textoCentrado(page, 'Vo.Bo.', 324.0, 559.4, 599.5, fN, 11);

    linea(page, 47.7, 639.3, 276.0);
    textoCentrado(page, aTitulo(limpiarNombre(item.jefe_departamento || '')), 47.7, 276.0, 651.8, fB, 11);
    textoCentrado(page, item.cargo_evaluador || '', 47.7, 276.0, 664.5, fN, 10);

    linea(page, 324.0, 639.3, 559.4);
    textoCentrado(page, vobo.nombre, 324.0, 559.4, 651.8, fB, 11);
    textoCentrado(page, vobo.cargo, 324.0, 559.4, 664.5, fN, 10);

    const fechaGen = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    texto(page, 'DA', 56.8, 681.5, fB, 8);
    texto(page, fechaGen, 73, 681.5, fN, 8);

    const bytes = await pdfDoc.save();
    if (item.retornarBytes) return bytes;

    const nombreLimpio = (item.curso_nombre || 'Criterios').replace(/[^a-zA-Z0-9 áéíóúñÑ]/g, "_").trim();
    descargarPDFLocal(bytes, `Criterios_${nombreLimpio}.pdf`);
    return true;
  } catch (error) {
    console.error('❌ Error al generar PDF de criterios de instructor:', error);
    throw new Error('No se pudo generar el PDF: ' + error.message);
  }
}
