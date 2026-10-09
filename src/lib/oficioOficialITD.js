import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Devuelve las 14 filas de indicadores en el orden y texto exactos del formato oficial
 */
export function obtenerFilasIndicadores(indicadores) {
  const ind = indicadores || {}
  return [
    { concepto: 'Total de registros analizados', valor: ind.totalRegistros ?? 0 },
    { concepto: 'Docentes únicos (sin repetir)', valor: ind.docentesUnicos ?? 0 },
    { concepto: `Cobertura (de una plantilla de ${ind.plantillaTotal || 417})`, valor: `${ind.coberturaPorcentaje ?? 0}%` },
    { concepto: 'Docentes que no participan', valor: ind.docentesNoParticipan ?? 0 },
    { concepto: 'Participantes de tipo Docente', valor: ind.tipoDocente ?? 0 },
    { concepto: 'Participantes de tipo Profesional', valor: ind.tipoProfesional ?? 0 },
    { concepto: 'Género: Mujeres', valor: ind.mujeres ?? 0 },
    { concepto: 'Género: Hombres', valor: ind.hombres ?? 0 },
    { concepto: 'Participantes en Plataformas Tecnológicas / Habilidades Digitales', valor: ind.habilidadesDigitales ?? 0 },
    { concepto: 'Participantes en Salud Mental', valor: ind.saludMental ?? 0 },
    { concepto: 'Posgrado (M, P) en Plataformas / Habilidades Digitales', valor: ind.posgradoHabDigitales ?? 0 },
    { concepto: 'Licenciatura (L) en Plataformas / Habilidades Digitales', valor: ind.licenciaturaHabDigitales ?? 0 },
    { concepto: 'Posgrado (M, P) en Salud Mental', valor: ind.posgradoSaludMental ?? 0 },
    { concepto: 'Licenciatura (L) en Salud Mental', valor: ind.licenciaturaSaludMental ?? 0 },
  ]
}

/**
 * Genera y descarga el archivo .DOC oficial compatible con Microsoft Word y Google Docs
 */
export function generarOficioDOC(datos) {
  const {
    numOficio = '416',
    anio = new Date().getFullYear(),
    fechaTexto = `Durango, Dgo., ${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    nombreJefe = 'M.C. MÓNICA ROSALES PÉREZ',
    cargoJefe = 'JEFA DEL DEPTO. DESARROLLO ACADÉMICO',
    periodoTexto = '4° Trimestre 2026',
    nombreFirma = 'M.C. Alejandro Calderón Rentería',
    cargoFirma = 'Coordinador de Actualización Docente',
    indicadores = {},
  } = datos

  const filas = obtenerFilasIndicadores(indicadores)
  const cobertura = indicadores.coberturaPorcentaje ?? '0'

  const contenidoHtml = `
<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>Oficio No. ${numOficio}/${anio}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: letter;
      margin: 2.5cm 2.5cm 2.5cm 2.5cm;
      mso-page-orientation: portrait;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.25;
      color: #111827;
      margin: 0;
      padding: 0;
    }
    .encabezado-superior {
      text-align: right;
      font-size: 10pt;
      margin-bottom: 22pt;
    }
    .inst-titulo {
      font-weight: bold;
      color: #111827;
      font-size: 10.5pt;
    }
    .inst-sub {
      color: #374151;
      font-size: 9.5pt;
      margin-bottom: 8pt;
    }
    .oficio-meta {
      color: #111827;
      font-size: 10pt;
    }
    .oficio-num {
      font-weight: bold;
    }
    .destinatario {
      margin-bottom: 18pt;
    }
    .dest-nombre {
      font-weight: bold;
      font-size: 11pt;
      color: #000;
      letter-spacing: 0.5pt;
    }
    .dest-cargo {
      font-weight: bold;
      font-size: 10.5pt;
      color: #111827;
    }
    .dest-presente {
      font-weight: bold;
      font-size: 10.5pt;
      color: #111827;
      margin-top: 2pt;
    }
    .intro {
      text-align: justify;
      font-size: 10.5pt;
      margin-bottom: 14pt;
      color: #1f2937;
    }
    table.tabla-indicadores {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14pt;
      font-size: 9.5pt;
    }
    table.tabla-indicadores th {
      border: 1pt solid #cbd5e1;
      background-color: #f8fafc;
      padding: 5pt 8pt;
      font-weight: bold;
      color: #1e293b;
      text-align: left;
    }
    table.tabla-indicadores th.col-valor {
      text-align: right;
      width: 120pt;
    }
    table.tabla-indicadores td {
      border: 1pt solid #cbd5e1;
      padding: 4.5pt 8pt;
      color: #1e293b;
    }
    table.tabla-indicadores td.col-valor {
      text-align: right;
      font-weight: bold;
      color: #0f172a;
    }
    table.tabla-indicadores tr:nth-child(even) {
      background-color: #fafafa;
    }
    .conclusion {
      text-align: justify;
      font-size: 10.5pt;
      margin-bottom: 22pt;
      color: #1f2937;
    }
    .firma-bloque {
      margin-top: 20pt;
      text-align: left;
    }
    .atentamente {
      font-weight: bold;
      letter-spacing: 2pt;
      font-size: 10pt;
      color: #000;
      margin-bottom: 3pt;
    }
    .lema1 {
      font-style: italic;
      font-size: 9.5pt;
      color: #1f2937;
    }
    .lema2 {
      font-style: italic;
      font-size: 9.5pt;
      color: #1f2937;
      margin-bottom: 36pt;
    }
    .firma-nombre {
      font-weight: bold;
      font-size: 11pt;
      color: #000;
    }
    .firma-cargo {
      font-weight: bold;
      font-size: 10pt;
      color: #374151;
    }
    .pie-ccp {
      margin-top: 24pt;
      font-size: 8.5pt;
      color: #4b5563;
    }
    .membrete-superior-barras {
      border-top: 4pt solid #1B396A;
      border-bottom: 2pt solid #9F2241;
      padding-bottom: 8pt;
      margin-bottom: 18pt;
    }
    .membrete-inferior-pie {
      border-top: 1pt solid #cbd5e1;
      border-bottom: 2pt solid #9F2241;
      margin-top: 32pt;
      padding-top: 6pt;
      padding-bottom: 6pt;
      font-size: 8pt;
      color: #64748b;
    }
  </style>
</head>
<body>
  <!-- Membrete Superior Institucional -->
  <div class="membrete-superior-barras">
    <table style="width: 100%; border: none; border-collapse: collapse;">
      <tr>
        <td style="border: none; vertical-align: middle;">
          <strong style="color: #000; font-size: 11pt;">EDUCACIÓN</strong><br>
          <span style="font-size: 8pt; color: #64748b;">SECRETARÍA DE EDUCACIÓN PÚBLICA</span>
        </td>
        <td style="border: none; vertical-align: middle; padding-left: 12pt;">
          <strong style="color: #1B396A; font-size: 10pt;">TECNOLÓGICO NACIONAL DE MÉXICO®</strong><br>
          <span style="font-size: 8pt; color: #9F2241; font-weight: bold;">INSTITUTO TECNOLÓGICO DE DURANGO</span>
        </td>
      </tr>
    </table>
  </div>

  <!-- Encabezado superior derecho -->
  <div class="encabezado-superior">
    <div class="inst-titulo">Instituto Tecnológico de Durango</div>
    <div class="inst-sub">Departamento de desarrollo académico</div>
    <div class="oficio-meta">${fechaTexto}</div>
    <div class="oficio-meta oficio-num">Oficio No. ${numOficio}/${anio}</div>
  </div>

  <!-- Destinatario -->
  <div class="destinatario">
    <div class="dest-nombre">${nombreJefe.toUpperCase()}</div>
    <div class="dest-cargo">${cargoJefe.toUpperCase()}</div>
    <div class="dest-presente">PRESENTE</div>
  </div>

  <!-- Párrafo inicial -->
  <div class="intro">
    Sirva la presente para informarle que durante el <strong>${periodoTexto}</strong>, el programa de Formación y Actualización Docente presenta los siguientes resultados:
  </div>

  <!-- Tabla de Indicadores -->
  <table class="tabla-indicadores">
    <thead>
      <tr>
        <th>Indicador / Concepto</th>
        <th class="col-valor">Valor / Cantidad</th>
      </tr>
    </thead>
    <tbody>
      ${filas
        .map(
          (f) => `
        <tr>
          <td>${f.concepto}</td>
          <td class="col-valor">${f.valor}</td>
        </tr>`
        )
        .join('')}
    </tbody>
  </table>

  <!-- Párrafo de conclusión -->
  <div class="conclusion">
    Los indicadores muestran una participación en las actividades de actualización docente, alcanzando una cobertura del <strong>${cobertura}%</strong>.
  </div>

  <!-- Firma -->
  <div class="firma-bloque">
    <div class="atentamente">A T E N T A M E N T E</div>
    <div class="lema1">Excelencia en Educación Tecnológica®</div>
    <div class="lema2">La Técnica al Servicio de la Patria</div>
    <div class="firma-nombre">${nombreFirma}</div>
    <div class="firma-cargo">${cargoFirma}</div>
  </div>

  <!-- Pie c.c.p -->
  <div class="pie-ccp">
    c.c.p Archivo
  </div>

  <!-- Membrete Inferior Institucional -->
  <div class="membrete-inferior-pie">
    <table style="width: 100%; border: none; border-collapse: collapse; font-size: 8pt;">
      <tr>
        <td style="border: none; vertical-align: middle; width: 25%;">
          <strong style="color: #92400e;">2026</strong><br>
          <span style="font-style: italic;">Año de Margarita Maza</span>
        </td>
        <td style="border: none; text-align: center; vertical-align: middle; width: 50%;">
          Blvd. Felipe Pescador No. 1830 Ote., Durango, Dgo., C.P. 34080<br>
          e-mail: depdesarrolloacademico@itdurango.edu.mx · <strong>tecnm.mx</strong> | <strong>itdurango.edu.mx</strong>
        </td>
        <td style="border: none; text-align: right; vertical-align: middle; width: 25%;">
          <strong style="color: #1B396A;">SGI · 100% LIBRE DE PLÁSTICO</strong>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
`

  const blob = new Blob(['\ufeff', contenidoHtml], { type: 'application/msword;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Oficio_${numOficio}_${anio}.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Genera el documento PDF oficial idéntico al screenshot proporcionado
 */
export async function generarOficioPDF(datos) {
  const {
    numOficio = '416',
    anio = new Date().getFullYear(),
    fechaTexto = `Durango, Dgo., ${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    nombreJefe = 'M.C. MÓNICA ROSALES PÉREZ',
    cargoJefe = 'JEFA DEL DEPTO. DESARROLLO ACADÉMICO',
    periodoTexto = '4° Trimestre 2026',
    nombreFirma = 'M.C. Alejandro Calderón Rentería',
    cargoFirma = 'Coordinador de Actualización Docente',
    indicadores = {},
    descargar = true,
  } = datos

  const doc = new jsPDF({
    unit: 'mm',
    format: 'letter',
  })

  const pageWidth = doc.internal.pageSize.getWidth() // 215.9 mm
  const pageHeight = doc.internal.pageSize.getHeight() // 279.4 mm
  const marginX = 20

  // 1. Franja institucional superior (Navy + Guinda)
  doc.setFillColor(27, 57, 106) // ITD Navy
  doc.rect(0, 0, pageWidth, 5, 'F')
  doc.setFillColor(159, 34, 65) // ITD Guinda
  doc.rect(0, 5, pageWidth, 2, 'F')

  // 2. Logotipos y Membrete Superior
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(20, 20, 20)
  doc.text('EDUCACIÓN', marginX, 14)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  doc.text('SECRETARÍA DE EDUCACIÓN PÚBLICA', marginX, 17.5)

  // Separador vertical
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.3)
  doc.line(marginX + 52, 10, marginX + 52, 19)

  // TecNM
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(27, 57, 106)
  doc.text('TECNOLÓGICO NACIONAL DE MÉXICO®', marginX + 56, 14)

  doc.setFontSize(7)
  doc.setTextColor(159, 34, 65)
  doc.text('INSTITUTO TECNOLÓGICO DE DURANGO', marginX + 56, 17.5)

  // Línea divisoria bajo el membrete
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.4)
  doc.line(marginX, 21, pageWidth - marginX, 21)

  // 3. Encabezado superior derecho
  let y = 28
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(20, 20, 20)
  doc.text('Instituto Tecnológico de Durango', pageWidth - marginX, y, { align: 'right' })

  y += 4.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(60, 60, 60)
  doc.text('Departamento de desarrollo académico', pageWidth - marginX, y, { align: 'right' })

  y += 6
  doc.setFontSize(9)
  doc.setTextColor(20, 20, 20)
  doc.text(fechaTexto, pageWidth - marginX, y, { align: 'right' })

  y += 4.5
  doc.setFont('helvetica', 'bold')
  doc.text(`Oficio No. ${numOficio}/${anio}`, pageWidth - marginX, y, { align: 'right' })

  // 4. Destinatario
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(0, 0, 0)
  doc.text(nombreJefe.toUpperCase(), marginX, y)

  y += 4.2
  doc.text(cargoJefe.toUpperCase(), marginX, y)

  y += 4.2
  doc.text('PRESENTE', marginX, y)

  // 5. Párrafo introductorio
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(30, 30, 30)
  const textoIntro = `Sirva la presente para informarle que durante el ${periodoTexto}, el programa de Formación y Actualización Docente presenta los siguientes resultados:`
  const lineasIntro = doc.splitTextToSize(textoIntro, pageWidth - marginX * 2)
  doc.text(lineasIntro, marginX, y)

  y += lineasIntro.length * 4.2 + 2

  // 6. Tabla de Indicadores
  const filas = obtenerFilasIndicadores(indicadores)
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Indicador / Concepto', 'Valor / Cantidad']],
    body: filas.map((f) => [f.concepto, String(f.valor)]),
    styles: {
      fontSize: 7.8,
      cellPadding: 1.5,
      textColor: [30, 30, 30],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 'auto', fontStyle: 'normal' },
      1: { cellWidth: 38, halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] },
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
  })

  // 7. Párrafo de conclusión
  let finalY = doc.lastAutoTable.finalY + 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(30, 30, 30)
  const cobertura = indicadores.coberturaPorcentaje ?? '0'
  const textoConcl = `Los indicadores muestran una participación en las actividades de actualización docente, alcanzando una cobertura del ${cobertura}%.`
  const lineasConcl = doc.splitTextToSize(textoConcl, pageWidth - marginX * 2)
  doc.text(lineasConcl, marginX, finalY)

  finalY += lineasConcl.length * 4.2 + 6

  // 8. Bloque de firma
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  doc.text('A T E N T A M E N T E', marginX, finalY)

  finalY += 3.8
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(60, 60, 60)
  doc.text('Excelencia en Educación Tecnológica®', marginX, finalY)

  finalY += 3.8
  doc.text('La Técnica al Servicio de la Patria', marginX, finalY)

  finalY += 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  doc.text(nombreFirma, marginX, finalY)

  finalY += 3.8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(70, 70, 70)
  doc.text(cargoFirma, marginX, finalY)

  // 9. Pie c.c.p Archivo
  finalY += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text('c.c.p Archivo', marginX, finalY)

  // 10. Membrete Inferior Oficial (Pie Institucional)
  const pieY = pageHeight - 16
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.4)
  doc.line(marginX, pieY, pageWidth - marginX, pieY)

  // Año de Margarita Maza
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(146, 64, 14) // Amber-800
  doc.text('2026', marginX, pieY + 4)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6.5)
  doc.setTextColor(100, 116, 139)
  doc.text('Año de Margarita Maza', marginX, pieY + 7.5)

  // Dirección central
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.2)
  doc.setTextColor(71, 85, 105)
  doc.text('Blvd. Felipe Pescador No. 1830 Ote., Durango, Dgo., C.P. 34080', pageWidth / 2, pieY + 4, { align: 'center' })
  doc.text('e-mail: depdesarrolloacademico@itdurango.edu.mx · tecnm.mx | itdurango.edu.mx', pageWidth / 2, pieY + 7.5, { align: 'center' })

  // Sellos a la derecha
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(27, 57, 106)
  doc.text('SGI · 100% LIBRE DE PLÁSTICO', pageWidth - marginX, pieY + 5.5, { align: 'right' })

  // Franja institucional inferior
  doc.setFillColor(159, 34, 65) // Guinda
  doc.rect(0, pageHeight - 4, pageWidth, 1.5, 'F')
  doc.setFillColor(27, 57, 106) // Navy
  doc.rect(0, pageHeight - 2.5, pageWidth, 2.5, 'F')

  if (descargar) {
    doc.save(`Oficio_TecNM_${numOficio}_${anio}.pdf`)
  }

  return doc
}
