// src/lib/criteriosInstructor.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { dibujarEncabezadoPDF } from './pdfEncabezado';

// Generación oficial y descarga en PDF de Criterios para seleccionar instructor (ITD-AD-FO-06)
export async function descargarCriteriosInstructor(evaluacion) {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

    const startY = await dibujarEncabezadoPDF(
      doc,
      'CRITERIOS PARA SELECCIONAR INSTRUCTOR (A)',
      [
        'Formato: ITD-AD-FO-06 · Coordinación de Actualización Docente',
        'Departamento de Desarrollo Académico',
      ]
    );

    const left = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const right = pageWidth - 14;

    // Metadatos
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(27, 57, 106);
    doc.text('DATOS DE LA EVALUACIÓN', left, startY + 2);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);

    const metaY = startY + 7;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(left, metaY, right - left, 20, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.text('Instructor:', left + 4, metaY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(String(evaluacion.instructor_nombre || '---').toUpperCase(), left + 24, metaY + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Fecha:', left + 120, metaY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(String(evaluacion.fecha_evaluacion || new Date().toLocaleDateString('es-MX')), left + 135, metaY + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Curso:', left + 4, metaY + 14);
    doc.setFont('helvetica', 'normal');
    const cursoTexto = doc.splitTextToSize(String(evaluacion.curso_nombre || '---').toUpperCase(), 150);
    doc.text(cursoTexto, left + 20, metaY + 14);

    const criterios = [
      { num: '1', label: 'Formación profesional relacionada a la capacitación a impartir.', val: evaluacion.criterio_1 },
      { num: '2', label: 'Experiencia en capacitación y en la temática a impartir.', val: evaluacion.criterio_2 },
      { num: '3', label: 'Materiales didácticos a utilizar.', val: evaluacion.criterio_3 },
      { num: '4', label: 'Empresas diferentes en las que ha participado como instructor(a).', val: evaluacion.criterio_4 },
      { num: '5', label: 'Certificaciones y acreditaciones relacionadas al área de capacitación.', val: evaluacion.criterio_5 },
    ];

    const bodyTable = criterios.map(c => [
      c.num,
      c.label,
      '1 - 5',
      c.val !== undefined && c.val !== null ? String(c.val) : '-'
    ]);

    const totalPuntos = evaluacion.puntuacion_total ?? (
      Number(evaluacion.criterio_1 || 0) +
      Number(evaluacion.criterio_2 || 0) +
      Number(evaluacion.criterio_3 || 0) +
      Number(evaluacion.criterio_4 || 0) +
      Number(evaluacion.criterio_5 || 0)
    );

    bodyTable.push([
      '',
      { content: 'TOTAL DE PUNTOS EVALUADOS (MÁXIMO 25 PTS):', styles: { fontStyle: 'bold', halign: 'right' } },
      '',
      { content: String(totalPuntos), styles: { fontStyle: 'bold', halign: 'center', textColor: [27, 57, 106], fontSize: 10 } }
    ]);

    autoTable(doc, {
      startY: metaY + 24,
      head: [['No.', 'Criterio de Selección', 'Escala', 'Puntaje']],
      body: bodyTable,
      theme: 'grid',
      headStyles: { fillColor: [27, 57, 106], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      styles: { fontSize: 8.5, cellPadding: 3, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 125 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
      },
    });

    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : 170;

    // Dictamen
    const dictamenAceptado = evaluacion.aceptado ?? (totalPuntos >= 15);
    doc.setFillColor(dictamenAceptado ? 240 : 254, dictamenAceptado ? 253 : 242, dictamenAceptado ? 244 : 242);
    doc.setDrawColor(dictamenAceptado ? 134 : 252, dictamenAceptado ? 239 : 165, dictamenAceptado ? 172 : 165);
    doc.roundedRect(left, finalY, right - left, 12, 2, 2, 'FD');

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(dictamenAceptado ? 22 : 185, dictamenAceptado ? 101 : 28, dictamenAceptado ? 52 : 28);
    doc.text(
      `DICTAMEN OFICIAL: ${dictamenAceptado ? '✓ INSTRUCTOR ACEPTADO PARA EL PROGRAMA' : '✗ INSTRUCTOR NO ACEPTADO'} (${totalPuntos}/25 PTS)`,
      left + 5,
      finalY + 7.5
    );

    // Firmas
    const firmasY = finalY + 36;
    const anchoFirma = 75;

    // Evaluador
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.4);
    doc.line(left + 5, firmasY, left + 5 + anchoFirma, firmasY);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(String(evaluacion.jefe_departamento || 'EVALUADOR').toUpperCase(), left + 5 + anchoFirma / 2, firmasY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(String(evaluacion.cargo_evaluador || 'Jefe(a) de Departamento'), left + 5 + anchoFirma / 2, firmasY + 8, { align: 'center' });

    // Coordinación
    const coordX = right - anchoFirma - 5;
    doc.line(coordX, firmasY, coordX + anchoFirma, firmasY);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('ALEJANDRO CALDERÓN RENTERÍA', coordX + anchoFirma / 2, firmasY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Coordinador de Actualización Docente · Vo. Bo.', coordX + anchoFirma / 2, firmasY + 8, { align: 'center' });

    // Pie
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('ITD-AD-FO-06 · Sistema Institucional de Capacitación Docente', left, doc.internal.pageSize.getHeight() - 8);

    const nombreLimpio = String(evaluacion.instructor_nombre || 'Instructor').replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`Criterios_Instructor_${nombreLimpio}.pdf`);
  } catch (err) {
    console.error('Error generando PDF de criterios:', err);
    alert('No se pudo generar el documento PDF de criterios: ' + (err.message || err));
  }
}