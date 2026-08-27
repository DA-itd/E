import React, { useState } from 'react';
import { FormatoConfig } from '../types';
import { getLocalFormatoConfig, saveLocalFormatoConfig } from '../lib/supabaseClient';

interface Props {
  onClose: () => void;
  onConfigGuardada: () => void;
}

export default function ConfiguracionModal({ onClose, onConfigGuardada }: Props) {
  const [config, setConfig] = useState<FormatoConfig>(getLocalFormatoConfig());
  const [guardado, setGuardado] = useState(false);

  function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    saveLocalFormatoConfig(config);
    setGuardado(true);
    setTimeout(() => {
      onConfigGuardada();
      onClose();
    }, 1000);
  }

  function handleRestaurarDatos() {
    if (confirm('¿Restaurar la configuración predeterminada del ITD?')) {
      const configDefault: FormatoConfig = {
        institucion: 'INSTITUTO TECNOLÓGICO DE DURANGO',
        nombreDocumento: 'LISTA DE ASISTENCIA',
        referenciaNorma: 'NMX-CC-9001-IMNC-2008 6.2.2',
        codigo: 'ITD-AD-FO-8',
        revision: '1',
        pagina: '1 de 1',
        fechaEmision: 'ENERO 2026',
        tipoCurso: 'CURSO PRESENCIAL',
        coordinadorNombre: 'Alejandro Calderón Rentería',
        coordinadorPuesto: 'Coordinador de Actualización Docente',
        departamentoEmisor: 'COORDINACIÓN DE ACTUALIZACIÓN DOCENTE',
      };
      saveLocalFormatoConfig(configDefault);
      setConfig(configDefault);
      onConfigGuardada();
      alert('Configuración restaurada correctamente.');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚙️</span>
            <h3 className="font-bold text-base text-slate-900">Configuración del Sistema y Formato ITD</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold p-1">
            ✕
          </button>
        </div>

        <form onSubmit={handleGuardar} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nombre Institución</label>
            <input
              type="text"
              value={config.institucion}
              onChange={e => setConfig({ ...config, institucion: e.target.value })}
              className="w-full rounded-xl border border-slate-300 p-2.5 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Código del Documento</label>
              <input
                type="text"
                value={config.codigo}
                onChange={e => setConfig({ ...config, codigo: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-2.5 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Revisión</label>
              <input
                type="text"
                value={config.revision}
                onChange={e => setConfig({ ...config, revision: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-2.5"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nombre del Coordinador (a) en Firmas</label>
            <input
              type="text"
              value={config.coordinadorNombre}
              onChange={e => setConfig({ ...config, coordinadorNombre: e.target.value })}
              className="w-full rounded-xl border border-slate-300 p-2.5"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Cargo / Puesto Coordinador</label>
            <input
              type="text"
              value={config.coordinadorPuesto}
              onChange={e => setConfig({ ...config, coordinadorPuesto: e.target.value })}
              className="w-full rounded-xl border border-slate-300 p-2.5"
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <span>🗄️</span>
                Datos de Muestra y Cursos Iniciales
              </span>
              <button
                type="button"
                onClick={handleRestaurarDatos}
                className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg"
              >
                <span>↺</span>
                Restaurar
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Restaura la configuración predeterminada institucional de firmas y encabezados del Instituto Tecnológico de Durango.
            </p>
          </div>

          {guardado && (
            <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg flex items-center gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>Configuración guardada exitosamente.</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
            >
              Cerrar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#1B396A] text-white font-semibold hover:bg-[#102244]"
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
