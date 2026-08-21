// src/components/GenerarListaAsistencia.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function GenerarListaAsistencia({ cursoId, onClose }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [datosCurso, setDatosCurso] = useState(null);
  const [participantes, setParticipantes] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, [cursoId]);

  async function cargarDatos() {
    setCargando(true);
    setError('');

    try {
      // 1. Obtener datos del curso
      const { data: curso, error: cursoError } = await supabase
        .from('cursos')
        .select('*, convocatorias(nombre, anio, mes)')
        .eq('id', cursoId)
        .single();

      if (cursoError) throw cursoError;

      // 2. Obtener inscripciones activas con datos de docentes
      const { data: inscripciones, error: insError } = await supabase
        .from('inscripciones')
        .select(`
          id,
          folio_personal,
          docentes (
            nombre_completo,
            curp,
            email,
            telefono,
            genero,
            nivel,
            departamento
          )
        `)
        .eq('curso_id', cursoId)
        .eq('estado', 'activo')
        .order('created_at');

      if (insError) throw insError;

      const participantesData = (inscripciones || []).map(ins => ({
        nombre_completo: ins.docentes?.nombre_completo || '',
        curp: ins.docentes?.curp || '',
        rfc: ins.docentes?.curp || '',
        email: ins.docentes?.email || '',
        telefono: ins.docentes?.telefono || '',
        genero: ins.docentes?.genero || '',
        nivel: ins.docentes?.nivel || '',
        departamento: ins.docentes?.departamento || '',
        folio_personal: ins.folio_personal || ''
      }));

      setParticipantes(participantesData);
      setDatosCurso({
        nombre: curso.nombre || 'Sin nombre',
        folio: curso.folio || 'N/A',
        instructor: curso.instructor || 'No asignado',
        periodo: curso.semana || 'N/A',
        duracion: curso.horas ? `${curso.horas} hrs` : 'N/A',
        horario: curso.horario || 'N/A',
        lugar: curso.lugar || 'No especificado',
        fecha_inicio: curso.fecha_inicio || '',
        fecha_fin: curso.fecha_fin || '',
        convocatoria: curso.convocatorias?.nombre || ''
      });

    } catch (err) {
      console.error('Error al cargar datos:', err);
      setError('No se pudieron cargar los datos del curso.');
    } finally {
      setCargando(false);
    }
  }

  // ===== GENERAR PDF =====
  function handlePDF() {
    if (!datosCurso) return;
    const doc = new jsPDF('p', 'mm', 'letter');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Encabezado
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('INSTITUTO TECNOLÓGICO DE DURANGO', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Nombre del documento: Formato de Lista de Asistencia', 14, 22);
    doc.text('Referencias a la Norma NMX-CC-9001-IMNC-2008 6.2.2', 14, 27);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Código: ITD-AD-FO-8', 14, 22, { align: 'right' });
    doc.text('Revisión: 1', 14, 27, { align: 'right' });
    doc.text('Página 1 de 1', 14, 32, { align: 'right' });
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-MX')}`, 14, 37, { align: 'right' });

    // Datos del curso
    let y = 48;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('CURSO PRESENCIAL', 14, y);
    doc.text('CLAVE:', 160, y);
    doc.setFont('helvetica', 'normal');
    doc.text(datosCurso.folio || 'N/A', 180, y);
    
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Hoja:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text('1', 30, y);
    doc.text('de', 40, y);
    doc.text('1', 50, y);
    
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('Nombre del curso:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(datosCurso.nombre || 'Sin nombre', 60, y);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Folio:', 160, y);
    doc.setFont('helvetica', 'normal');
    doc.text(datosCurso.folio || 'N/A', 180, y);
    
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Nombre del instructor (a):', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(datosCurso.instructor || 'No asignado', 60, y);
    
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('Periodo:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(datosCurso.periodo || 'N/A', 35, y);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Duración:', 80, y);
    doc.setFont('helvetica', 'normal');
    doc.text(datosCurso.duracion || 'N/A', 100, y);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Horario:', 130, y);
    doc.setFont('helvetica', 'normal');
    doc.text(datosCurso.horario || 'N/A', 150, y);

    y += 12;

    // Tabla
    const headers = ['No.', 'Nombre del Participante', 'R.F.C.', 'Puesto y departamento', 'Nivel', 'FD', 'D', 'L', 'M', 'M', 'J', 'V'];
    const body = participantes.map((p, idx) => [
      idx + 1,
      p.nombre_completo || '',
      p.rfc || '',
      p.departamento || '',
      p.nivel || '',
      '', '', '', '', '', '', ''
    ]);

    autoTable(doc, {
      head: [headers],
      body: body,
      startY: y,
      theme: 'grid',
      headStyles: { fillColor: [27, 57, 106], textColor: 255, fontSize: 7, halign: 'center' },
      styles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 55 },
        2: { cellWidth: 30 },
        3: { cellWidth: 45 },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 8, halign: 'center' },
        6: { cellWidth: 8, halign: 'center' },
        7: { cellWidth: 8, halign: 'center' },
        8: { cellWidth: 8, halign: 'center' },
        9: { cellWidth: 8, halign: 'center' },
        10: { cellWidth: 8, halign: 'center' },
        11: { cellWidth: 8, halign: 'center' },
      },
      didDrawPage: function(data) {
        const finalY = data.cursor.y + 5;
        doc.setFontSize(7);
        doc.text('FD = Funcionario docente               D = Docente', 14, finalY);
        
        const firmasY = finalY + 15;
        doc.line(14, firmasY, 80, firmasY);
        doc.setFont('helvetica', 'bold');
        doc.text('Nombre y firma del instructor (a)', 14, firmasY + 5);
        doc.setFont('helvetica', 'normal');
        doc.text('R.F.C.', 14, firmasY + 10);
        doc.text('CURP', 14, firmasY + 15);
        
        doc.line(140, firmasY, 200, firmasY);
        doc.setFont('helvetica', 'bold');
        doc.text('Nombre y firma del coordinador (a)', 140, firmasY + 5);
      }
    });

    // Pie de página
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.text('ITD-AD-FO-8', 14, doc.internal.pageSize.getHeight() - 10);
      doc.text('Revisión: 1', 60, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
    }

    doc.save(`Lista_Asistencia_${datosCurso.folio || 'curso'}.pdf`);
  }

  // ===== GENERAR EXCEL =====
  function handleExcel() {
    if (!datosCurso) return;
    const wb = XLSX.utils.book_new();
    
    const wsData = [
      ['INSTITUTO TECNOLÓGICO DE DURANGO'],
      ['Nombre del documento: Formato de Lista de Asistencia'],
      ['Código: ITD-AD-FO-8', 'Revisión: 1'],
      [''],
      ['CURSO PRESENCIAL', 'CLAVE:', datosCurso.folio || 'N/A'],
      ['Hoja:', '1', 'de', '1'],
      ['Nombre del curso:', datosCurso.nombre || 'Sin nombre', 'Folio:', datosCurso.folio || 'N/A'],
      ['Nombre del instructor (a):', datosCurso.instructor || 'No asignado'],
      ['Periodo:', datosCurso.periodo || 'N/A', 'Duración:', datosCurso.duracion || 'N/A', 'Horario:', datosCurso.horario || 'N/A'],
      ['']
    ];
    
    const headers = ['No.', 'Nombre del Participante', 'R.F.C.', 'Puesto y departamento', 'Nivel', 'FD', 'D', 'L', 'M', 'M', 'J', 'V'];
    wsData.push(headers);
    
    participantes.forEach((p, idx) => {
      wsData.push([
        idx + 1,
        p.nombre_completo || '',
        p.rfc || '',
        p.departamento || '',
        p.nivel || '',
        '', '', '', '', '', '', ''
      ]);
    });
    
    wsData.push([]);
    wsData.push(['FD = Funcionario docente               D = Docente']);
    wsData.push([]);
    wsData.push(['Nombre y firma del instructor (a)', '', '', 'Nombre y firma del coordinador (a)']);
    wsData.push(['R.F.C.', '', '', '']);
    wsData.push(['CURP', '', '', '']);
    wsData.push([]);
    wsData.push(['ITD-AD-FO-8', 'Revisión: 1']);
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 10 }, { wch: 40 }, { wch: 20 }, { wch: 30 }, 
      { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, 
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Lista Asistencia');
    XLSX.writeFile(wb, `Lista_Asistencia_${datosCurso.folio || 'curso'}.xlsx`);
  }

  // ===== IMPRIMIR =====
  function handleImprimir() {
    if (!datosCurso) return;
    const ventana = window.open('', '_blank', 'width=900,height=700');
    if (!ventana) {
      alert('Por favor, permite ventanas emergentes para imprimir.');
      return;
    }
    
    let html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><title>Lista de Asistencia</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .header { text-align: center; border-bottom: 2px solid #1B396A; padding-bottom: 10px; margin-bottom: 15px; }
      .header h1 { color: #1B396A; font-size: 18px; margin: 0; }
      .header p { margin: 2px 0; font-size: 11px; color: #4b5563; }
      .curso-info { margin: 10px 0; font-size: 11px; width: 100%; }
      .curso-info td { padding: 2px 8px; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 10px; }
      th { background: #1B396A; color: white; padding: 5px; text-align: center; }
      td { padding: 4px 5px; border: 1px solid #d1d5db; }
      .firmas { margin-top: 20px; display: flex; justify-content: space-between; }
      .firma-box { text-align: center; width: 200px; }
      .firma-linea { border-top: 1px solid black; margin: 30px 0 5px 0; }
      .footer { margin-top: 20px; font-size: 8px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 10px; }
      .leyenda { font-size: 8px; margin-top: 5px; }
      @media print { .no-print { display: none; } body { padding: 10px; } }
    </style>
    </head>
    <body>
      <div class="header">
        <h1>INSTITUTO TECNOLÓGICO DE DURANGO</h1>
        <p>Nombre del documento: Formato de Lista de Asistencia</p>
        <p>Referencias a la Norma NMX-CC-9001-IMNC-2008 6.2.2</p>
        <p style="float:right;">Código: ITD-AD-FO-8 | Revisión: 1 | Página 1 de 1 | Fecha de emisión: ${new Date().toLocaleDateString('es-MX')}</p>
      </div>
      <div style="clear:both;"></div>
      <table class="curso-info">
        <tr><td><strong>CURSO PRESENCIAL</strong></td><td><strong>CLAVE:</strong> ${datosCurso.folio || 'N/A'}</td></tr>
        <tr><td><strong>Hoja:</strong> 1 de 1</td><td></td></tr>
        <tr><td><strong>Nombre del curso:</strong> ${datosCurso.nombre || 'Sin nombre'}</td><td><strong>Folio:</strong> ${datosCurso.folio || 'N/A'}</td></tr>
        <tr><td><strong>Nombre del instructor (a):</strong> ${datosCurso.instructor || 'No asignado'}</td><td></td></tr>
        <tr><td><strong>Periodo:</strong> ${datosCurso.periodo || 'N/A'}</td><td><strong>Duración:</strong> ${datosCurso.duracion || 'N/A'} | <strong>Horario:</strong> ${datosCurso.horario || 'N/A'}</td></tr>
      </table>
      <table>
        <thead><tr><th>No.</th><th>Nombre del Participante</th><th>R.F.C.</th><th>Puesto y departamento</th><th>Nivel</th><th>FD</th><th>D</th><th>L</th><th>M</th><th>M</th><th>J</th><th>V</th></tr></thead>
        <tbody>`;
    
    participantes.forEach((p, i) => {
      html += `<tr><td style="text-align:center;">${i+1}</td><td>${p.nombre_completo || ''}</td><td>${p.rfc || ''}</td><td>${p.departamento || ''}</td><td style="text-align:center;">${p.nivel || ''}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
    });
    
    html += `
        </tbody>
      </table>
      <div class="leyenda">FD = Funcionario docente &nbsp;&nbsp;&nbsp; D = Docente</div>
      <div class="firmas">
        <div class="firma-box"><div class="firma-linea"></div><div><strong>Nombre y firma del instructor (a)</strong></div><div style="font-size:9px;">R.F.C.</div><div style="font-size:9px;">CURP</div></div>
        <div class="firma-box"><div class="firma-linea"></div><div><strong>Nombre y firma del coordinador (a)</strong></div></div>
      </div>
      <div class="footer">ITD-AD-FO-8 &nbsp;|&nbsp; Revisión: 1 &nbsp;|&nbsp; ${new Date().toLocaleDateString('es-MX')}</div>
      <div class="no-print" style="text-align:center;margin-top:20px;">
        <button onclick="window.print()" style="padding:10px 30px;background:#1B396A;color:white;border:none;border-radius:5px;font-size:14px;cursor:pointer;">🖨️ Imprimir</button>
        <button onclick="window.close()" style="padding:10px 30px;background:#6b7280;color:white;border:none;border-radius:5px;font-size:14px;cursor:pointer;margin-left:10px;">Cerrar</button>
      </div>
      <script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script>
    </body>
    </html>`;
    
    ventana.document.write(html);
    ventana.document.close();
  }

  // ===== RENDER =====
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="bg-itd-navy text-white px-6 py-4 rounded-t-2xl flex justify-between items-center sticky top-0 z-10">
          <div>
            <h2 className="font-display text-xl font-semibold">📋 Lista de Asistencia</h2>
            <p className="text-sm text-white/70">{datosCurso?.nombre} - {datosCurso?.folio}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl">✕</button>
        </div>
        <div className="p-6">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">❌ {error}</div>}
          {cargando ? (
            <div className="text-center py-12 text-itd-navyDark/50">Cargando participantes...</div>
          ) : participantes.length === 0 ? (
            <div className="text-center py-12"><div className="text-4xl mb-4">📭</div><p className="text-itd-navyDark/60">No hay participantes inscritos en este curso.</p></div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm bg-itd-sand/30 p-4 rounded-lg">
                <div><span className="font-bold text-itd-navyDark/70">Curso:</span> <span className="ml-2">{datosCurso?.nombre}</span></div>
                <div><span className="font-bold text-itd-navyDark/70">Folio:</span> <span className="ml-2">{datosCurso?.folio}</span></div>
                <div><span className="font-bold text-itd-navyDark/70">Instructor:</span> <span className="ml-2">{datosCurso?.instructor}</span></div>
                <div><span className="font-bold text-itd-navyDark/70">Participantes:</span> <span className="ml-2 font-bold text-itd-navy">{participantes.length}</span></div>
              </div>
              <div className="overflow-x-auto border rounded-lg mb-4">
                <table className="w-full text-sm border-collapse">
                  <thead><tr className="bg-itd-navy text-white"><th className="p-2 text-center w-12">#</th><th className="p-2 text-left">Nombre</th><th className="p-2 text-left">R.F.C.</th><th className="p-2 text-left">Departamento</th><th className="p-2 text-center">Nivel</th></tr></thead>
                  <tbody>
                    {participantes.map((p, i) => (
                      <tr key={i} className="border-b hover:bg-itd-sand/30">
                        <td className="p-2 text-center">{i+1}</td>
                        <td className="p-2">{p.nombre_completo}</td>
                        <td className="p-2">{p.rfc}</td>
                        <td className="p-2">{p.departamento}</td>
                        <td className="p-2 text-center">{p.nivel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-3 pt-4 border-t">
                <button onClick={handlePDF} className="px-6 py-2.5 rounded-lg bg-itd-guinda text-white font-semibold hover:opacity-90 flex items-center gap-2">📄 Descargar PDF</button>
                <button onClick={handleExcel} className="px-6 py-2.5 rounded-lg bg-green-700 text-white font-semibold hover:opacity-90 flex items-center gap-2">📊 Descargar Excel</button>
                <button onClick={handleImprimir} className="px-6 py-2.5 rounded-lg bg-itd-navy text-white font-semibold hover:opacity-90 flex items-center gap-2">🖨️ Imprimir</button>
                <button onClick={onClose} className="px-6 py-2.5 rounded-lg border border-itd-navy/20 text-itd-navyDark/70 hover:bg-itd-sand">Cerrar</button>
              </div>
              <div className="mt-4 bg-amber-50 border-l-4 border-amber-500 p-3 text-sm text-amber-800 rounded">
                <strong>⚠️ IMPORTANTE:</strong> La lista incluye solo participantes con inscripción activa. Las columnas FD/D/L/M/M/J/V se completan manualmente al tomar asistencia.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
