// src/lib/criteriosInstructor.js
// COPIADO Y ADAPTADO DE oficio.js

import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const ALTO_PAGINA = 792;
const BASE = import.meta.env.BASE_URL;
const NEGRO = rgb(0.1, 0.1, 0.1);
const AZUL = rgb(0.106, 0.224, 0.416);

function y(top) {
  return ALTO_PAGINA - top;
}

function dibujarTexto(page, texto, x, top, font, tam, color = NEGRO) {
  if (!texto) return;
  page.drawText(texto, { x, y: y(top), size: tam, font, color });
}

function limpiarNombre(texto) {
  if (!texto) return '';
  const match = texto.match(/^([^(]+)/);
  return match ? match[0].trim() : texto.trim();
}

/**
 * Genera y descarga el PDF de criterios para seleccionar instructor
 * SIGUE LA MISMA ESTRUCTURA QUE descargarOficioRegistro en oficio.js
 */
export async function descargarCriteriosInstructor(item, convocatoria) {
  console.log('📄 Generando PDF de criterios instructor...');
  
  try {
    // ===== 1. Cargar plantilla base =====
    const resp = await fetch(`${BASE}ITD-AD-FO-06 Formatos de Criterios para Seleccionar Instructores.pdf`);
    const plantillaBytes = await resp.arrayBuffer();
    const pdfDoc = await PDFDocument.load(plantillaBytes);
    
    // ===== 2. Registrar fontkit y fuentes =====
    pdfDoc.registerFontkit(fontkit);
    const [regularBytes, boldBytes] = await Promise.all([
      fetch(`${BASE}fuentes/Roboto-Regular.ttf`).then(r => r.arrayBuffer()),
      fetch(`${BASE}fuentes/Roboto-Bold.ttf`).then(r => r.arrayBuffer()),
    ]);
    const fontNormal = await pdfDoc.embedFont(regularBytes);
    const fontBold = await pdfDoc.embedFont(boldBytes);
    
    const page = pdfDoc.getPages()[0];
    
    // ===== 3. RELLENAR CAMPOS =====
    // Nombre del instructor
    dibujarTexto(page, item.instructor_nombre || 'No especificado', 250, 115, fontBold, 11, AZUL);
    
    // Fecha de evaluación
    const fecha = item.fecha_evaluacion ? new Date(item.fecha_evaluacion) : new Date();
    const fechaStr = fecha.toLocaleDateString('es-MX');
    dibujarTexto(page, fechaStr, 250, 140, fontNormal, 10);
    
    // Curso
    dibujarTexto(page, item.curso_nombre || 'No especificado', 250, 165, fontNormal, 10, AZUL);
    
    // Empresa
    dibujarTexto(page, item.empresa_plantel || 'ITD', 250, 190, fontNormal, 10);
    
    // Criterios (1-5)
    const yCriterios = [240, 268, 296, 324, 352];
    for (let i = 0; i < 5; i++) {
      const valor = item[`criterio_${i + 1}`] || '-';
      dibujarTexto(page, String(valor), 520, yCriterios[i], fontBold, 12, AZUL);
    }
    
    // Total
    const total = item.criterio_1 + item.criterio_2 + item.criterio_3 + item.criterio_4 + item.criterio_5 || 0;
    dibujarTexto(page, String(total), 550, 400, fontBold, 16, AZUL);
    
    // Aceptado
    const aceptado = item.aceptado ? 'SI' : 'NO';
    const colorAceptado = item.aceptado ? rgb(0, 0.5, 0) : rgb(0.8, 0, 0);
    dibujarTexto(page, aceptado, 200, 460, fontBold, 14, colorAceptado);
    
    // Jefe de departamento
    const jefeLimpio = limpiarNombre(item.jefe_departamento || 'No especificado');
    dibujarTexto(page, jefeLimpio, 180, 510, fontNormal, 10, AZUL);
    
    // Cargo
    dibujarTexto(page, item.cargo_evaluador || 'No especificado', 180, 535, fontNormal, 10);
    
    // Fecha de generación
    const fechaGen = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    dibujarTexto(page, 'DA ' + fechaGen, 450, 700, fontNormal, 8);
    
    // ===== 4. Guardar y descargar =====
    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    // Abrir en nueva ventana para descarga
    window.open(url, '_blank');
    
    console.log('✅ PDF generado exitosamente');
    return url;
    
  } catch (error) {
    console.error('❌ Error al generar PDF:', error);
    throw new Error('No se pudo generar el PDF: ' + error.message);
  }
}