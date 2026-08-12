// src/lib/criteriosInstructor.js
import html2pdf from 'html2pdf.js';

/**
 * Genera el PDF de evaluación de instructor usando HTML + html2pdf.js
 * Esta es la solución más confiable y sin problemas de codificación
 */
export async function generarPDFCriterios(datos) {
  console.log('📝 Generando PDF de evaluación con html2pdf...');
  
  try {
    // ===== 1. Crear el HTML del documento =====
    const fecha = datos.fecha_evaluacion ? new Date(datos.fecha_evaluacion) : new Date();
    const fechaStr = fecha.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const fechaGen = new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Función para limpiar nombre (quitar paréntesis)
    function limpiarNombre(texto) {
      if (!texto) return '';
      const match = texto.match(/^([^(]+)/);
      return match ? match[0].trim() : texto.trim();
    }
    
    // ===== 2. Construir el HTML =====
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, Helvetica, sans-serif;
            padding: 40px;
            background: white;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #9D2449;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #1B396A;
            font-size: 18px;
            letter-spacing: 1px;
          }
          .header h2 {
            color: #6b7280;
            font-size: 12px;
            font-weight: normal;
          }
          .header h3 {
            color: #1B396A;
            font-size: 16px;
            margin-top: 10px;
          }
          .section {
            margin-bottom: 20px;
          }
          .section-title {
            color: #1B396A;
            font-size: 14px;
            font-weight: bold;
            border-bottom: 2px solid #1B396A;
            padding-bottom: 5px;
            margin-bottom: 10px;
          }
          .field-row {
            display: flex;
            margin-bottom: 6px;
          }
          .field-label {
            font-weight: bold;
            width: 200px;
            font-size: 11px;
            color: #374151;
          }
          .field-value {
            font-size: 11px;
            color: #1B396A;
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin: 10px 0;
          }
          table th {
            background: #1B396A;
            color: white;
            padding: 6px 4px;
            text-align: center;
            font-size: 9px;
          }
          table td {
            padding: 5px 4px;
            border-bottom: 1px solid #e5e7eb;
          }
          table tr:nth-child(even) {
            background: #f9fafb;
          }
          .table-criterio {
            font-weight: 500;
          }
          .table-score {
            text-align: center;
            font-weight: bold;
            color: #1B396A;
          }
          .table-total {
            text-align: center;
            font-weight: bold;
            font-size: 14px;
            color: #9D2449;
          }
          .total-row {
            background: #f3f4f6 !important;
            font-weight: bold;
          }
          .total-row td {
            padding: 8px 4px;
          }
          .escala {
            background: #f9fafb;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 10px;
            margin: 10px 0;
          }
          .resultado {
            margin: 15px 0;
            padding: 10px;
            background: #f0fdf4;
            border-radius: 4px;
          }
          .resultado-no {
            background: #fef2f2;
          }
          .aceptado-si {
            color: #16a34a;
            font-weight: bold;
            font-size: 14px;
          }
          .aceptado-no {
            color: #dc2626;
            font-weight: bold;
            font-size: 14px;
          }
          .nota {
            background: #fffbeb;
            border-left: 4px solid #f59e0b;
            padding: 10px 12px;
            margin: 15px 0;
            font-size: 9px;
            color: #92400e;
          }
          .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 8px;
            color: #9ca3af;
          }
          .firma {
            margin-top: 30px;
            display: flex;
            justify-content: space-around;
          }
          .firma-item {
            text-align: center;
          }
          .firma-linea {
            width: 180px;
            border-top: 1px solid #374151;
            margin: 30px 0 5px 0;
          }
          .firma-nombre {
            font-weight: bold;
            font-size: 10px;
          }
          .firma-cargo {
            font-size: 9px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <!-- HEADER -->
        <div class="header">
          <h1>INSTITUTO TECNOLÓGICO DE DURANGO</h1>
          <h2>Coordinación de Actualización Docente</h2>
          <h3>CRITERIOS PARA SELECCIONAR INSTRUCTOR (A)</h3>
        </div>
        
        <!-- DATOS DEL INSTRUCTOR -->
        <div class="section">
          <div class="section-title">DATOS DEL INSTRUCTOR</div>
          <div class="field-row">
            <span class="field-label">Nombre del instructor (a):</span>
            <span class="field-value">${datos.instructor_nombre || 'No especificado'}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Fecha de evaluación:</span>
            <span class="field-value">${fechaStr}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Nombre del curso a impartir:</span>
            <span class="field-value">${datos.curso_nombre || 'No especificado'}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Nombre de la empresa o plantel:</span>
            <span class="field-value">${datos.empresa_plantel || 'ITD'}</span>
          </div>
        </div>
        
        <!-- TABLA DE CRITERIOS -->
        <div class="section">
          <div class="section-title">EVALUACIÓN POR CRITERIOS</div>
          
          <div class="escala">
            <strong>Escala:</strong> 1 = Malo &nbsp;|&nbsp; 2 = Regular &nbsp;|&nbsp; 3 = Bien &nbsp;|&nbsp; 4 = Muy bien &nbsp;|&nbsp; 5 = Excelente
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="text-align:left;width:50%;">CRITERIO</th>
                <th style="width:8%;">1</th>
                <th style="width:8%;">2</th>
                <th style="width:8%;">3</th>
                <th style="width:8%;">4</th>
                <th style="width:8%;">5</th>
                <th style="width:10%;">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="table-criterio">1. Formación profesional relacionada a la capacitación a impartir.</td>
                <td class="table-score">${datos.criterio_1 === 1 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_1 === 2 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_1 === 3 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_1 === 4 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_1 === 5 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_1 || '-'}</td>
              </tr>
              <tr>
                <td class="table-criterio">2. Experiencia en capacitación y en la temática a impartir.</td>
                <td class="table-score">${datos.criterio_2 === 1 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_2 === 2 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_2 === 3 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_2 === 4 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_2 === 5 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_2 || '-'}</td>
              </tr>
              <tr>
                <td class="table-criterio">3. Materiales didácticos a utilizar.</td>
                <td class="table-score">${datos.criterio_3 === 1 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_3 === 2 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_3 === 3 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_3 === 4 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_3 === 5 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_3 || '-'}</td>
              </tr>
              <tr>
                <td class="table-criterio">4. Empresas diferentes en las que ha participado como instructor(a).</td>
                <td class="table-score">${datos.criterio_4 === 1 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_4 === 2 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_4 === 3 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_4 === 4 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_4 === 5 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_4 || '-'}</td>
              </tr>
              <tr>
                <td class="table-criterio">5. Certificaciones y acreditaciones relacionadas al área de capacitación.</td>
                <td class="table-score">${datos.criterio_5 === 1 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_5 === 2 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_5 === 3 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_5 === 4 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_5 === 5 ? '✓' : ''}</td>
                <td class="table-score">${datos.criterio_5 || '-'}</td>
              </tr>
              <tr class="total-row">
                <td><strong>TOTAL GENERAL</strong></td>
                <td colspan="5"></td>
                <td class="table-total">${datos.puntuacion_total || 0}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- RESULTADO -->
        <div class="section">
          <div class="section-title">RESULTADO DE EVALUACIÓN</div>
          <div class="field-row">
            <span class="field-label">¿Instructor Aceptado?</span>
            <span class="${datos.aceptado ? 'aceptado-si' : 'aceptado-no'}">
              ${datos.aceptado ? 'SÍ ✓' : 'NO ✗'}
            </span>
          </div>
        </div>
        
        <!-- EVALUADOR -->
        <div class="section">
          <div class="section-title">DATOS DEL EVALUADOR</div>
          <div class="field-row">
            <span class="field-label">Jefe(a) de Departamento que Evalúa:</span>
            <span class="field-value">${limpiarNombre(datos.jefe_departamento || 'No especificado')}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Cargo del Evaluador:</span>
            <span class="field-value">${datos.cargo_evaluador || 'No especificado'}</span>
          </div>
        </div>
        
        <!-- NOTA -->
        <div class="nota">
          <strong>⚠️ IMPORTANTE:</strong> Este documento se generará en PDF para su descarga.<br>
          Recuerda imprimir y entregar firmado este documento en Coordinación de Actualización Docente para que tenga validez.
        </div>
        
        <!-- FIRMAS -->
        <div class="firma">
          <div class="firma-item">
            <div class="firma-linea"></div>
            <div class="firma-nombre">${limpiarNombre(datos.jefe_departamento || '_________________________')}</div>
            <div class="firma-cargo">${datos.cargo_evaluador || 'Evaluador'}</div>
          </div>
          <div class="firma-item">
            <div class="firma-linea"></div>
            <div class="firma-nombre">_________________________</div>
            <div class="firma-cargo">Vo. Bo. Subdirección Académica</div>
          </div>
        </div>
        
        <!-- FOOTER -->
        <div class="footer">
          DA ${fechaGen} &nbsp;·&nbsp; © 2026 Coordinación de Actualización Docente
        </div>
      </body>
      </html>
    `;
    
    // ===== 3. Crear un elemento contenedor =====
    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    document.body.appendChild(container);
    
    // ===== 4. Generar PDF con html2pdf =====
    const opt = {
      margin: 10,
      filename: `Evaluacion_Instructor_${datos.instructor_nombre?.replace(/\s+/g, '_') || 'sin_nombre'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        letterRendering: true
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'letter', 
        orientation: 'portrait' 
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    
    // Generar y descargar
    await html2pdf().set(opt).from(container).save();
    
    // Limpiar
    document.body.removeChild(container);
    
    console.log('✅ PDF generado exitosamente con html2pdf');
    return true;
    
  } catch (error) {
    console.error('❌ Error al generar PDF:', error);
    throw new Error('No se pudo generar el PDF: ' + error.message);
  }
}