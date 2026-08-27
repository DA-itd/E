import React from 'react';

export default function GuiaFormato() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Intro */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#1B396A]/10 rounded-xl text-[#1B396A] text-2xl">
            📋
          </div>
          <div>
            <span className="text-xs font-mono font-semibold text-[#1B396A] bg-[#1B396A]/10 px-2 py-0.5 rounded">
              Código Oficial: ITD-AD-FO-8 · Revisión: 1
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Guía del Formato Oficial de Lista de Asistencia (ITD)
            </h2>
            <p className="text-xs text-slate-600">
              Norma de Referencia: <strong>NMX-CC-9001-IMNC-2008 6.2.2</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Grid of specifications */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* PDF Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#9D2449]/10 text-[#9D2449] flex items-center justify-center text-lg">
            📄
          </div>
          <h3 className="font-bold text-sm text-slate-900">Formato PDF</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Genera un documento PDF tamaño Carta (Letter) con la distribución oficial preestablecida: membrete institucional, caja ISO, tabla de 12 columnas con renglones de relleno y bloque de firmas para instructor y coordinador.
          </p>
        </div>

        {/* Excel Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-lg">
            📊
          </div>
          <h3 className="font-bold text-sm text-slate-900">Formato Excel (.xlsx)</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Exporta una hoja de cálculo estructurada con celdas combinadas, anchos de columna definidos, fórmulas, códigos y formato de texto listo para ser editado o archivado en el sistema de gestión.
          </p>
        </div>

        {/* Print Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#1B396A]/10 text-[#1B396A] flex items-center justify-center text-lg">
            🖨️
          </div>
          <h3 className="font-bold text-sm text-slate-900">Impresión Directa</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Permite imprimir directamente a la impresora o guardar como PDF nativo del navegador con hojas limpias, sin encabezados de URL ni botones del sistema gracias al diseño CSS <code>@media print</code>.
          </p>
        </div>
      </div>

      {/* Nomenclature Guide */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
          <span>ℹ️</span>
          Nomenclatura y Columnas del Formato ITD-AD-FO-8
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1.5">
            <p className="font-bold text-slate-800">FD (Funcionario Docente)</p>
            <p className="text-slate-600">
              Personal con plaza docente que desempeña un puesto directivo, jefatura de departamento, coordinación o proyecto de docencia. Se marca con una <strong>X</strong>.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1.5">
            <p className="font-bold text-slate-800">D (Docente)</p>
            <p className="text-slate-600">
              Profesor de carrera o asignatura frente a grupo sin cargo de funcionario docente. Se marca con una <strong>X</strong>.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1.5">
            <p className="font-bold text-slate-800">L, M, M, J, V (Asistencia Diaria)</p>
            <p className="text-slate-600">
              Corresponden a los 5 días de la semana de impartición del curso (Lunes, Martes, Miércoles, Jueves y Viernes).
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1.5">
            <p className="font-bold text-slate-800">Firmas y Validación</p>
            <p className="text-slate-600">
              El formato requiere la firma del <strong>Instructor (a)</strong> junto con su RFC y CURP, y la firma del <strong>Coordinador (a)</strong> de Desarrollo Académico / Actualización Docente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
