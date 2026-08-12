// src/lib/criteriosInstructor.js
import html2pdf from 'html2pdf.js';

// ===== LOGOS =====
const LOGO_TECNM = 'https://raw.githubusercontent.com/DA-itd/E/main/LOGO_tecnm.jpg';
const LOGO_ITD = 'https://raw.githubusercontent.com/DA-itd/E/main/logo%20itd%20original.jpg';

/**
 * Genera el PDF de evaluación de instructor con formato profesional y logos
 */
export async function generarPDFCriterios(datos) {
  console.log('📝 Generando PDF de evaluación con formato profesional...');
  
  try {
    // ===== 1. Preparar datos =====
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
    
    function limpiarNombre(texto) {
      if (!texto) return '';
      const match = texto.match(/^([^(]+)/);
      return match ? match[0].trim() : texto.trim();
    }

    // ===== 2. Construir el HTML con formato profesional =====
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Times New Roman', Times, serif;
            padding: 40px 45px;
            background: white;
            color: #1a1a1a;
          }
          
          /* ===== HEADER CON LOGOS ===== */
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 3px solid #9D2449;
            padding-bottom: 12px;
            margin-bottom: 15px;
          }
          .header-logo {
            height: 60px;
            width: auto;
            object-fit: contain;
          }
          .header-center {
            text-align: center;
            flex: 1;
            padding: 0 10px;
          }
          .header-center h1 {
            color: #1B396A;
            font-size: 16px;
            font-weight: bold;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .header-center h2 {
            color: #4b5563;
            font-size: 11px;
            font-weight: normal;
            margin-top: 2px;
          }
          .header-center h3 {
            color: #1B396A;
            font-size: 13px;
            font-weight: bold;
            margin-top: 4px;
            text-transform: uppercase;
          }
          
          /* ===== TÍTULO DEL DOCUMENTO ===== */
          .doc-title {
            text-align: center;
            font-size: 15px;
            font-weight: bold;
            color: #1B396A;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 10px 0 15px 0;
            padding: 6px;
            border-top: 2px solid #1B396A;
            border-bottom: 2px solid #1B396A;
          }
          
          /* ===== SECCIONES ===== */
          .section {
            margin-bottom: 14px;
          }
          .section-title {
            color: #1B396A;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1.5px solid #1B396A;
            padding-bottom: 3px;
            margin-bottom: 8px;
          }
          
          /* ===== CAMPOS ===== */
          .field-row {
            display: flex;
            margin-bottom: 3px;
            font-size: 11px;
          }
          .field-label {
            font-weight: bold;
            width: 200px;
            color: #374151;
          }
          .field-value {
            color: #1B396A;
            font-weight: bold;
            text-transform: uppercase;
          }
          
          /* ===== TABLA DE CRITERIOS ===== */
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin: 6px 0;
          }
          table th {
            background: #1B396A;
            color: white;
            padding: 5px 3px;
            text-align: center;
            font-size: 9px;
            font-weight: bold;
            text-transform: uppercase;
          }
          table th:first-child {
            text-align: left;
            padding-left: 8px;
          }
          table td {
            padding: 4px 3px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: middle;
          }
          table tr:nth-child(even) {
            background: #f8fafc;
          }
          .table-criterio {
            font-size: 9px;
            padding-left: 8px;
          }
          .table-score {
            text-align: center;
            font-weight: bold;
            color: #1B396A;
            font-size: 11px;
          }
          .table-total {
            text-align: center;
            font-weight: bold;
            font-size: 13px;
            color: #9D2449;
          }
          .total-row {
            background: #f1f5f9 !important;
          }
          .total-row td {
            padding: 6px 3px;
            border-top: 2px solid #1B396A;
          }
          
          /* ===== ESCALA ===== */
          .escala {
            background: #f8fafc;
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 9px;
            margin: 4px 0 8px 0;
            border: 1px solid #e5e7eb;
          }
          .escala strong {
            color: #1B396A;
          }
          .escala-item {
            margin: 0 6px;
          }
          
          /* ===== RESULTADO ===== */
          .resultado-box {
            padding: 8px 12px;
            border-radius: 4px;
            margin: 6px 0;
            border: 1px solid #d1d5db;
          }
          .resultado-si {
            background: #f0fdf4;
            border-color: #86efac;
          }
          .resultado-no {
            background: #fef2f2;
            border-color: #fca5a5;
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
          
          /* ===== NOTA ===== */
          .nota {
            background: #fffbeb;
            border-left: 4px solid #f59e0b;
            padding: 8px 12px;
            margin: 10px 0;
            font-size: 9px;
            color: #92400e;
          }
          .nota strong {
            color: #78350f;
          }
          
          /* ===== FIRMAS ===== */
          .firma-container {
            display: flex;
            justify-content: space-around;
            margin-top: 25px;
            padding-top: 10px;
          }
          .firma-item {
            text-align: center;
            width: 200px;
          }
          .firma-linea {
            width: 100%;
            border-top: 1.5px solid #374151;
            margin: 25px 0 4px 0;
          }
          .firma-nombre {
            font-weight: bold;
            font-size: 10px;
            color: #1B396A;
            text-transform: uppercase;
          }
          .firma-cargo {
            font-size: 9px;
            color: #6b7280;
          }
          
          /* ===== FOOTER ===== */
          .footer {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 8px;
            color: #9ca3af;
          }
          
          /* ===== CHECK EN TABLA ===== */
          .check {
            color: #16a34a;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        
        <!-- ===== HEADER CON LOGOS ===== -->
        <div class="header">
          <img src="${LOGO_TECNM}" alt="TecNM" class="header-logo">
          <div class="header-center">
            <h1>Instituto Tecnológico de Durango</h1>
            <h2>Coordinación de Actualización Docente</h2>
            <h3>Criterios para Seleccionar Instructor (a)</h3>
          </div>
          <img src="${LOGO_ITD}" alt="ITD" class="header-logo">
        </div>
        
        <!-- ===== DATOS DEL INSTRUCTOR ===== -->
        <div class="section">
          <div class="section-title">Datos del Instructor</div>
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
        
        <!-- ===== EVALUACIÓN POR CRITERIOS ===== -->
        <div class="section">
          <div class="section-title">Evaluación por Criterios</div>
          
          <div class="escala">
            <strong>Escala:</strong>
            <span class="escala-item">1 = Malo</span> |
            <span class="escala-item">2 = Regular</span> |
            <span class="escala-item">3 = Bien</span> |
            <span class="escala-item">4 = Muy bien</span> |
            <span class="escala-item">5 = Excelente</span>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width:50%;text-align:left;">Criterio</th>
                <th style="width:8%;">1</th>
                <th style="width:8%;">2</th>
                <th style="width:8%;">3</th>
                <th style="width:8%;">4</th>
                <th style="width:8%;">5</th>
                <th style="width:10%;">Total</th>
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
        
        <!-- ===== RESULTADO ===== -->
        <div class="section">
          <div class="section-title">Resultado de Evaluación</div>
          <div class="resultado-box ${datos.aceptado ? 'resultado-si' : 'resultado-no'}">
            <div class="field-row">
              <span class="field-label">¿Instructor Aceptado?</span>
              <span class="${datos.aceptado ? 'aceptado-si' : 'aceptado-no'}">
                ${datos.aceptado ? '✓ SÍ' : '✗ NO'}
              </span>
            </div>
          </div>
        </div>
        
        <!-- ===== EVALUADOR ===== -->
        <div class="section">
          <div class="section-title">Datos del Evaluador</div>
          <div class="field-row">
            <span class="field-label">Jefe(a) de Departamento que Evalúa:</span>
            <span class="field-value">${limpiarNombre(datos.jefe_departamento || 'No especificado')}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Cargo del Evaluador:</span>
            <span class="field-value">${datos.cargo_evaluador || 'No especificado'}</span>
          </div>
        </div>
        
        <!-- ===== NOTA ===== -->
        <div class="nota">
          <strong>⚠️ IMPORTANTE:</strong> Este documento se generará en PDF para su descarga.<br>
          Recuerda imprimir y entregar firmado este documento en Coordinación de Actualización Docente para que tenga validez.
        </div>
        
        <!-- ===== FIRMAS ===== -->
        <div class="firma-container">
          <div class="firma-item">
            <div class="firma-linea"></div>
            <div class="firma-nombre">${limpiarNombre(datos.jefe_departamento || '_________________________')}</div>
            <div class="firma-cargo">${datos.cargo_evaluador || 'Evaluador'}</div>
          </div>
          <div class="firma-item">
            <div class="firma-linea"></div>
            <div class="firma-nombre">Adriana Eréndira Murillo</div>
            <div class="firma-cargo">Subdirección Académica</div>
          </div>
        </div>
        
        <!-- ===== FOOTER ===== -->
        <div class="footer">
          DA ${fechaGen} &nbsp;·&nbsp; © 2026 Coordinación de Actualización Docente
        </div>
        
      </body>
      </html>
    `;
    
    // ===== 3. Crear elemento contenedor =====
    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    document.body.appendChild(container);
    
    // ===== 4. Configurar opciones de html2pdf =====
    const nombreLimpio = datos.instructor_nombre?.replace(/\s+/g, '_') || 'sin_nombre';
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `Evaluacion_Instructor_${nombreLimpio}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: false
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'letter', 
        orientation: 'portrait' 
      }
    };
    
    // ===== 5. Generar y descargar =====
    await html2pdf().set(opt).from(container).save();
    
    // ===== 6. Limpiar =====
    document.body.removeChild(container);
    
    console.log('✅ PDF generado exitosamente con formato profesional');
    return true;
    
  } catch (error) {
    console.error('❌ Error al generar PDF:', error);
    throw new Error('No se pudo generar el PDF: ' + error.message);
  }
}