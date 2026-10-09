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
      margin-top: 28pt;
      font-size: 8.5pt;
      color: #4b5563;
    }
  </style>
</head>
<body>
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
  const marginX = 20

  // 1. Franja institucional superior sutil
  doc.setFillColor(27, 57, 106) // ITD Navy
  doc.rect(0, 0, pageWidth, 4, 'F')
  doc.setFillColor(155, 17, 30) // ITD Guinda
  doc.rect(0, 4, pageWidth, 1.5, 'F')

  // 2. Encabezado superior derecho
  let y = 20
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(20, 20, 20)
  doc.text('Instituto Tecnológico de Durango', pageWidth - marginX, y, { align: 'right' })

  y += 4.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(60, 60, 60)
  doc.text('Departamento de desarrollo académico', pageWidth - marginX, y, { align: 'right' })

  y += 6.5
  doc.setFontSize(9)
  doc.setTextColor(20, 20, 20)
  doc.text(fechaTexto, pageWidth - marginX, y, { align: 'right' })

  y += 4.5
  doc.setFont('helvetica', 'bold')
  doc.text(`Oficio No. ${numOficio}/${anio}`, pageWidth - marginX, y, { align: 'right' })

  // 3. Destinatario
  y += 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.text(nombreJefe.toUpperCase(), marginX, y)

  y += 4.5
  doc.text(cargoJefe.toUpperCase(), marginX, y)

  y += 4.5
  doc.text('PRESENTE', marginX, y)

  // 4. Párrafo introductorio
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(30, 30, 30)
  const textoIntro = `Sirva la presente para informarle que durante el ${periodoTexto}, el programa de Formación y Actualización Docente presenta los siguientes resultados:`
  const lineasIntro = doc.splitTextToSize(textoIntro, pageWidth - marginX * 2)
  doc.text(lineasIntro, marginX, y)

  y += lineasIntro.length * 4.5 + 2

  // 5. Tabla de Indicadores
  const filas = obtenerFilasIndicadores(indicadores)
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Indicador / Concepto', 'Valor / Cantidad']],
    body: filas.map((f) => [f.concepto, String(f.valor)]),
    styles: {
      fontSize: 8,
      cellPadding: 1.8,
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
      1: { cellWidth: 42, halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] },
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
  })

  // 6. Párrafo de conclusión
  let finalY = doc.lastAutoTable.finalY + 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(30, 30, 30)
  const cobertura = indicadores.coberturaPorcentaje ?? '0'
  const textoConcl = `Los indicadores muestran una participación en las actividades de actualización docente, alcanzando una cobertura del ${cobertura}%.`
  const lineasConcl = doc.splitTextToSize(textoConcl, pageWidth - marginX * 2)
  doc.text(lineasConcl, marginX, finalY)

  finalY += lineasConcl.length * 4.5 + 8

  // 7. Bloque de firma
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(0, 0, 0)
  doc.text('A T E N T A M E N T E', marginX, finalY)

  finalY += 4
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.setTextColor(50, 50, 50)
  doc.text('Excelencia en Educación Tecnológica®', marginX, finalY)

  finalY += 4
  doc.text('La Técnica al Servicio de la Patria', marginX, finalY)

  finalY += 16
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(0, 0, 0)
  doc.text(nombreFirma, marginX, finalY)

  finalY += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(60, 60, 60)
  doc.text(cargoFirma, marginX, finalY)

  // 8. Pie de página c.c.p
  finalY += 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text('c.c.p Archivo', marginX, finalY)

  if (descargar) {
    doc.save(`Oficio_TecNM_${numOficio}_${anio}.pdf`)
  }

  return doc
}
