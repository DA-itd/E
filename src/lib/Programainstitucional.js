// src/lib/programaInstitucional.js
// Genera el "Programa Institucional de Formación y Actualización Docente
// y Profesional" (ITD-AD-PO-04-02) en PDF o Word, a partir de los cursos
// ya aprobados (tabla `cursos`) de uno o ambos periodos de una convocatoria.
//
// El encabezado y pie de página se dibujan por código (logos + texto),
// no dependen de ninguna plantilla externa -- igual que Criterios de
// Instructor. La tabla de cursos pagina sola: en PDF calculamos manualmente
// dónde corta cada página (para poder mostrar "Página X de Y" real); en
// Word dejamos que Word pagine solo y usamos campos automáticos de página.

import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  Header, Footer, WidthType, AlignmentType, VerticalAlign, BorderStyle,
  ImageRun, PageNumber, ShadingType,
} from 'docx';
import { supabase } from './supabaseClient';

const BASE = import.meta.env.BASE_URL;
const ANCHO_PAGINA = 612;
const ALTO_PAGINA = 792;
const MARGEN_X = 56;
const NEGRO = rgb(0.1, 0.1, 0.1);
const AZUL = rgb(0.106, 0.224, 0.416);
const GUINDA = rgb(0.616, 0.141, 0.286);
const GRIS_CLARO = rgb(0.94, 0.94, 0.94);

const COLS = [
  { key: 'no', label: 'No.', width: 22 },
  { key: 'curso', label: 'Curso', width: 100 },
  { key: 'objetivo', label: 'Objetivo', width: 118 },
  { key: 'modalidad', label: 'Horario', width: 48 },
  { key: 'horas', label: 'Horas', width: 30 },
  { key: 'instructor', label: 'Instructor', width: 85 },
  { key: 'dirigido', label: 'Dirigido a', width: 97 },
];
const ANCHO_TABLA = COLS.reduce((s, c) => s + c.width, 0); // 500pt

// Firmantes del documento ("Elaboró" / "Aprobó"), editables sin tocar
// código en la tabla `configuracion` -- "Aprobó" reutiliza las mismas
// claves vobo_nombre/vobo_cargo que ya usa Criterios de Instructor.
const ELABORO_NOMBRE_DEFAULT = 'Mónica Rosales Pérez';
const ELABORO_CARGO_DEFAULT = 'Jefa del Depto. Desarrollo Académico';
const APROBO_NOMBRE_DEFAULT = 'Adriana Eréndira Murillo';
const APROBO_CARGO_DEFAULT = 'Subdirectora Académica';

async function obtenerFirmantes() {
  try {
    const { data } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .in('clave', ['elaboro_nombre', 'elaboro_cargo', 'vobo_nombre', 'vobo_cargo']);
    const map = Object.fromEntries((data || []).map((r) => [r.clave, r.valor]));
    return {
      elaboroNombre: map.elaboro_nombre || ELABORO_NOMBRE_DEFAULT,
      elaboroCargo: map.elaboro_cargo || ELABORO_CARGO_DEFAULT,
      aproboNombre: map.vobo_nombre || APROBO_NOMBRE_DEFAULT,
      aproboCargo: map.vobo_cargo || APROBO_CARGO_DEFAULT,
    };
  } catch {
    return {
      elaboroNombre: ELABORO_NOMBRE_DEFAULT, elaboroCargo: ELABORO_CARGO_DEFAULT,
      aproboNombre: APROBO_NOMBRE_DEFAULT, aproboCargo: APROBO_CARGO_DEFAULT,
    };
  }
}

function y(top) {
  return ALTO_PAGINA - top;
}

async function cargarLogos(pdfDoc) {
  const [tecnmBytes, itdBytes] = await Promise.all([
    fetch(`${BASE}logos/logo-tecnm.jpg`).then((r) => r.arrayBuffer()),
    fetch(`${BASE}logos/logo-itd.jpg`).then((r) => r.arrayBuffer()),
  ]);
  return {
    tecnm: await pdfDoc.embedJpg(tecnmBytes),
    itd: await pdfDoc.embedJpg(itdBytes),
  };
}

// Envuelve texto a un ancho máximo, devuelve arreglo de líneas.
function envolverTexto(texto, font, tam, anchoMax) {
  const palabras = String(texto || '').split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [''];
  const lineas = [];
  let actual = palabras[0];
  for (let i = 1; i < palabras.length; i++) {
    const prueba = actual + ' ' + palabras[i];
    if (font.widthOfTextAtSize(prueba, tam) <= anchoMax) {
      actual = prueba;
    } else {
      lineas.push(actual);
      actual = palabras[i];
    }
  }
  lineas.push(actual);
  return lineas;
}

/**
 * Dibuja el encabezado institucional (logos + código SGI + página X de Y)
 * en la parte superior de una página. Devuelve el "top" en el que termina
 * el encabezado (desde donde puede empezar el contenido).
 */
function dibujarEncabezado(page, logos, fN, fB, pagina, totalPaginas) {
  const top = 40;
  const alto = 78;
  const xIzq = MARGEN_X;
  const xDer = MARGEN_X + ANCHO_TABLA;
  const colLogoAncho = 108;
  const colCodigoAncho = 110;
  const xMidIzq = xIzq + colLogoAncho;
  const xMidDer = xDer - colCodigoAncho;
  const filaAlto = 26;

  // Marco exterior + separadores de columna
  page.drawRectangle({ x: xIzq, y: y(top + alto), width: xDer - xIzq, height: alto, borderColor: NEGRO, borderWidth: 1 });
  page.drawLine({ start: { x: xMidIzq, y: y(top) }, end: { x: xMidIzq, y: y(top + alto) }, thickness: 1, color: NEGRO });
  page.drawLine({ start: { x: xMidDer, y: y(top) }, end: { x: xMidDer, y: y(top + alto) }, thickness: 1, color: NEGRO });
  page.drawLine({ start: { x: xMidIzq, y: y(top + filaAlto) }, end: { x: xDer, y: y(top + filaAlto) }, thickness: 1, color: NEGRO });
  page.drawLine({ start: { x: xMidDer, y: y(top + filaAlto) }, end: { x: xMidDer, y: y(top + alto) }, thickness: 1, color: NEGRO });

  // Logo TecNM (columna izquierda, centrado)
  const tecnmDim = logos.tecnm.scale(0.34);
  page.drawImage(logos.tecnm, {
    x: xIzq + (colLogoAncho - tecnmDim.width) / 2,
    y: y(top + alto / 2 + tecnmDim.height / 2 + 4),
    width: tecnmDim.width,
    height: tecnmDim.height,
  });

  // Logo ITD (chico, dentro de la fila superior de la columna media)
  const itdDim = logos.itd.scale(0.011);
  page.drawImage(logos.itd, {
    x: xMidIzq + 4,
    y: y(top + filaAlto - 3),
    width: itdDim.width,
    height: itdDim.height,
  });
  page.drawText('INSTITUTO TECNOLÓGICO DE DURANGO', {
    x: xMidIzq + 4 + itdDim.width + 8,
    y: y(top + 17),
    size: 10.5,
    font: fB,
    color: NEGRO,
  });

  // Subtítulo (fila inferior de la columna media, 3 líneas)
  const subtitulo = ['Formato de Programa Institucional de Formación y', 'Actualización Docente y Profesional'];
  textoCentradoSimple(page, subtitulo[0], xMidIzq, xMidDer, top + filaAlto + 14, fN, 8.5);
  textoCentradoSimple(page, subtitulo[1], xMidIzq, xMidDer, top + filaAlto + 25, fN, 8.5);
  textoCentradoSimple(page, 'Referencias a la Norma ISO 9001:2015   7.2, 7.3', xMidIzq, xMidDer, top + filaAlto + 39, fN, 8);

  // Columna derecha: Código / Revisión / Página X de Y
  textoCentradoSimple(page, 'Código: ITD-AD-PO-04-02', xMidDer, xDer, top + 16, fN, 8.5);
  textoCentradoSimple(page, 'Revisión: 0', xMidDer, xDer, top + filaAlto + 14, fN, 8.5);
  textoCentradoSimple(page, `Página ${pagina} de ${totalPaginas}`, xMidDer, xDer, top + filaAlto + 32, fB, 9);

  return top + alto + 10;
}

function textoCentradoSimple(page, texto, xIzq, xDer, top, font, tam, color = NEGRO) {
  const ancho = font.widthOfTextAtSize(texto, tam);
  page.drawText(texto, { x: xIzq + (xDer - xIzq - ancho) / 2, y: y(top), size: tam, font, color });
}

function dibujarPie(page, fN) {
  const alto = 16;
  const top = ALTO_PAGINA - 40;
  page.drawRectangle({
    x: MARGEN_X, y: y(top + alto), width: ANCHO_TABLA, height: alto, color: GUINDA,
  });
  page.drawText('ITD-AD-PO-04-02', { x: MARGEN_X + 8, y: y(top + alto - 5), size: 8, font: fN, color: rgb(1, 1, 1) });
  const txt = 'Revisión: 0';
  const ancho = fN.widthOfTextAtSize(txt, 8);
  page.drawText(txt, { x: MARGEN_X + ANCHO_TABLA - 8 - ancho, y: y(top + alto - 5), size: 8, font: fN, color: rgb(1, 1, 1) });
}

const AZUL_CLARO = rgb(0.792, 0.882, 0.925);
const ALTO_FIRMAS = 128;

/** Dibuja el bloque "Elaboró / Aprobó" con nombre, cargo, "Nombre y firma" y fecha. */
function dibujarFirmas(page, fN, fB, firmantes, fechaTexto, top) {
  const xIzq = MARGEN_X;
  const xMed = MARGEN_X + ANCHO_TABLA / 2;
  const xDer = MARGEN_X + ANCHO_TABLA;
  const filas = [
    { alto: 20, tipo: 'header' },
    { alto: 46, tipo: 'nombre' }, // alta y con el texto pegado abajo: deja espacio en blanco arriba para la firma autógrafa
    { alto: 16, tipo: 'cargo' },  // angosta, el cargo es texto corto
    { alto: 22, tipo: 'firma' },
    { alto: 24, tipo: 'fecha' },
  ];
  let cursor = top;
  filas.forEach((fila) => {
    if (fila.tipo === 'header' || fila.tipo === 'firma') {
      page.drawRectangle({ x: xIzq, y: y(cursor + fila.alto), width: ANCHO_TABLA, height: fila.alto, color: AZUL_CLARO });
    }
    if (fila.tipo === 'header') {
      textoCentradoSimple(page, 'Elaboró', xIzq, xMed, cursor + 14, fB, 10);
      textoCentradoSimple(page, 'Aprobó', xMed, xDer, cursor + 14, fB, 10);
    } else if (fila.tipo === 'nombre') {
      // Texto pegado al fondo de la fila (deja ~36pt en blanco arriba, para firmar a mano)
      textoCentradoSimple(page, firmantes.elaboroNombre.toUpperCase(), xIzq, xMed, cursor + fila.alto - 8, fB, 9.5);
      textoCentradoSimple(page, firmantes.aproboNombre.toUpperCase(), xMed, xDer, cursor + fila.alto - 8, fB, 9.5);
    } else if (fila.tipo === 'cargo') {
      const lineasE = envolverTexto(firmantes.elaboroCargo.toUpperCase(), fN, 8, ANCHO_TABLA / 2 - 16);
      const lineasA = envolverTexto(firmantes.aproboCargo.toUpperCase(), fN, 8, ANCHO_TABLA / 2 - 16);
      const offsetY = lineasE.length > 1 || lineasA.length > 1 ? 7 : 11;
      lineasE.forEach((l, i) => textoCentradoSimple(page, l, xIzq, xMed, cursor + offsetY + i * 9, fN, 8));
      lineasA.forEach((l, i) => textoCentradoSimple(page, l, xMed, xDer, cursor + offsetY + i * 9, fN, 8));
    } else if (fila.tipo === 'firma') {
      textoCentradoSimple(page, 'Nombre y firma', xIzq, xMed, cursor + 15, fN, 9);
      textoCentradoSimple(page, 'Nombre y firma', xMed, xDer, cursor + 15, fN, 9);
    } else if (fila.tipo === 'fecha') {
      page.drawText(`Fecha:  ${fechaTexto}`, { x: xIzq + 10, y: y(cursor + 16), size: 9, font: fN, color: NEGRO });
      page.drawText(`Fecha:  ${fechaTexto}`, { x: xMed + 10, y: y(cursor + 16), size: 9, font: fN, color: NEGRO });
    }
    cursor += fila.alto;
  });
  // Marco exterior + divisor central
  page.drawRectangle({ x: xIzq, y: y(cursor), width: ANCHO_TABLA, height: cursor - top, borderColor: NEGRO, borderWidth: 1 });
  page.drawLine({ start: { x: xMed, y: y(top) }, end: { x: xMed, y: y(cursor) }, thickness: 1, color: NEGRO });
  let cy = top;
  filas.forEach((fila) => { cy += fila.alto; page.drawLine({ start: { x: xIzq, y: y(cy) }, end: { x: xDer, y: y(cy) }, thickness: 0.5, color: NEGRO }); });
}

/**
 * Genera el PDF y abre la descarga. `cursos` ya viene filtrado/ordenado.
 * `periodoLabel` es el texto a mostrar como título del programa
 * (ej. "Periodo 1 (10 al 14 de agosto de 2026)" o "Periodo 1 y Periodo 2").
 */
export async function descargarProgramaPDF(cursos, periodoLabel) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    fetch(`${BASE}fuentes/Roboto-Regular.ttf`).then((r) => r.arrayBuffer()),
    fetch(`${BASE}fuentes/Roboto-Bold.ttf`).then((r) => r.arrayBuffer()),
  ]);
  const fN = await pdfDoc.embedFont(regularBytes);
  const fB = await pdfDoc.embedFont(boldBytes);
  const logos = await cargarLogos(pdfDoc);

  const PAD = 4;
  const LINE_H = 10;
  const FILA_MIN = 20;
  const TABLE_HEADER_H = 20;
  const CONTENIDO_TOP = 138; // debajo del encabezado + título de periodo
  const CONTENIDO_BOTTOM = ALTO_PAGINA - 60; // arriba del pie

  // Pre-calcular líneas envueltas y alto de cada fila
  const filas = cursos.map((c, i) => {
    const celdas = {
      no: [String(i + 1)],
      curso: envolverTexto(c.nombre, fB, 8, COLS[1].width - 2 * PAD),
      objetivo: envolverTexto(c.objetivo || '—', fN, 7.5, COLS[2].width - 2 * PAD),
      modalidad: envolverTexto(c.horario || '', fN, 7.5, COLS[3].width - 2 * PAD),
      horas: [String(c.horas || '')],
      instructor: envolverTexto(c.instructor || '', fN, 7.5, COLS[5].width - 2 * PAD),
      dirigido: envolverTexto(c.departamento || '', fN, 7.5, COLS[6].width - 2 * PAD),
    };
    const maxLineas = Math.max(...Object.values(celdas).map((l) => l.length));
    const alto = Math.max(FILA_MIN, maxLineas * LINE_H + 2 * PAD);
    return { celdas, alto };
  });

  // Paginar: agrupar filas en páginas según el espacio disponible
  const paginas = [];
  let paginaActual = [];
  let usado = TABLE_HEADER_H;
  const alturaUtil = CONTENIDO_BOTTOM - CONTENIDO_TOP;
  filas.forEach((fila) => {
    if (usado + fila.alto > alturaUtil && paginaActual.length > 0) {
      paginas.push(paginaActual);
      paginaActual = [];
      usado = TABLE_HEADER_H;
    }
    paginaActual.push(fila);
    usado += fila.alto;
  });
  if (paginaActual.length > 0 || paginas.length === 0) paginas.push(paginaActual);

  // ¿Caben las firmas al final de la última página, o necesitan una página aparte?
  // (se decide ANTES de dibujar nada, para que "Página X de Y" salga bien desde la primera página)
  const finEncabezadoConst = 40 + 78 + 10; // = dibujarEncabezado(...) siempre regresa esto
  const ultimaPagina = paginas[paginas.length - 1];
  const inicioUltimaTabla = paginas.length === 1 ? finEncabezadoConst + 24 : finEncabezadoConst + 6;
  const finUltimaTabla = inicioUltimaTabla + TABLE_HEADER_H + ultimaPagina.reduce((s, f) => s + f.alto, 0);
  const GAP_FIRMAS = 34;
  const firmasCabenEnUltima = finUltimaTabla + GAP_FIRMAS + ALTO_FIRMAS <= CONTENIDO_BOTTOM;
  const totalPaginas = paginas.length + (firmasCabenEnUltima ? 0 : 1);

  const firmantes = await obtenerFirmantes();
  const fechaTexto = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });

  let paginaFinal = null;
  let cursorFinal = 0;

  paginas.forEach((filasPagina, idx) => {
    const page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
    const finEncabezado = dibujarEncabezado(page, logos, fN, fB, idx + 1, totalPaginas);

    if (idx === 0) {
      textoCentradoSimple(page, `Programa: ${periodoLabel}`, MARGEN_X, MARGEN_X + ANCHO_TABLA, finEncabezado + 12, fB, 11, AZUL);
    }

    let cursorTop = idx === 0 ? finEncabezado + 24 : finEncabezado + 6;

    // Encabezado de la tabla
    let x = MARGEN_X;
    page.drawRectangle({ x: MARGEN_X, y: y(cursorTop + TABLE_HEADER_H), width: ANCHO_TABLA, height: TABLE_HEADER_H, color: AZUL });
    COLS.forEach((col) => {
      textoCentradoSimple(page, col.label, x, x + col.width, cursorTop + 14, fB, 8, rgb(1, 1, 1));
      x += col.width;
    });
    cursorTop += TABLE_HEADER_H;

    // Filas
    filasPagina.forEach((fila, i) => {
      if (i % 2 === 1) {
        page.drawRectangle({ x: MARGEN_X, y: y(cursorTop + fila.alto), width: ANCHO_TABLA, height: fila.alto, color: GRIS_CLARO });
      }
      let cx = MARGEN_X;
      COLS.forEach((col) => {
        const lineas = fila.celdas[col.key];
        const font = col.key === 'curso' ? fB : fN;
        lineas.forEach((linea, li) => {
          page.drawText(linea, { x: cx + PAD, y: y(cursorTop + PAD + 8 + li * LINE_H), size: col.key === 'curso' ? 8 : 7.5, font, color: NEGRO });
        });
        cx += col.width;
      });
      cursorTop += fila.alto;
    });

    // Bordes de la tabla en esta página
    const inicioTabla = idx === 0 ? finEncabezado + 24 : finEncabezado + 6;
    page.drawRectangle({ x: MARGEN_X, y: y(cursorTop), width: ANCHO_TABLA, height: cursorTop - inicioTabla, borderColor: NEGRO, borderWidth: 1 });
    let xb = MARGEN_X;
    COLS.forEach((col) => {
      xb += col.width;
      page.drawLine({ start: { x: xb, y: y(inicioTabla) }, end: { x: xb, y: y(cursorTop) }, thickness: 0.5, color: NEGRO });
    });

    dibujarPie(page, fN);

    if (idx === paginas.length - 1) { paginaFinal = page; cursorFinal = cursorTop; }
  });

  // Bloque de firmas: en la última página si cupo, si no en una página nueva
  if (firmasCabenEnUltima) {
    dibujarFirmas(paginaFinal, fN, fB, firmantes, fechaTexto, cursorFinal + GAP_FIRMAS);
  } else {
    const page = pdfDoc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
    const finEncabezado = dibujarEncabezado(page, logos, fN, fB, totalPaginas, totalPaginas);
    dibujarFirmas(page, fN, fB, firmantes, fechaTexto, finEncabezado + 20);
    dibujarPie(page, fN);
  }

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  return url;
}

/**
 * Genera el Word (.docx) y dispara la descarga. Word pagina la tabla
 * solo; usamos PAGE/NUMPAGES para que "Página X de Y" se calcule solo
 * y quede correcto sin importar cuántas páginas resulten al imprimir.
 */
export async function descargarProgramaWord(cursos, periodoLabel) {
  const [tecnmBytes, itdBytes] = await Promise.all([
    fetch(`${BASE}logos/logo-tecnm.jpg`).then((r) => r.arrayBuffer()),
    fetch(`${BASE}logos/logo-itd.jpg`).then((r) => r.arrayBuffer()),
  ]);
  const firmantes = await obtenerFirmantes();
  const fechaTexto = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const celdaTexto = (texto, opts = {}) => new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: opts.shade ? { type: ShadingType.CLEAR, fill: 'F0F0F0' } : undefined,
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ font: 'Arial', text: texto || (opts.dash ? '—' : ''), bold: !!opts.bold, size: 15 })],
    })],
  });

  const anchoDxa = { no: 400, curso: 1900, objetivo: 2400, modalidad: 950, horas: 550, instructor: 1650, dirigido: 1950 };

  const filaEncabezado = new TableRow({
    tableHeader: true,
    children: [
      celdaTexto('No.', { width: anchoDxa.no, bold: true, center: true, shade: true }),
      celdaTexto('Curso', { width: anchoDxa.curso, bold: true, shade: true }),
      celdaTexto('Objetivo', { width: anchoDxa.objetivo, bold: true, shade: true }),
      celdaTexto('Horario', { width: anchoDxa.modalidad, bold: true, shade: true }),
      celdaTexto('Horas', { width: anchoDxa.horas, bold: true, center: true, shade: true }),
      celdaTexto('Instructor', { width: anchoDxa.instructor, bold: true, shade: true }),
      celdaTexto('Dirigido a', { width: anchoDxa.dirigido, bold: true, shade: true }),
    ],
  });

  const filasCursos = cursos.map((c, i) => new TableRow({
    children: [
      celdaTexto(String(i + 1), { width: anchoDxa.no, center: true }),
      celdaTexto(c.nombre, { width: anchoDxa.curso, bold: true }),
      celdaTexto(c.objetivo, { width: anchoDxa.objetivo, dash: true }),
      celdaTexto(c.horario, { width: anchoDxa.modalidad }),
      celdaTexto(String(c.horas || ''), { width: anchoDxa.horas, center: true }),
      celdaTexto(c.instructor, { width: anchoDxa.instructor }),
      celdaTexto(c.departamento, { width: anchoDxa.dirigido }),
    ],
  }));

  const tabla = new Table({
    width: { size: 9800, type: WidthType.DXA },
    rows: [filaEncabezado, ...filasCursos],
  });

  const bordeCelda = { style: BorderStyle.SINGLE, size: 2, color: '999999' };
  const encabezadoDoc = new Header({
    children: [
      new Table({
        width: { size: 9800, type: WidthType.DXA },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 1650, type: WidthType.DXA },
                rowSpan: 2,
                verticalAlign: VerticalAlign.CENTER,
                borders: { top: bordeCelda, bottom: bordeCelda, left: bordeCelda, right: bordeCelda },
                children: [new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new ImageRun({ data: tecnmBytes, transformation: { width: 90, height: 41 } })],
                })],
              }),
              new TableCell({
                width: { size: 6450, type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                borders: { top: bordeCelda, bottom: bordeCelda, left: bordeCelda, right: bordeCelda },
                children: [new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new ImageRun({ data: itdBytes, transformation: { width: 24, height: 24 } }),
                    new TextRun({ font: 'Arial', text: '  INSTITUTO TECNOLÓGICO DE DURANGO', bold: true, size: 20 }),
                  ],
                })],
              }),
              new TableCell({
                width: { size: 1700, type: WidthType.DXA },
                borders: { top: bordeCelda, bottom: bordeCelda, left: bordeCelda, right: bordeCelda },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ font: 'Arial', text: 'Código: ITD-AD-PO-04-02', size: 15 })] })],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                width: { size: 6450, type: WidthType.DXA },
                borders: { top: bordeCelda, bottom: bordeCelda, left: bordeCelda, right: bordeCelda },
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ font: 'Arial', text: 'Formato de Programa Institucional de Formación y Actualización Docente y Profesional', size: 16 })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ font: 'Arial', text: 'Referencias a la Norma ISO 9001:2015   7.2, 7.3', size: 14 })] }),
                ],
              }),
              new TableCell({
                width: { size: 1700, type: WidthType.DXA },
                borders: { top: bordeCelda, bottom: bordeCelda, left: bordeCelda, right: bordeCelda },
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ font: 'Arial', text: 'Revisión: 0', size: 15 })] }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ font: 'Arial', text: 'Página ', size: 15, bold: true }),
                      new TextRun({ children: [PageNumber.CURRENT], size: 15, bold: true }),
                      new TextRun({ font: 'Arial', text: ' de ', size: 15, bold: true }),
                      new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, bold: true }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ text: '' }),
    ],
  });

  const pieDoc = new Footer({
    children: [
      new Table({
        width: { size: 9800, type: WidthType.DXA },
        rows: [new TableRow({
          children: [
            new TableCell({
              width: { size: 4900, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: '9D2449' },
              children: [new Paragraph({ children: [new TextRun({ font: 'Arial', text: 'ITD-AD-PO-04-02', color: 'FFFFFF', size: 14 })] })],
            }),
            new TableCell({
              width: { size: 4900, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: '9D2449' },
              children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ font: 'Arial', text: 'Revisión: 0', color: 'FFFFFF', size: 14 })] })],
            }),
          ],
        })],
      }),
    ],
  });

  const bordeFirma = { style: BorderStyle.SINGLE, size: 2, color: '000000' };
  const bordesFirma = { top: bordeFirma, bottom: bordeFirma, left: bordeFirma, right: bordeFirma };
  const celdaFirmaTexto = (texto, opts) => {
    const parrafos = [];
    if (opts.espacioArriba) parrafos.push(new Paragraph({ text: '', spacing: { before: 300 } }));
    parrafos.push(new Paragraph({ alignment: opts.left ? AlignmentType.LEFT : AlignmentType.CENTER, children: [new TextRun({ font: 'Arial', text: texto, bold: !!opts.bold, size: opts.size || 18 })] }));
    return new TableCell({ width: { size: 4900, type: WidthType.DXA }, borders: bordesFirma, shading: opts.shade ? { type: ShadingType.CLEAR, fill: 'CBE1EC' } : undefined, verticalAlign: VerticalAlign.CENTER, children: parrafos });
  };
  const filaFirma = (izq, der, opts = {}) => new TableRow({ children: [celdaFirmaTexto(izq, opts), celdaFirmaTexto(der, opts)] });

  const tablaFirmas = new Table({
    width: { size: 9800, type: WidthType.DXA },
    rows: [
      filaFirma('Elaboró', 'Aprobó', { bold: true, shade: true, size: 20 }),
      filaFirma(firmantes.elaboroNombre.toUpperCase(), firmantes.aproboNombre.toUpperCase(), { bold: true, espacioArriba: true }),
      filaFirma(firmantes.elaboroCargo.toUpperCase(), firmantes.aproboCargo.toUpperCase(), { size: 15 }),
      filaFirma('Nombre y firma', 'Nombre y firma', { shade: true }),
      filaFirma(`Fecha:  ${fechaTexto}`, `Fecha:  ${fechaTexto}`, { left: true }),
    ],
  });

  const doc = new Document({
    sections: [{
      headers: { default: encabezadoDoc },
      footers: { default: pieDoc },
      properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ font: 'Arial', text: `Programa: ${periodoLabel}`, bold: true, size: 24, color: '1B396A' })],
        }),
        tabla,
        new Paragraph({ text: '', spacing: { before: 300 } }),
        tablaFirmas,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Programa_Institucional_${periodoLabel.replace(/\s+/g, '_')}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return url;
}