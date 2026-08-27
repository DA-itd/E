import React from 'react';
import { Curso, Participante, FormatoConfig } from '../types';
import LogoITD from '../LogoITD';

interface Props {
  curso: Curso;
  participantes: Participante[];
  config: FormatoConfig;
  instructorCurp?: string;
  instructorRfc?: string;
  coordinadorNombre?: string;
  interactivo?: boolean;
  onToggleAsistencia?: (participanteId: string, dia: string) => void;
  onToggleTipoDocente?: (participanteId: string, tipo: 'FD' | 'D') => void;
}

export const FormatoImpresionOficial: React.FC<Props> = ({
  curso,
  participantes,
  config,
  instructorCurp,
  instructorRfc,
  coordinadorNombre,
  interactivo = false,
  onToggleAsistencia,
  onToggleTipoDocente
}) => {
  // Pad with empty rows to have at least 15 rows like official document
  const rowCount = Math.max(participantes.length, 15);
  const rows = Array.from({ length: rowCount }, (_, i) => participantes[i] || null);

  return (
    <div className="bg-white text-black p-6 md:p-8 max-w-[279mm] w-full mx-auto border border-gray-300 shadow-sm print:p-0 print:border-none print:shadow-none print:max-w-none print:w-full font-sans text-xs leading-tight">
      {/* 1. Official Header */}
      <div className="border border-black flex items-stretch mb-2">
        {/* Left: Crest/Logo */}
        <div
          className="w-36 sm:w-44 border-r-2 border-black p-1.5 flex items-center justify-center text-center bg-white shrink-0"
          style={{ borderRight: '1.5px solid black' }}
        >
          <img
            src="https://raw.githubusercontent.com/DA-itd/E/main/LOGO_tecnm.jpg"
            alt="Logo TecNM / ITD"
            className="w-auto h-14 max-h-[54px] max-w-[145px] object-contain"
            referrerPolicy="no-referrer"
            onError={(e) => {
              // fallback if offline
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        {/* Center: Title and references */}
        <div className="flex-1 p-2 text-center flex flex-col justify-center">
          <h1 className="font-bold text-sm sm:text-base tracking-wide text-gray-900">{config.institucion}</h1>
          <p className="text-[11px] sm:text-xs font-semibold text-gray-800 mt-0.5">{config.nombreDocumento}</p>
          <p className="text-[9px] sm:text-[10px] text-gray-600 mt-0.5">{config.referenciaNorma}</p>
        </div>

        {/* Right: ISO Code Box */}
        <div
          className="w-44 border-l-2 border-black text-[9px] shrink-0"
          style={{ borderLeft: '1.5px solid black' }}
        >
          <div className="border-b border-black px-2 py-1 flex justify-between">
            <span className="font-semibold">Código:</span>
            <span>{config.codigo}</span>
          </div>
          <div className="border-b border-black px-2 py-1 flex justify-between">
            <span className="font-semibold">Revisión:</span>
            <span>{config.revision}</span>
          </div>
          <div className="border-b border-black px-2 py-1 flex justify-between">
            <span className="font-semibold">Página:</span>
            <span>{config.pagina}</span>
          </div>
          <div className="px-2 py-1 flex justify-between">
            <span className="font-semibold">Emisión:</span>
            <span>{config.fechaEmision}</span>
          </div>
        </div>
      </div>

      {/* 2. Course Header Grid */}
      <div className="border border-black mb-2 text-[10px]">
        {/* Row 1: Modalidad (Sin CLAVE) */}
        <div className="border-b border-black font-semibold py-1 px-3 text-center font-bold tracking-wider">
          {curso.modalidad || 'CURSO PRESENCIAL'}
        </div>

        {/* Row 2: Hoja y Folio */}
        <div className="flex border-b border-black">
          <div className="flex-1 py-1 px-3 border-r border-black flex items-center gap-2">
            <span className="font-semibold">Hoja:</span>
            <span className="font-normal">1</span>
            <span className="font-semibold">de</span>
            <span className="font-normal">1</span>
          </div>
          <div className="w-64 py-1 px-3 flex items-center justify-between">
            <span className="font-semibold">Folio:</span>
            <span className="font-mono font-normal">{curso.folio || 'N/A'}</span>
          </div>
        </div>

        {/* Row 3: Nombre del Curso */}
        <div className="flex border-b border-black py-1 px-3">
          <span className="font-semibold mr-2 shrink-0">Nombre del curso:</span>
          <span className="font-medium uppercase">{curso.nombre || 'Sin nombre'}</span>
        </div>

        {/* Row 4: Instructor */}
        <div className="flex border-b border-black py-1 px-3">
          <span className="font-semibold mr-2 shrink-0">Nombre del instructor (a):</span>
          <span className="font-medium">{curso.instructor || 'No asignado'}</span>
        </div>

        {/* Row 5: Periodo con fecha real, Duración, Horario */}
        <div className="flex flex-wrap text-[9.5px]">
          <div className="flex-1 py-1 px-3 border-r border-black flex items-center gap-1 min-w-[200px]">
            <span className="font-semibold">Periodo:</span>
            <span className="font-medium">{curso.periodo || curso.semana || 'Del 12 al 16 de enero de 2026'}</span>
          </div>
          <div className="w-36 py-1 px-3 border-r border-black flex items-center gap-1">
            <span className="font-semibold">Duración:</span>
            <span>{curso.duracion || (curso.horas ? `${curso.horas} hrs` : '30 hrs')}</span>
          </div>
          <div className="w-44 py-1 px-3 flex items-center gap-1">
            <span className="font-semibold">Horario:</span>
            <span>{curso.horario || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* 3. Table with Exact 12 Columns */}
      <table className="w-full border-collapse border border-black text-[9px] mb-2">
        <thead>
          <tr className="bg-gray-100 print:bg-transparent">
            <th rowSpan={2} className="border border-black px-1 py-1 text-center w-7">No.</th>
            <th rowSpan={2} className="border border-black px-2 py-1 text-left">Nombre del Participante</th>
            <th rowSpan={2} className="border border-black px-1.5 py-1 text-left w-24">R.F.C. / CURP</th>
            <th rowSpan={2} className="border border-black px-2 py-1 text-left">Puesto y departamento de adscripción</th>
            <th rowSpan={2} className="border border-black px-1 py-1 text-center w-16">Nivel de Puesto</th>
            <th colSpan={7} className="border border-black px-1 py-0.5 text-center">Asistencia</th>
          </tr>
          <tr className="bg-gray-50 print:bg-transparent text-[8.5px]">
            <th className="border border-black px-1 py-0.5 text-center w-6" title="Funcionario Docente">FD</th>
            <th className="border border-black px-1 py-0.5 text-center w-6" title="Docente">D</th>
            <th className="border border-black px-1 py-0.5 text-center w-5">L</th>
            <th className="border border-black px-1 py-0.5 text-center w-5">M</th>
            <th className="border border-black px-1 py-0.5 text-center w-5">M</th>
            <th className="border border-black px-1 py-0.5 text-center w-5">J</th>
            <th className="border border-black px-1 py-0.5 text-center w-5">V</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, idx) => {
            if (!p) {
              return (
                <tr key={`empty-${idx}`} className="h-5">
                  <td className="border border-black text-center text-gray-400">{idx + 1}</td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black text-center"></td>
                  <td className="border border-black text-center"></td>
                  <td className="border border-black text-center"></td>
                  <td className="border border-black text-center"></td>
                  <td className="border border-black text-center"></td>
                  <td className="border border-black text-center"></td>
                  <td className="border border-black text-center"></td>
                </tr>
              );
            }

            const isFD = p.es_fd || p.nivel?.toLowerCase().includes('funcionario') || p.puesto?.toLowerCase().includes('jef') || p.puesto?.toLowerCase().includes('coord');
            const isD = p.es_d || (!isFD && true);

            return (
              <tr key={p.id || idx} className="h-5 hover:bg-amber-50/50 print:hover:bg-transparent">
                <td className="border border-black text-center font-medium">{idx + 1}</td>
                <td className="border border-black px-2 py-0.5 font-medium">{p.nombre_completo}</td>
                <td className="border border-black px-1.5 py-0.5 font-mono text-[8px] font-semibold">{p.rfc || p.curp}</td>
                <td className="border border-black px-2 py-0.5 text-[8.5px]">
                  {p.puesto ? `${p.puesto} - ` : ''}{p.departamento}
                </td>
                <td className="border border-black px-1 py-0.5 text-center text-[8px]">{p.nivel || (isFD ? 'Funcionario' : 'Docente')}</td>

                {/* FD Selection */}
                <td
                  onClick={() => interactivo && onToggleTipoDocente?.(p.id, 'FD')}
                  className={`border border-black text-center font-bold ${interactivo ? 'cursor-pointer hover:bg-blue-100' : ''}`}
                >
                  {isFD ? 'X' : ''}
                </td>

                {/* D Selection */}
                <td
                  onClick={() => interactivo && onToggleTipoDocente?.(p.id, 'D')}
                  className={`border border-black text-center font-bold ${interactivo ? 'cursor-pointer hover:bg-blue-100' : ''}`}
                >
                  {!isFD && isD ? 'X' : ''}
                </td>

                {/* Days: L, M, M, J, V */}
                {['L', 'M', 'M2', 'J', 'V'].map((diaKey, dIdx) => {
                  const asistio = p.asistencias?.[diaKey];
                  return (
                    <td
                      key={dIdx}
                      onClick={() => interactivo && onToggleAsistencia?.(p.id, diaKey)}
                      className={`border border-black text-center font-bold ${interactivo ? 'cursor-pointer hover:bg-blue-100' : ''}`}
                    >
                      {asistio ? '•' : ''}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 4. Legend */}
      <div className="text-[8.5px] font-medium text-gray-700 mb-6 print:mb-8">
        <span>FD = Funcionario docente</span>
        <span className="ml-8">D = Docente</span>
      </div>

      {/* 5. Signatures Block */}
      <div className="grid grid-cols-2 gap-12 text-[9.5px] pt-4 mb-6">
        {/* Left Signature: Instructor */}
        <div className="text-center">
          <div className="border-t border-black w-4/5 mx-auto mb-1"></div>
          <p className="font-bold">Nombre y firma del instructor (a)</p>
          <p className="font-medium text-gray-800 text-[9px] mt-0.5">{curso.instructor || ''}</p>
          <div className="text-left text-[8.5px] text-gray-700 mt-2 space-y-0.5 pl-4">
            <p>R.F.C.: <span className="font-mono">{instructorRfc || curso.instructor_rfc || '_________________________'}</span></p>
            {(instructorCurp || curso.instructor_curp || (curso.folio && curso.folio.includes('2026')) || (curso.fecha_inicio && curso.fecha_inicio.includes('2026'))) && (
              <p>CURP: <span className="font-mono">{instructorCurp || curso.instructor_curp || '_________________________'}</span></p>
            )}
          </div>
        </div>

        {/* Right Signature: Coordinador */}
        <div className="text-center">
          <div className="border-t border-black w-4/5 mx-auto mb-1"></div>
          <p className="font-bold">Nombre y firma del coordinador (a)</p>
          <p className="font-bold text-gray-900 text-[10px] mt-0.5">{coordinadorNombre || 'Alejandro Calderón Rentería'}</p>
          <p className="font-medium text-gray-800 text-[9px] mt-0.5">{config.coordinadorPuesto || 'Coordinador de Actualización Docente'}</p>
        </div>
      </div>

      {/* 6. Footer Code */}
      <div className="flex justify-between items-center text-[8.5px] font-semibold text-gray-700 border-t border-gray-200 pt-2 print:border-none">
        <span>{config.codigo}</span>
        <span>Revisión: {config.revision}</span>
      </div>
    </div>
  );
};
