// src/lib/criteriosInstructor.js
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const BASE = import.meta.env.BASE_URL || '/';

// Plantilla base del formato de criterios
const PLANTILLA_URL = `${BASE}plantillas/criterios_instructor_base.pdf`;

export async function generarPDFCriterios(datos) {
  try {
    // Cargar plantilla
    const response = await fetch(PLANTILLA_URL);
    const plantillaBytes = await response.arrayBuffer();
    
    const pdfDoc = await PDFDocument.load(plantillaBytes);
    pdfDoc.registerFontkit(fontkit);
    
    // Cargar fuentes
    const [regularBytes, boldBytes] = await Promise.all([
      fetch(`${BASE}fuentes/Roboto-Regular.ttf`).then(r => r.arrayBuffer()),
      fetch(`${BASE}fuentes/Roboto-Bold.ttf`).then(r => r.arrayBuffer())
    ]);
    
    const fontNormal = await pdfDoc.embedFont(regularBytes);
    const fontBold = await pdfDoc.embedFont(boldBytes);
    
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();
    
    // Colores
    const colorAzul = rgb(0.106, 0.224, 0.416); // #1B396A
    const colorNegro = rgb(0.1, 0.1, 0.1);
    
    // Función auxiliar para dibujar texto
    function drawText(texto, x, y, tam = 10, font = fontNormal, color = colorNegro) {
      page.drawText(texto, {
        x,
        y: height - y,
        size: tam,
        font,
        color
      });
    }
    
    // --- Llenar campos ---
    // Nombre del instructor
    drawText(datos.instructor_nombre || '', 140, 170, 11, fontBold, colorAzul);
    
    // Fecha de evaluación
    const fecha = new Date(datos.fecha_evaluacion);
    const fechaStr = fecha.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    drawText(fechaStr, 440, 170, 10, fontNormal);
    
    // Nombre del curso
    drawText(datos.curso_nombre || '', 140, 195, 10, fontNormal);
    
    // Empresa/Plantel
    drawText(datos.empresa_plantel || 'ITD', 140, 215, 10, fontNormal);
    
    // Criterios (puntuaciones)
    const yCriterios = 270;
    for (let i = 1; i <= 5; i++) {
      const valor = datos[`criterio_${i}`] || '-';
      drawText(String(valor), 460, yCriterios + (i - 1) * 32, 11, fontBold, colorAzul);
    }
    
    // Total
    const total = datos.puntuacion_total || 0;
    drawText(String(total), 510, 435, 14, fontBold, colorAzul);
    
    // Aceptado
    const aceptado = datos.aceptado ? 'SI' : 'NO';
    drawText(aceptado, 220, 478, 11, fontBold, datos.aceptado ? rgb(0, 0.5, 0) : rgb(0.8, 0, 0));
    
    // Jefe de departamento
    drawText(datos.jefe_departamento || '', 160, 525, 10, fontNormal);
    
    // Cargo del evaluador
    drawText(datos.cargo_evaluador || '', 160, 545, 10, fontNormal);
    
    // Fecha de generación
    const fechaGen = datos.fecha_generacion || new Date().toLocaleDateString('es-MX');
    drawText(fechaGen, 440, 690, 8, fontNormal);
    
    // Guardar PDF
    const pdfBytes = await pdfDoc.save();
    
    // Crear URL para descarga
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    return url;
    
  } catch (error) {
    console.error('Error al generar PDF de criterios:', error);
    throw new Error('No se pudo generar el PDF. Intenta de nuevo.');
  }
}