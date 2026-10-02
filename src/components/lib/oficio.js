// src/lib/oficio.js
import jsPDF from 'jspdf';
import { dibujarEncabezadoPDF } from './pdfEncabezado';

// Generación oficial y descarga directa en PDF del Oficio de Registro de Curso
export async function descargarOficioRegistro(preregistro, convocatoria) {
  try {
    const anio = preregistro.created_at ? new Date(preregistro.created_at).getFullYear() : new Date().getFullYear();
    const oficioNo = String(preregistro.oficio_no || '---').split('/')[0].trim();

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

    const startY = await dibujarEncabezadoPDF(
      doc,
      'INSTITUTO TECNOLÓGICO DE DURANGO',
      [
        'DEPARTAMENTO DE DESARROLLO ACADÉMICO',
        'COORDINACIÓN DE ACTUALIZACIÓN DOCENTE',
      ]
    );

    const left = 18;
    const pageWidth = doc.internal.pageSize.getWidth();
    const right = pageWidth - 18;
    const textWidth = right - left;

    // Folio y fecha a la derecha
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(27, 57, 106);
    doc.text(`OFICIO No. ${oficioNo}/${anio}`, right, startY + 4, { align: 'right' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const fechaTexto = `Victoria de Durango, Dgo., a ${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    doc.text(fechaTexto, right, startY + 9, { align: 'right' });

    // Destinatario
    let curY = startY + 20;
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('A QUIEN CORRESPONDA:', left, curY);
    curY += 4.5;
    doc.text('PRESENTE.', left, curY);

    // Párrafo introductorio
    curY += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const parrafo = 'Por medio de la presente, se hace constar la solicitud formal y propuesta oficial para el registro e impartición del siguiente curso de capacitación dentro del Programa Institucional de Formación y Actualización Docente:';
    const lineasParrafo = doc.splitTextToSize(parrafo, textWidth);
    doc.text(lineasParrafo, left, curY);
    curY += lineasParrafo.length * 4.5 + 4;

    // Caja de datos del curso
    const campos = [
      { etiqueta: 'Nombre del Curso:', valor: String(preregistro.curso || '---').toUpperCase() },
      { etiqueta: 'Objetivo:', valor: String(preregistro.objetivo || 'No especificado') },
      { etiqueta: 'Periodo:', valor: String(preregistro.periodo || '---') },
      { etiqueta: 'Horario:', valor: String(preregistro.horario || '---') },
      { etiqueta: 'Duración:', valor: `${preregistro.duracion_horas || '30'} horas` },
      { etiqueta: 'Modalidad:', valor: String(preregistro.modalidad || 'Presencial') },
      { etiqueta: 'Lugar / Aula:', valor: String(preregistro.lugar || 'Por definir') },
      { etiqueta: 'Dirigido a:', valor: String(preregistro.dirigido_a || 'Personal docente del ITD') },
    ];

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);

    const cajaStartY = curY;
    curY += 4;

    for (const c of campos) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(27, 57, 106);
      doc.text(c.etiqueta, left + 4, curY);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const valLineas = doc.splitTextToSize(c.valor, textWidth - 45);
      doc.text(valLineas, left + 42, curY);

      curY += Math.max(valLineas.length * 4.2, 5.5);
    }

    const cajaAlto = curY - cajaStartY + 2;
    doc.roundedRect(left, cajaStartY, textWidth, cajaAlto, 2, 2, 'FD');

    // Redibujar texto sobre la caja
    let reY = cajaStartY + 4.5;
    for (const c of campos) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(27, 57, 106);
      doc.text(c.etiqueta, left + 4, reY);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const valLineas = doc.splitTextToSize(c.valor, textWidth - 45);
      doc.text(valLineas, left + 42, reY);

      reY += Math.max(valLineas.length * 4.2, 5.5);
    }

    curY = cajaStartY + cajaAlto + 6;

    // Párrafo de cierre
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Se emite el presente oficio para los fines académicos y administrativos conducentes.', left, curY);

    // Firmas
    const firmasY = Math.max(curY + 28, 225);
    const anchoFirma = 75;

    // Jefe de departamento
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.4);
    doc.line(left + 5, firmasY, left + 5 + anchoFirma, firmasY);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(String(preregistro.nombre_jefe || 'JEFE DE DEPARTAMENTO').toUpperCase(), left + 5 + anchoFirma / 2, firmasY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(String(preregistro.jefatura_cargo || 'Jefe(a) de Departamento'), left + 5 + anchoFirma / 2, firmasY + 8, { align: 'center' });

    // Coordinador
    const coordX = right - anchoFirma - 5;
    doc.line(coordX, firmasY, coordX + anchoFirma, firmasY);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('ALEJANDRO CALDERÓN RENTERÍA', coordX + anchoFirma / 2, firmasY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Coordinador de Actualización Docente', coordX + anchoFirma / 2, firmasY + 8, { align: 'center' });

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Formato de Solicitud y Registro Oficial · TecNM / ITD', left, doc.internal.pageSize.getHeight() - 8);

    doc.save(`Oficio_Registro_${oficioNo}_${anio}.pdf`);
  } catch (err) {
    console.error('Error generando oficio de registro:', err);
    alert('No se pudo generar el documento PDF del oficio: ' + (err.message || err));
  }
}