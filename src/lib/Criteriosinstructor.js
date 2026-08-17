// src/lib/criteriosInstructor.js
// Genera el PDF "Criterios para seleccionar instructor (a)" (ITD-AD-FO-06).
//
// La plantilla base (Instructores_minimal.pdf) SOLO trae el encabezado
// institucional (logo + código SGI) y el pie de página -- igual que
// oficio_registro_blanco.pdf. Todo el cuerpo (título, tabla, líneas,
// texto) se dibuja aquí, para que nada quede "quemado" en el PDF y
// cualquier dato (incluido el Vo.Bo.) se pueda cambiar sin tocar la
// plantilla.

import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { supabase } from './supabaseClient';

const ALTO_PAGINA = 792;
const BASE = import.meta.env.BASE_URL;
const NEGRO = rgb(0.1, 0.1, 0.1);
const AZUL = rgb(0.106, 0.224, 0.416);
const VERDE = rgb(0, 0.5, 0);
const ROJO = rgb(0.75, 0, 0);

// Valores por defecto del Vo.Bo. institucional, usados solo si la tabla
// `configuracion` no tiene los registros vobo_nombre / vobo_cargo.
const VOBO_NOMBRE_DEFAULT = 'Adriana Eréndira Murillo';
const VOBO_CARGO_DEFAULT = 'Subdirección Académica';

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

// Los nombres de docentes vienen guardados en MAYÚSCULAS en la base de datos;
// para que se vean igual que el nombre del Vo.Bo. (capturado en minúsculas/
// mayúsculas normales) los mostramos en formato título en el PDF.
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

// Coordenadas de la tabla (idénticas a la plantilla original ITD-AD-FO-06)
const TABLA = {
  xIzq: 56.2,
  xDer: 555.9,
  colCriterio: 307.2,
  cols: [307.2, 340.9, 374.7, 408.3, 442.1, 472.7],
  yTop: 264.2,
  filas: [289.4, 327.1, 365.0, 393.6, 431.5, 469.2], // fin de cada fila (header + 5 criterios)
  yBottom: 484.1,
};
const Y_SCORE = [315.4, 353.2, 380.2, 419.7, 457.5]; // baseline del puntaje de cada fila

/**
 * Genera y descarga el PDF de criterios para seleccionar instructor.
 * `item`: instructor_nombre, fecha_evaluacion, curso_nombre, empresa_plantel,
 * criterio_1..criterio_5, aceptado (bool), jefe_departamento, cargo_evaluador.
 */
export async function descargarCriteriosInstructor(item) {
  try {
    // ===== 1. Plantilla base (solo encabezado + pie) =====
    const resp = await fetch(`${BASE}plantillas/Instructores_minimal.pdf`);
    if (!resp.ok) throw new Error('No se encontró la plantilla de criterios de instructor');
    const pdfDoc = await PDFDocument.load(await resp.arrayBuffer());

    pdfDoc.registerFontkit(fontkit);
    const [regularBytes, boldBytes] = await Promise.all([
      fetch(`${BASE}fuentes/Roboto-Regular.ttf`).then((r) => r.arrayBuffer()),
      fetch(`${BASE}fuentes/Roboto-Bold.ttf`).then((r) => r.arrayBuffer()),
    ]);
    const fN = await pdfDoc.embedFont(regularBytes);
    const fB = await pdfDoc.embedFont(boldBytes);
    const page = pdfDoc.getPages()[0];

    const vobo = await obtenerConfigVoBo();

    // ===== 2. TÍTULO =====
    textoCentrado(page, 'Criterios para seleccionar instructor (a)', 56, 556, 141.7, fB, 12);

    // ===== 3. DATOS GENERALES =====
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

    // ===== 4. TABLA DE CRITERIOS =====
    // bordes horizontales
    linea(page, TABLA.xIzq, TABLA.yTop, TABLA.xDer, 1);
    TABLA.filas.forEach((t) => linea(page, TABLA.xIzq, t, TABLA.xDer));
    linea(page, TABLA.xIzq, TABLA.yBottom, TABLA.xDer, 1);
    // bordes verticales: exteriores en toda la altura
    lineaV(page, TABLA.xIzq, TABLA.yTop, TABLA.yBottom, 1);
    lineaV(page, TABLA.xDer, TABLA.yTop, TABLA.yBottom, 1);
    // columnas 1-5: solo hasta el final de la fila 5 (no cruzan el renglón de TOTAL general)
    [TABLA.cols[0], TABLA.cols[1], TABLA.cols[2], TABLA.cols[3], TABLA.cols[4]].forEach((x) =>
      lineaV(page, x, TABLA.yTop, TABLA.filas[4])
    );
    // columna TOTAL: cruza hasta el fondo de la tabla (incluye el renglón de total general)
    lineaV(page, TABLA.cols[5], TABLA.yTop, TABLA.yBottom);

    // encabezados de columna
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

    // texto de cada criterio (dos líneas cuando aplica)
    const yLinea1 = [313.9, 351.7, 391.2, 418.2, 456.0];
    const yLinea2 = [326.5, 364.3, null, 430.8, 468.6];
    CRITERIOS_TEXTO.forEach((lineas, i) => {
      texto(page, lineas[0], 61.7, yLinea1[i], fN, 11);
      if (lineas[1]) texto(page, lineas[1], 73.0, yLinea2[i], fN, 11);
    });

    // puntuación de cada criterio + total general
    for (let i = 0; i < 5; i++) {
      const valor = item[`criterio_${i + 1}`];
      textoCentrado(page, valor ?? '-', TABLA.cols[5], TABLA.xDer, Y_SCORE[i], fB, 12, AZUL);
    }
    const total = [1, 2, 3, 4, 5].reduce((s, i) => s + (Number(item[`criterio_${i}`]) || 0), 0);
    textoCentrado(page, total, TABLA.cols[5], TABLA.xDer, 483.4, fB, 13, AZUL);

    // ===== 5. NOTA + ESCALA DE REFERENCIA =====
    texto(page, 'Nota: Evaluar considerando la siguiente escala', 47.8, 508.2, fN, 11);

    const escalaX = [57.0, 161.3, 251.4, 350.3, 449.4, 557.4];
    linea(page, escalaX[0], 521.5, escalaX[5]);
    linea(page, escalaX[0], 534.7, escalaX[5]);
    escalaX.forEach((x) => lineaV(page, x, 521.3, 534.9));
    const escalaTextos = ['1        Malo', '2      Regular', '3         Bien', '4    Muy bien', '5    Excelente'];
    escalaTextos.forEach((t, i) => texto(page, t, escalaX[i] + 6, 534.0, fN, 11));

    // ===== 6. ACEPTADO =====
    texto(page, 'Aceptado :', 405.0, 561.0, fB, 11);
    const aceptadoTxt = item.aceptado ? 'SÍ' : 'NO';
    texto(page, aceptadoTxt, 490, 560, fB, 12, item.aceptado ? VERDE : ROJO);
    linea(page, 483.0, 559.8, 556.3);

    // ===== 7. EVALUÓ / VO.BO. =====
    textoCentrado(page, 'Evaluó', 47.7, 276.0, 599.5, fN, 11);
    textoCentrado(page, 'Vo.Bo.', 324.0, 559.4, 599.5, fN, 11);

    // línea Evaluó: la línea va primero, luego nombre del jefe y cargo debajo
    // (misma disposición que el lado de Vo.Bo., para que no queden asimétricos)
    linea(page, 47.7, 639.3, 276.0);
    textoCentrado(page, aTitulo(limpiarNombre(item.jefe_departamento || '')), 47.7, 276.0, 651.8, fB, 11);
    textoCentrado(page, item.cargo_evaluador || '', 47.7, 276.0, 664.5, fN, 10);

    // línea Vo.Bo.: nombre y cargo configurables (institucional)
    linea(page, 324.0, 639.3, 559.4);
    textoCentrado(page, vobo.nombre, 324.0, 559.4, 651.8, fB, 11);
    textoCentrado(page, vobo.cargo, 324.0, 559.4, 664.5, fN, 10);

    // ===== 8. FECHA DE GENERACIÓN =====
    const fechaGen = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    texto(page, 'DA', 56.8, 681.5, fB, 8);
    texto(page, fechaGen, 73, 681.5, fN, 8);

    // ===== 9. Guardar y descargar =====
    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    return url;
  } catch (error) {
    console.error('❌ Error al generar PDF de criterios de instructor:', error);
    throw new Error('No se pudo generar el PDF: ' + error.message);
  }
}