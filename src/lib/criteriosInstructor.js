// src/lib/criteriosInstructor.js
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Genera el PDF de evaluación usando la plantilla original
 * y rellenando los campos con pdf-lib
 */
export async function generarPDFCriterios(datos) {
  console.log('📝 Generando PDF con plantilla original...');
  
  try {
    // ===== 1. Cargar la plantilla PDF original =====
    const PLANTILLA_URL = window.location.origin + '/ITD-AD-FO-06 Formatos de Criterios para Seleccionar Instructores.pdf';
    
    console.log('🔍 Cargando plantilla desde:', PLANTILLA_URL);
    
    const response = await fetch(PLANTILLA_URL);
    if (!response.ok) {
      throw new Error(`No se pudo cargar la plantilla (${response.status})`);
    }
    
    const plantillaBytes = await response.arrayBuffer();
    console.log('✅ Plantilla cargada, tamaño:', plantillaBytes.byteLength, 'bytes');
    
    // ===== 2. Cargar el PDF =====
    const pdfDoc = await PDFDocument.load(plantillaBytes);
    const page = pdfDoc.getPages()[0];
    const { height } = page.getSize();
    
    // ===== 3. Usar fuentes estándar =====
    const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Colores
    const azul = rgb(0.106, 0.224, 0.416);
    const negro = rgb(0, 0, 0);
    const rojo = rgb(0.8, 0, 0);
    const verde = rgb(0, 0.5, 0);
    
    // ===== 4. Función para dibujar texto =====
    function drawText(texto, x, y, tam = 10, font = fontNormal, color = negro) {
      if (!texto) return;
      try {
        const textoLimpio = texto
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/ñ/g, 'n')
          .replace(/Ñ/g, 'N')
          .replace(/✓/g, 'SI')
          .replace(/✗/g, 'NO');
        
        page.drawText(textoLimpio, {
          x: x,
          y: height - y,
          size: tam,
          font: font,
          color: color
        });
      } catch (e) {
        console.warn('Error dibujando texto:', e.message);
      }
    }
    
    // ===== 5. Función para limpiar nombre =====
    function limpiarNombre(texto) {
      if (!texto) return '';
      const match = texto.match(/^([^(]+)/);
      return match ? match[0].trim() : texto.trim();
    }
    
    // ===== 6. Preparar fechas =====
    const fecha = datos.fecha_evaluacion ? new Date(datos.fecha_evaluacion) : new Date();
    const fechaStr = fecha.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const fechaGen = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // ===== 7. RELLENAR CAMPOS EN LA PLANTILLA =====
    // NOTA: AJUSTA LAS COORDENADAS (x, y) SEGÚN TU PLANTILLA
    
    // Nombre del instructor
    drawText(datos.instructor_nombre || 'No especificado', 250, 115, 11, fontBold, azul);
    
    // Fecha de evaluación
    drawText(fechaStr, 250, 140, 10, fontNormal);
    
    // Nombre del curso
    drawText(datos.curso_nombre || 'No especificado', 250, 165, 10, fontNormal, azul);
    
    // Empresa o plantel
    drawText(datos.empresa_plantel || 'ITD', 250, 190, 10, fontNormal);
    
    // ===== TABLA DE CRITERIOS =====
    const yCriterios = [240, 268, 296, 324, 352];
    const xPuntuacion = 520;
    
    for (let i = 0; i < 5; i++) {
      const valor = datos[`criterio_${i + 1}`] || '-';
      drawText(String(valor), xPuntuacion, yCriterios[i], 12, fontBold, azul);
    }
    
    // TOTAL GENERAL
    drawText(String(datos.puntuacion_total || 0), 550, 400, 16, fontBold, azul);
    
    // ===== RESULTADO =====
    const aceptado = datos.aceptado ? 'SI' : 'NO';
    const colorAceptado = datos.aceptado ? verde : rojo;
    drawText(aceptado, 200, 460, 14, fontBold, colorAceptado);
    
    // ===== EVALUADOR =====
    const jefeLimpio = limpiarNombre(datos.jefe_departamento || 'No especificado');
    drawText(jefeLimpio, 180, 510, 10, fontNormal, azul);
    drawText(datos.cargo_evaluador || 'No especificado', 180, 535, 10, fontNormal);
    
    // ===== FECHA DE GENERACIÓN =====
    drawText('DA ' + fechaGen, 450, 700, 8, fontNormal);
    
    // ===== 8. Guardar PDF =====
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    console.log('✅ PDF generado exitosamente');
    return url;
    
  } catch (error) {
    console.error('❌ Error al generar PDF:', error);
    throw new Error('No se pudo generar el PDF: ' + error.message);
  }
}