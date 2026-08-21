import * as XLSX from 'xlsx';
import { Curso, Participante, FormatoConfig } from '../types';

export function exportarListaAsistenciaExcel(
  curso: Curso,
  participantes: Participante[],
  config: FormatoConfig,
  instructorCurp?: string,
  instructorRfc?: string,
  coordinadorNombre?: string
) {
  const wb = XLSX.utils.book_new();

  // Excel data grid representation
  const wsData: any[][] = [
    // Header block
    ['INSTITUTO TECNOLÓGICO DE DURANGO', '', '', '', '', '', '', '', '', '', `Código: ${config.codigo}`, ''],
    ['Nombre del documento: Formato de Lista de Asistencia', '', '', '', '', '', '', '', '', '', `Revisión: ${config.revision}`, ''],
    ['Referencias a la Norma NMX-CC-9001-IMNC-2008 6.2.2', '', '', '', '', '', '', '', '', '', 'Página 1 de 1', ''],
    ['', '', '', '', '', '', '', '', '', '', `Fecha de emisión: ${config.fechaEmision}`, ''],
    [''],
    // Course info
    [curso.modalidad || 'CURSO PRESENCIAL', '', '', '', '', '', '', '', '', '', '', ''],
    ['Hoja:', '1', 'de', '1', '', '', '', 'Folio:', curso.folio || 'N/A', '', '', ''],
    ['Nombre del curso:', curso.nombre || 'Sin nombre', '', '', '', '', '', '', '', '', '', ''],
    ['Nombre del instructor (a):', curso.instructor || 'No asignado', '', '', '', '', '', '', '', '', '', ''],
    ['Periodo:', curso.periodo || curso.semana || 'Del 12 al 16 de enero de 2026', '', '', 'Duración:', curso.duracion || `${curso.horas || 30} hrs`, '', 'Horario:', curso.horario || 'N/A', '', '', ''],
    [''],
    // Two-level headers
    ['No.', 'Nombre del Participante', 'R.F.C.', 'Puesto y departamento de adscripción', 'Nivel de Puesto', 'Asistencia', '', '', '', '', '', ''],
    ['', '', '', '', '', 'FD', 'D', 'L', 'M', 'M', 'J', 'V']
  ];

  // Add participants rows (padded to 15 if fewer)
  const displayCount = Math.max(participantes.length, 15);
  for (let i = 0; i < displayCount; i++) {
    const p = participantes[i];
    if (p) {
      const isFD = p.es_fd || p.nivel?.toLowerCase().includes('funcionario') || p.puesto?.toLowerCase().includes('jef');
      const isD = p.es_d || (!isFD && (p.nivel?.toLowerCase().includes('docente') || true));

      wsData.push([
        i + 1,
        p.nombre_completo || '',
        p.rfc || p.curp || '',
        `${p.puesto ? p.puesto + ' - ' : ''}${p.departamento || ''}`,
        p.nivel || (isFD ? 'Funcionario' : 'Docente'),
        isFD ? 'X' : '',
        !isFD && isD ? 'X' : '',
        p.asistencias?.L ? 'X' : '',
        p.asistencias?.M ? 'X' : '',
        p.asistencias?.M2 ? 'X' : '',
        p.asistencias?.J ? 'X' : '',
        p.asistencias?.V ? 'X' : ''
      ]);
    } else {
      wsData.push([i + 1, '', '', '', '', '', '', '', '', '', '', '']);
    }
  }

  // Footer & Signatures
  wsData.push([]);
  wsData.push(['FD = Funcionario docente               D = Docente']);
  wsData.push([]);
  wsData.push(['________________________________________', '', '', '', '', '', '________________________________________']);
  wsData.push(['Nombre y firma del instructor (a)', '', '', '', '', '', 'Nombre y firma del coordinador (a)']);
  wsData.push([curso.instructor || '', '', '', '', '', '', coordinadorNombre || config.coordinadorNombre]);
  wsData.push([`R.F.C. ${instructorRfc || curso.instructor_rfc || ''}`, '', '', '', '', '', config.coordinadorPuesto]);
  
  const curpInst = instructorCurp || curso.instructor_curp;
  const es2026 = (curso.folio && curso.folio.includes('2026')) || (curso.fecha_inicio && curso.fecha_inicio.includes('2026'));
  if (curpInst || es2026) {
    wsData.push([`CURP: ${curpInst || ''}`, '', '', '', '', '', '']);
  }
  
  wsData.push([]);
  wsData.push([config.codigo, '', '', '', '', '', '', '', '', '', `Revisión: ${config.revision}`]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 6 },   // No.
    { wch: 38 },  // Nombre
    { wch: 18 },  // RFC
    { wch: 34 },  // Puesto / Depto
    { wch: 16 },  // Nivel
    { wch: 6 },   // FD
    { wch: 6 },   // D
    { wch: 5 },   // L
    { wch: 5 },   // M
    { wch: 5 },   // M
    { wch: 5 },   // J
    { wch: 5 }    // V
  ];

  // Configure merges
  ws['!merges'] = [
    // Header title merges
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } },
    // Course info merges
    { s: { r: 5, c: 0 }, e: { r: 5, c: 6 } },
    { s: { r: 7, c: 1 }, e: { r: 7, c: 11 } },
    { s: { r: 8, c: 1 }, e: { r: 8, c: 11 } },
    // Table header merges
    { s: { r: 11, c: 0 }, e: { r: 12, c: 0 } }, // No.
    { s: { r: 11, c: 1 }, e: { r: 12, c: 1 } }, // Nombre
    { s: { r: 11, c: 2 }, e: { r: 12, c: 2 } }, // RFC
    { s: { r: 11, c: 3 }, e: { r: 12, c: 3 } }, // Puesto
    { s: { r: 11, c: 4 }, e: { r: 12, c: 4 } }, // Nivel
    { s: { r: 11, c: 5 }, e: { r: 11, c: 11 } } // Asistencia
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Lista Asistencia ITD');
  XLSX.writeFile(wb, `Lista_Asistencia_${curso.folio || 'ITD'}.xlsx`);
}
