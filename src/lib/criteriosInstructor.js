// src/lib/criteriosInstructor.js
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// ========== NUEVO: Detectar entorno (local vs producción) ==========
const isProduction = import.meta.env.PROD;
const BASE_URL = isProduction ? '/A/' : '/';

console.log('🌍 Entorno:', isProduction ? 'Producción' : 'Desarrollo');
console.log('📁 BASE_URL:', BASE_URL);

// ========== NUEVO: Buscar la plantilla en múltiples ubicaciones ==========
const PLANTILLAS = [
  // Para producción (GitHub Pages)
  `${BASE_URL}ITD-AD-FO-06%20Formatos%20de%20Criterios%20para%20Seleccionar%20Instructores.pdf`,
  `${BASE_URL}ITD-AD-FO-06-Formatos-de-Criterios-para-Seleccionar-Instructores.pdf`,
  // Para desarrollo local
  `/ITD-AD-FO-06%20Formatos%20de%20Criterios%20para%20Seleccionar%20Instructores.pdf`,
  `/ITD-AD-FO-06-Formatos-de-Criterios-para-Seleccionar-Instructores.pdf`,
  // Fallback: sin espacios
  `/ITD-AD-FO-06.pdf`,
  // En la carpeta plantillas
  `/plantillas/ITD-AD-FO-06.pdf`,
  `/plantillas/criterios_instructor_base.pdf`,
];

console.log('🔍 Intentando cargar plantilla desde:', PLANTILLAS[0]);

export async function generarPDFCriterios(datos) {
  console.log('📝 Generando PDF con datos:', datos);
  
  let plantillaBytes = null;
  let plantillaUrl = null;
  
  // ========== 1. Intentar cargar la plantilla desde múltiples ubicaciones ==========
  for (const url of PLANTILLAS) {
    try {
      console.log(`🔍 Intentando: ${url}`);
      const response = await fetch(url);
      
      if (response.ok) {
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > 1000) { // Verificar que no esté vacío
          plantillaBytes = bytes;
          plantillaUrl = url;
          console.log(`✅ Plantilla encontrada en: ${url}, tamaño: ${bytes.byteLength} bytes`);
          break;
        } else {
          console.warn(`⚠️ Archivo muy pequeño en ${url}: ${bytes.byteLength} bytes`);
        }
      }
    } catch (e) {
      console.warn(`❌ Error en ${url}:`, e.message);
    }
  }
  
  // ========== 2. Si no se encuentra la plantilla, generar PDF desde cero ==========
  if (!plantillaBytes) {
    console.warn('⚠️ No se encontró plantilla, generando PDF desde cero...');
    return generarPDFDesdeCero(datos);
  }
  
  try {
    // ========== 3. Cargar el PDF y fuentes ==========
    const pdfDoc = await PDFDocument.load(plantillaBytes);
    pdfDoc.registerFontkit(fontkit);
    
    let fontNormal, fontBold;
    try {
      const [regularBytes, boldBytes] = await Promise.all([
        fetch(`${BASE_URL}fuentes/Roboto-Regular.ttf`).then(r => r.arrayBuffer()),
        fetch(`${BASE_URL}fuentes/Roboto-Bold.ttf`).then(r => r.arrayBuffer())
      ]);
      fontNormal = await pdfDoc.embedFont(regularBytes);
      fontBold = await pdfDoc.embedFont(boldBytes);
    } catch (e) {
      console.warn('⚠️ No se pudieron cargar fuentes externas, usando fuentes estándar');
      fontNormal = await pdfDoc.embedFont('Helvetica');
      fontBold = await pdfDoc.embedFont('Helvetica-Bold');
    }
    
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();
    
    const colorAzul = rgb(0.106, 0.224, 0.416);
    const colorNegro = rgb(0.1, 0.1, 0.1);
    const colorRojo = rgb(0.8, 0, 0);
    const colorVerde = rgb(0, 0.5, 0);
    
    function drawText(texto, x, y, tam = 10, font = fontNormal, color = colorNegro) {
      if (!texto) return;
      try {
        page.drawText(String(texto), {
          x,
          y: height - y,
          size: tam,
          font,
          color
        });
      } catch (e) {
        console.warn('⚠️ Error al dibujar texto:', e.message);
      }
    }
    
    function limpiarNombre(texto) {
      if (!texto) return '';
      const match = texto.match(/^([^(]+)/);
      return match ? match[0].trim() : texto.trim();
    }
    
    // ========== 4. Dibujar datos sobre el PDF ==========
    console.log('✏️ Dibujando datos en el PDF...');
    
    // Nombre del instructor
    drawText(datos.instructor_nombre || 'No especificado', 220, 115, 10, fontBold, colorAzul);
    
    // Fecha de evaluación
    const fecha = datos.fecha_evaluacion ? new Date(datos.fecha_evaluacion) : new Date();
    const fechaStr = fecha.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    drawText(fechaStr, 200, 140, 10, fontNormal);
    
    // Nombre del curso
    drawText(datos.curso_nombre || 'No especificado', 220, 165, 10, fontNormal, colorAzul);
    
    // Empresa/Plantel
    drawText(datos.empresa_plantel || 'ITD', 220, 190, 10, fontNormal);
    
    // Criterios (puntuaciones)
    const yCriterios = 260;
    for (let i = 1; i <= 5; i++) {
      const valor = datos[`criterio_${i}`] || '-';
      drawText(String(valor), 460, yCriterios + (i - 1) * 28, 11, fontBold, colorAzul);
    }
    
    // Total
    const total = datos.puntuacion_total || 0;
    drawText(String(total), 510, 420, 14, fontBold, colorAzul);
    
    // Aceptado
    const aceptado = datos.aceptado ? 'SI' : 'NO';
    drawText(aceptado, 180, 460, 11, fontBold, datos.aceptado ? colorVerde : colorRojo);
    
    // Jefe de departamento
    const jefeLimpio = limpiarNombre(datos.jefe_departamento || 'No especificado');
    drawText(jefeLimpio, 140, 505, 10, fontNormal);
    
    // Cargo del evaluador
    drawText(datos.cargo_evaluador || 'No especificado', 140, 525, 9, fontNormal);
    
    // Fecha de generación
    const fechaGen = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    drawText('DA ' + fechaGen, 420, 680, 8, fontNormal);
    
    // ========== 5. Guardar PDF ==========
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    console.log('✅ PDF generado exitosamente');
    return url;
    
  } catch (error) {
    console.error('❌ Error al generar PDF:', error);
    // Si falla, generar PDF desde cero
    return generarPDFDesdeCero(datos);
  }
}

// ========== NUEVO: Generar PDF desde cero (sin plantilla) ==========
async function generarPDFDesdeCero(datos) {
  console.log('🔄 Generando PDF desde cero...');
  
  try {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    
    let fontNormal, fontBold;
    try {
      const [regularBytes, boldBytes] = await Promise.all([
        fetch(`${BASE_URL}fuentes/Roboto-Regular.ttf`).then(r => r.arrayBuffer()),
        fetch(`${BASE_URL}fuentes/Roboto-Bold.ttf`).then(r => r.arrayBuffer())
      ]);
      fontNormal = await pdfDoc.embedFont(regularBytes);
      fontBold = await pdfDoc.embedFont(boldBytes);
    } catch (e) {
      fontNormal = await pdfDoc.embedFont('Helvetica');
      fontBold = await pdfDoc.embedFont('Helvetica-Bold');
    }
    
    const page = pdfDoc.addPage([612, 792]);
    const { height } = page.getSize();
    const colorAzul = rgb(0.106, 0.224, 0.416);
    const colorNegro = rgb(0.1, 0.1, 0.1);
    const colorRojo = rgb(0.8, 0, 0);
    const colorVerde = rgb(0, 0.5, 0);
    
    function drawText(texto, x, y, tam = 10, font = fontNormal, color = colorNegro) {
      if (!texto) return;
      page.drawText(String(texto), { x, y: height - y, size: tam, font, color });
    }
    
    function limpiarNombre(texto) {
      if (!texto) return '';
      const match = texto.match(/^([^(]+)/);
      return match ? match[0].trim() : texto.trim();
    }
    
    // Título
    drawText('CRITERIOS PARA SELECCIONAR INSTRUCTOR(A)', 50, 50, 16, fontBold, colorAzul);
    
    // Datos del instructor
    let y = 100;
    drawText('Nombre del instructor (a):', 50, y, 10, fontBold);
    drawText(datos.instructor_nombre || 'No especificado', 250, y, 10, fontNormal, colorAzul);
    
    y += 25;
    const fecha = datos.fecha_evaluacion ? new Date(datos.fecha_evaluacion) : new Date();
    drawText('Fecha de evaluación:', 50, y, 10, fontBold);
    drawText(fecha.toLocaleDateString('es-MX'), 200, y, 10, fontNormal);
    
    y += 25;
    drawText('Nombre del curso a impartir:', 50, y, 10, fontBold);
    drawText(datos.curso_nombre || 'No especificado', 250, y, 10, fontNormal, colorAzul);
    
    y += 25;
    drawText('Nombre de la empresa o plantel:', 50, y, 10, fontBold);
    drawText(datos.empresa_plantel || 'ITD', 250, y, 10, fontNormal);
    
    // Tabla de criterios
    y += 40;
    drawText('EVALUACIÓN POR CRITERIOS', 50, y, 12, fontBold, colorAzul);
    y += 25;
    
    const headers = ['Criterio', '1', '2', '3', '4', '5', 'Total'];
    const colX = [50, 200, 250, 300, 350, 400, 470];
    headers.forEach((h, i) => {
      drawText(h, colX[i], y, 9, fontBold);
    });
    
    y += 20;
    const criterios = [
      { id: 1, label: 'Formación profesional relacionada a la capacitación' },
      { id: 2, label: 'Experiencia en capacitación y en la temática' },
      { id: 3, label: 'Materiales didácticos a utilizar' },
      { id: 4, label: 'Empresas diferentes como instructor(a)' },
      { id: 5, label: 'Certificaciones y acreditaciones' }
    ];
    
    criterios.forEach((c, idx) => {
      drawText(c.label, colX[0], y + (idx * 22), 8, fontNormal);
      for (let i = 1; i <= 5; i++) {
        const val = datos[`criterio_${i}`] || '-';
        drawText(String(val), colX[i] + 15, y + (idx * 22), 9, fontBold, colorAzul);
      }
      drawText('', colX[6] + 15, y + (idx * 22), 9, fontBold);
    });
    
    // Total
    y += criterios.length * 22 + 15;
    drawText('TOTAL GENERAL:', 50, y, 11, fontBold);
    drawText(String(datos.puntuacion_total || 0), 470, y, 14, fontBold, colorAzul);
    
    // Resultado
    y += 30;
    drawText('¿INSTRUCTOR ACEPTADO?', 50, y, 10, fontBold);
    const aceptado = datos.aceptado ? 'SI ✓' : 'NO ✗';
    drawText(aceptado, 250, y, 10, fontBold, datos.aceptado ? colorVerde : colorRojo);
    
    // Evaluador
    y += 35;
    drawText('Jefe(a) de Departamento que Evalúa:', 50, y, 10, fontBold);
    drawText(limpiarNombre(datos.jefe_departamento || 'No especificado'), 300, y, 10, fontNormal);
    
    y += 25;
    drawText('Cargo del Evaluador:', 50, y, 10, fontBold);
    drawText(datos.cargo_evaluador || 'No especificado', 250, y, 10, fontNormal);
    
    // Pie de página
    y += 40;
    drawText('Este documento se generó en PDF para su descarga.', 50, y, 9, fontNormal);
    y += 15;
    drawText('Recuerda imprimir y entregar firmado este documento en Coordinación de Actualización Docente.', 50, y, 8, fontNormal);
    
    const fechaGen = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    drawText('Generado: ' + fechaGen, 400, 750, 8, fontNormal);
    
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    console.log('✅ PDF generado desde cero exitosamente');
    return url;
    
  } catch (error) {
    console.error('❌ Error al generar PDF desde cero:', error);
    throw new Error('No se pudo generar el PDF. Intenta de nuevo.');
  }
}