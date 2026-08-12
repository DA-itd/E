// src/lib/criteriosInstructor.js
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Genera el PDF de evaluación de instructor completamente desde código
 * SIN depender de plantillas externas
 */
export async function generarPDFCriterios(datos) {
  console.log('📝 Generando PDF de evaluación...');
  
  try {
    // Crear nuevo documento PDF
    const pdfDoc = await PDFDocument.create();
    
    // Usar fuentes estándar (no necesita archivos externos)
    const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    
    // Agregar página (tamaño carta: 612 x 792)
    const page = pdfDoc.addPage([612, 792]);
    const { height } = page.getSize();
    
    // Colores
    const azul = rgb(0.106, 0.224, 0.416);  // #1B396A
    const guinda = rgb(0.616, 0.141, 0.286); // #9D2449
    const negro = rgb(0.1, 0.1, 0.1);
    const gris = rgb(0.4, 0.4, 0.4);
    const verde = rgb(0, 0.5, 0);
    const rojo = rgb(0.8, 0, 0);
    
    // Función auxiliar para dibujar texto
    function text(texto, x, y, tam = 10, font = fontNormal, color = negro, align = 'left') {
      if (!texto) return;
      let posX = x;
      if (align === 'center') {
        const ancho = font.widthOfTextAtSize(texto, tam);
        posX = (612 - ancho) / 2;
      } else if (align === 'right') {
        const ancho = font.widthOfTextAtSize(texto, tam);
        posX = 612 - x - ancho;
      }
      page.drawText(String(texto), {
        x: posX,
        y: height - y,
        size: tam,
        font,
        color
      });
    }
    
    // Función para limpiar nombre (quitar paréntesis)
    function limpiarNombre(texto) {
      if (!texto) return '';
      const match = texto.match(/^([^(]+)/);
      return match ? match[0].trim() : texto.trim();
    }
    
    // ===== HEADER =====
    // Línea decorativa superior
    page.drawRectangle({
      x: 40,
      y: height - 35,
      width: 532,
      height: 4,
      color: guinda
    });
    
    // Título principal
    text('INSTITUTO TECNOLÓGICO DE DURANGO', 612/2, 55, 14, fontBold, azul, 'center');
    text('Coordinación de Actualización Docente', 612/2, 72, 10, fontNormal, gris, 'center');
    
    // Título del documento
    text('CRITERIOS PARA SELECCIONAR INSTRUCTOR (A)', 612/2, 100, 16, fontBold, azul, 'center');
    
    // Línea decorativa
    page.drawRectangle({
      x: 80,
      y: height - 115,
      width: 452,
      height: 2,
      color: azul
    });
    
    // ===== DATOS DEL INSTRUCTOR =====
    let yPos = 140;
    
    // Nombre
    text('Nombre del instructor (a):', 50, yPos, 10, fontBold);
    text(datos.instructor_nombre || 'No especificado', 220, yPos, 10, fontBold, azul);
    
    yPos += 25;
    
    // Fecha
    const fecha = datos.fecha_evaluacion ? new Date(datos.fecha_evaluacion) : new Date();
    text('Fecha de evaluación:', 50, yPos, 10, fontBold);
    text(fecha.toLocaleDateString('es-MX'), 200, yPos, 10, fontNormal);
    
    yPos += 25;
    
    // Curso
    text('Nombre del curso a impartir:', 50, yPos, 10, fontBold);
    text(datos.curso_nombre || 'No especificado', 220, yPos, 10, fontNormal, azul);
    
    yPos += 25;
    
    // Empresa
    text('Nombre de la empresa o plantel:', 50, yPos, 10, fontBold);
    text(datos.empresa_plantel || 'ITD', 220, yPos, 10, fontNormal);
    
    yPos += 35;
    
    // ===== TABLA DE CRITERIOS =====
    // Encabezados
    const colX = [50, 120, 180, 240, 300, 360, 440];
    const headers = ['CRITERIO', '1', '2', '3', '4', '5', 'TOTAL'];
    
    // Fondo del encabezado
    page.drawRectangle({
      x: colX[0] - 5,
      y: height - yPos - 5,
      width: 510,
      height: 30,
      color: azul
    });
    
    headers.forEach((h, i) => {
      const x = i === 0 ? colX[i] : colX[i] + 10;
      text(h, x, yPos + 5, 9, fontBold, rgb(1, 1, 1), 'center');
    });
    
    yPos += 30;
    
    // Filas de criterios
    const criterios = [
      { id: 1, label: '1. Formación profesional relacionada a la capacitación a impartir.' },
      { id: 2, label: '2. Experiencia en capacitación y en la temática a impartir.' },
      { id: 3, label: '3. Materiales didácticos a utilizar.' },
      { id: 4, label: '4. Empresas diferentes en las que ha participado como instructor(a).' },
      { id: 5, label: '5. Certificaciones y acreditaciones relacionadas al área de capacitación.' }
    ];
    
    criterios.forEach((c, idx) => {
      const yFila = yPos + (idx * 25);
      const alternar = idx % 2 === 0;
      
      // Fondo alternado
      if (alternar) {
        page.drawRectangle({
          x: colX[0] - 5,
          y: height - yFila - 5,
          width: 510,
          height: 25,
          color: rgb(0.95, 0.95, 0.95)
        });
      }
      
      // Texto del criterio
      text(c.label, colX[0], yFila + 3, 8, fontNormal);
      
      // Puntuaciones
      for (let i = 1; i <= 5; i++) {
        const val = datos[`criterio_${i}`] || '-';
        const x = colX[i] + 15;
        text(String(val), x, yFila + 3, 10, fontBold, azul, 'center');
      }
      
      // Total por criterio
      const total = datos[`criterio_${c.id}`] || '-';
      text(String(total), colX[6] + 15, yFila + 3, 10, fontBold, azul, 'center');
    });
    
    yPos += criterios.length * 25 + 15;
    
    // TOTAL GENERAL
    page.drawRectangle({
      x: colX[0] - 5,
      y: height - yPos - 5,
      width: 510,
      height: 30,
      color: rgb(0.95, 0.95, 0.95)
    });
    
    text('TOTAL GENERAL', colX[0], yPos + 5, 12, fontBold, azul);
    text(String(datos.puntuacion_total || 0), colX[6] + 15, yPos + 5, 16, fontBold, guinda, 'center');
    
    yPos += 40;
    
    // ===== ESCALA =====
    text('Nota: Evaluar considerando la siguiente escala', 50, yPos, 9, fontOblique, gris);
    yPos += 18;
    text('1 = Malo    2 = Regular    3 = Bien    4 = Muy bien    5 = Excelente', 50, yPos, 9, fontNormal);
    
    yPos += 35;
    
    // ===== RESULTADO =====
    text('RESULTADO DE EVALUACIÓN', 50, yPos, 12, fontBold, azul);
    yPos += 25;
    
    text('¿Instructor Aceptado?', 50, yPos, 10, fontBold);
    const aceptado = datos.aceptado ? 'SÍ' : 'NO';
    const colorAceptado = datos.aceptado ? verde : rojo;
    text('✓ ' + aceptado, 220, yPos, 12, fontBold, colorAceptado);
    
    yPos += 35;
    
    // ===== EVALUADOR =====
    text('DATOS DEL EVALUADOR', 50, yPos, 12, fontBold, azul);
    yPos += 25;
    
    text('Jefe(a) de Departamento que Evalúa:', 50, yPos, 10, fontBold);
    text(limpiarNombre(datos.jefe_departamento || 'No especificado'), 280, yPos, 10, fontNormal, azul);
    
    yPos += 25;
    
    text('Cargo del Evaluador:', 50, yPos, 10, fontBold);
    text(datos.cargo_evaluador || 'No especificado', 200, yPos, 10, fontNormal);
    
    yPos += 40;
    
    // ===== NOTA IMPORTANTE =====
    text('⚠️ Este documento se generará en PDF para su descarga.', 50, yPos, 9, fontOblique, guinda);
    yPos += 18;
    text('Recuerda imprimir y entregar firmado este documento en Coordinación de Actualización Docente', 50, yPos, 8, fontOblique, gris);
    
    // ===== FOOTER =====
    const fechaGen = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    text('DA ' + fechaGen, 550, 780, 7, fontNormal, gris, 'right');
    
    text('© 2026 Coordinación de Actualización Docente', 612/2, 780, 7, fontNormal, gris, 'center');
    
    // ===== GUARDAR PDF =====
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    console.log('✅ PDF generado exitosamente desde código');
    return url;
    
  } catch (error) {
    console.error('❌ Error al generar PDF:', error);
    throw new Error('No se pudo generar el PDF: ' + error.message);
  }
}