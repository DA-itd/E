import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Curso, Participante, FormatoConfig } from '../types';

async function obtenerLogoBase64() {
  const rutas = [
    'https://raw.githubusercontent.com/DA-itd/E/main/logo%20itd%20original.jpg',
    '/logos/logo-itd original.jpg',
    '/logos/logo-itd.jpg',
    '/logos/logo-itd.png',
    '/logo-itd original.jpg',
    '/logo-itd.jpg',
    '/logo-itd.png',
  ];
  for (const ruta of rutas) {
    try {
      const resp = await fetch(ruta, { mode: 'cors' });
      if (resp.ok) {
        const blob = await resp.blob();
        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    } catch {
      // continuar
    }
  }
  return null;
}

export async function exportarListaAsistenciaPDF(
  curso: Curso,
  participantes: Participante[],
  config: FormatoConfig,
  instructorCurp?: string,
  instructorRfc?: string,
  coordinadorNombre?: string
) {
  // Landscape or Portrait: The official ITD-AD-FO-8 document is standard Letter size in Landscape or Portrait.
  // In the attached image, it has 12 columns (No., Nombre, RFC, Puesto/Depto, Nivel, FD, D, L, M, M, J, V).
  // Portrait Letter (215.9mm x 279.4mm) with tight font or Landscape.
  // The official ITD-AD-FO-8 form is Portrait Letter.
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;

  // 1. Draw institutional header box
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.3);

  // Outer Header Table
  const headerTop = 10;
  const headerHeight = 26;
  const headerWidth = pageWidth - (marginX * 2);

  // Logo box (left): 24mm
  const logoBoxWidth = 24;
  // Code info box (right): 48mm
  const codeBoxWidth = 48;
  const centerBoxWidth = headerWidth - logoBoxWidth - codeBoxWidth;

  // Header outer rectangle
  doc.rect(marginX, headerTop, headerWidth, headerHeight);

  // Vertical dividers
  doc.line(marginX + logoBoxWidth, headerTop, marginX + logoBoxWidth, headerTop + headerHeight);
  doc.line(marginX + logoBoxWidth + centerBoxWidth, headerTop, marginX + logoBoxWidth + centerBoxWidth, headerTop + headerHeight);

  // Left: Logo badge representation
  const logoBase64 = await obtenerLogoBase64();
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'JPEG', marginX + 2, headerTop + 2, 20, 20);
      doc.setTextColor(27, 57, 106);
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'bold');
      doc.text('TecNM', marginX + (logoBoxWidth / 2), headerTop + 23.5, { align: 'center' });
    } catch {
      doc.setFillColor(27, 57, 106);
      doc.circle(marginX + (logoBoxWidth / 2), headerTop + 10, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('ITD', marginX + (logoBoxWidth / 2), headerTop + 11.5, { align: 'center' });
      doc.setTextColor(27, 57, 106);
      doc.setFontSize(5.5);
      doc.text('TecNM', marginX + (logoBoxWidth / 2), headerTop + 20, { align: 'center' });
    }
  } else {
    doc.setFillColor(27, 57, 106);
    doc.circle(marginX + (logoBoxWidth / 2), headerTop + 10, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('ITD', marginX + (logoBoxWidth / 2), headerTop + 11.5, { align: 'center' });
    doc.setTextColor(27, 57, 106);
    doc.setFontSize(5.5);
    doc.text('TecNM', marginX + (logoBoxWidth / 2), headerTop + 20, { align: 'center' });
  }

  // Center Box: Institutional Titles
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(config.institucion, marginX + logoBoxWidth + (centerBoxWidth / 2), headerTop + 7, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(config.nombreDocumento, marginX + logoBoxWidth + (centerBoxWidth / 2), headerTop + 14, { align: 'center' });

  doc.setFontSize(6.5);
  doc.setTextColor(80, 80, 80);
  doc.text(config.referenciaNorma, marginX + logoBoxWidth + (centerBoxWidth / 2), headerTop + 20, { align: 'center' });

  // Right Box: ISO metadata table
  const rightBoxX = marginX + logoBoxWidth + centerBoxWidth;
  const rightRowHeight = headerHeight / 4;

  for (let i = 1; i < 4; i++) {
    doc.line(rightBoxX, headerTop + (i * rightRowHeight), marginX + headerWidth, headerTop + (i * rightRowHeight));
  }

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Código: ${config.codigo}`, rightBoxX + 2, headerTop + 4.5);
  doc.text(`Revisión: ${config.revision}`, rightBoxX + 2, headerTop + 4.5 + rightRowHeight);
  doc.text(`Página 1 de 1`, rightBoxX + 2, headerTop + 4.5 + (rightRowHeight * 2));
  doc.text(`Fecha de emisión: ${config.fechaEmision}`, rightBoxX + 2, headerTop + 4.5 + (rightRowHeight * 3));

  // 2. Course Information Box
  let curY = headerTop + headerHeight + 4;

  // Box 1: Modalidad (Sin CLAVE, ancho completo)
  doc.rect(marginX, curY, headerWidth, 6.5);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(curso.modalidad || 'CURSO PRESENCIAL', marginX + (headerWidth / 2), curY + 4.5, { align: 'center' });

  curY += 6.5;

  // Box 2: Hoja y Folio
  doc.rect(marginX, curY, headerWidth, 5.5);
  doc.line(marginX + headerWidth - 65, curY, marginX + headerWidth - 65, curY + 5.5);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Hoja:', marginX + 4, curY + 3.8);
  doc.setFont('helvetica', 'normal');
  doc.text('1', marginX + 16, curY + 3.8);
  doc.text('de', marginX + 25, curY + 3.8);
  doc.text('1', marginX + 32, curY + 3.8);

  doc.setFont('helvetica', 'bold');
  doc.text('Folio:', marginX + headerWidth - 62, curY + 3.8);
  doc.setFont('helvetica', 'normal');
  doc.text(curso.folio || 'N/A', marginX + headerWidth - 46, curY + 3.8);

  curY += 5.5;

  // Box 3: Nombre del Curso
  doc.rect(marginX, curY, headerWidth, 6.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Nombre del curso:', marginX + 3, curY + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.text(curso.nombre || 'Sin nombre', marginX + 32, curY + 4.5);

  curY += 6.5;

  // Box 4: Nombre del Instructor
  doc.rect(marginX, curY, headerWidth, 6);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Nombre del instructor (a):', marginX + 3, curY + 4.2);
  doc.setFont('helvetica', 'normal');
  doc.text(curso.instructor || 'No asignado', marginX + 42, curY + 4.2);

  curY += 6;

  // Box 5: Periodo con fecha real, Duración, Horario
  doc.rect(marginX, curY, headerWidth, 6);
  doc.line(marginX + 95, curY, marginX + 95, curY + 6);
  doc.line(marginX + 140, curY, marginX + 140, curY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Periodo:', marginX + 3, curY + 4.2);
  doc.setFont('helvetica', 'normal');
  doc.text(curso.periodo || curso.semana || 'Del 12 al 16 de enero de 2026', marginX + 17, curY + 4.2);

  doc.setFont('helvetica', 'bold');
  doc.text('Duración:', marginX + 98, curY + 4.2);
  doc.setFont('helvetica', 'normal');
  doc.text(curso.duracion || (curso.horas ? `${curso.horas} hrs` : '30 hrs'), marginX + 114, curY + 4.2);

  doc.setFont('helvetica', 'bold');
  doc.text('Horario:', marginX + 143, curY + 4.2);
  doc.setFont('helvetica', 'normal');
  doc.text(curso.horario || 'N/A', marginX + 156, curY + 4.2);

  curY += 7.5;

  // 3. Attendance Table with autoTable
  // We prepare minimum 15 rows (padded if fewer) to guarantee exact match with official preprinted sheet
  const displayRowsCount = Math.max(participantes.length, 15);
  const tableRows: any[][] = [];

  for (let i = 0; i < displayRowsCount; i++) {
    const p = participantes[i];
    if (p) {
      const isFD = p.es_fd || p.nivel?.toLowerCase().includes('funcionario') || p.puesto?.toLowerCase().includes('jef') || p.puesto?.toLowerCase().includes('coord');
      const isD = p.es_d || (!isFD && (p.nivel?.toLowerCase().includes('docente') || true));

      tableRows.push([
        i + 1,
        p.nombre_completo || '',
        p.rfc || p.curp || '',
        `${p.puesto ? p.puesto + ' - ' : ''}${p.departamento || ''}`,
        p.nivel || (isFD ? 'Funcionario' : 'Docente'),
        isFD ? 'X' : '',
        !isFD && isD ? 'X' : '',
        p.asistencias?.L ? '•' : '',
        p.asistencias?.M ? '•' : '',
        p.asistencias?.M2 ? '•' : '',
        p.asistencias?.J ? '•' : '',
        p.asistencias?.V ? '•' : ''
      ]);
    } else {
      // Empty row for official template spacing
      tableRows.push([i + 1, '', '', '', '', '', '', '', '', '', '', '']);
    }
  }

  // Complex header structure:
  // Row 1: No. | Nombre del Participante | R.F.C. | Puesto y departamento de adscripción | Nivel de Puesto | Asistencia (colspan 7)
  // Row 2: (span) | (span) | (span) | (span) | (span) | FD | D | L | M | M | J | V
  const tableHead = [
    [
      { content: 'No.', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'Nombre del Participante', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'R.F.C.', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'Puesto y departamento de adscripción', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'Nivel de\nPuesto', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'Asistencia', colSpan: 7, styles: { halign: 'center' as const } }
    ],
    [
      { content: 'FD', styles: { halign: 'center' as const } },
      { content: 'D', styles: { halign: 'center' as const } },
      { content: 'L', styles: { halign: 'center' as const } },
      { content: 'M', styles: { halign: 'center' as const } },
      { content: 'M', styles: { halign: 'center' as const } },
      { content: 'J', styles: { halign: 'center' as const } },
      { content: 'V', styles: { halign: 'center' as const } }
    ]
  ];

  autoTable(doc, {
    head: tableHead,
    body: tableRows,
    startY: curY,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: {
      fontSize: 6.2,
      cellPadding: 1.1,
      textColor: [20, 20, 20],
      lineColor: [40, 40, 40],
      lineWidth: 0.2
    },
    headStyles: {
      fillColor: [240, 243, 248],
      textColor: [27, 57, 106],
      fontSize: 6.5,
      fontStyle: 'bold',
      lineColor: [40, 40, 40],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },       // No.
      1: { cellWidth: 48, fontStyle: 'bold' },     // Nombre
      2: { cellWidth: 26 },                       // RFC
      3: { cellWidth: 46 },                       // Puesto/Depto
      4: { cellWidth: 17, halign: 'center' },      // Nivel
      5: { cellWidth: 6.5, halign: 'center' },     // FD
      6: { cellWidth: 6.5, halign: 'center' },     // D
      7: { cellWidth: 6.5, halign: 'center' },     // L
      8: { cellWidth: 6.5, halign: 'center' },     // M
      9: { cellWidth: 6.5, halign: 'center' },     // M
      10: { cellWidth: 6.5, halign: 'center' },    // J
      11: { cellWidth: 6.5, halign: 'center' }     // V
    },
    didDrawPage: (data) => {
      let footY = data.cursor?.y ? data.cursor.y + 3 : 230;

      // Legend
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      doc.text('FD = Funcionario docente         D = Docente', marginX, footY);

      // Signatures Area
      const sigY = footY + 14;
      const sigBoxWidth = 75;

      // Left Signature: Instructor
      doc.line(marginX, sigY, marginX + sigBoxWidth, sigY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('Nombre y firma del instructor (a)', marginX + (sigBoxWidth / 2), sigY + 3.5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text(curso.instructor || '', marginX + (sigBoxWidth / 2), sigY + 7, { align: 'center' });
      
      const rfcInst = instructorRfc || curso.instructor_rfc || '';
      const curpInst = instructorCurp || curso.instructor_curp || '';
      const es2026 = (curso.folio && curso.folio.includes('2026')) || (curso.fecha_inicio && curso.fecha_inicio.includes('2026'));

      doc.text(`R.F.C.: ${rfcInst || '___________________'}`, marginX, sigY + 11);
      if (curpInst || es2026) {
        doc.text(`CURP: ${curpInst || '___________________'}`, marginX, sigY + 14.5);
      }

      // Right Signature: Coordinador / Administrador
      const coordName = coordinadorNombre || config.coordinadorNombre || 'Alejandro Calderon Rentería';
      const rightSigX = pageWidth - marginX - sigBoxWidth;
      doc.line(rightSigX, sigY, rightSigX + sigBoxWidth, sigY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('Nombre y firma del coordinador (a)', rightSigX + (sigBoxWidth / 2), sigY + 3.5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text(coordName, rightSigX + (sigBoxWidth / 2), sigY + 7, { align: 'center' });
      doc.text(config.coordinadorPuesto || 'Coordinación de Actualización Docente', rightSigX + (sigBoxWidth / 2), sigY + 10.5, { align: 'center' });

      // Bottom Form Code & Revision
      const botY = pageHeight - 8;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(config.codigo, marginX, botY);
      doc.text(`Revisión: ${config.revision}`, rightSigX + sigBoxWidth, botY, { align: 'right' });
    }
  });

  doc.save(`Lista_Asistencia_${curso.folio || 'ITD'}.pdf`);
}
