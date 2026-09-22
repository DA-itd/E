import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function GestionInscritosCurso({ cursoId }) {
  const [inscritos, setInscritos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    cargarInscritos();
  }, [cursoId]);

  async function cargarInscritos() {
    setCargando(true);
    const { data, error } = await supabase
      .from('inscripciones')
      .select('id, estado, docente_id, docentes(id, nombre_completo, email, telefono, rfc)')
      .eq('curso_id', cursoId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setInscritos(data);
    }
    setCargando(false);
  }

  async function eliminarInscripcion(id, nombre) {
    if (!confirm(`¿Eliminar la inscripción de ${nombre} a este curso? Esta acción es irreversible.`)) return;
    setErrorMsg('');
    const { error } = await supabase.from('inscripciones').delete().eq('id', id);
    if (error) {
      setErrorMsg('Error al eliminar: ' + error.message);
    } else {
      setInscritos(prev => prev.filter(ins => ins.id !== id));
    }
  }

  if (cargando) return <p className="text-xs text-gray-500 mt-2 p-2">Cargando inscritos...</p>;

  return (
    <div className="mt-3 bg-gray-50 rounded-lg p-4 border border-gray-100">
      <h4 className="font-semibold text-sm text-itd-navyDark mb-3">Docentes Inscritos ({inscritos.length})</h4>
      {errorMsg && <p className="text-xs text-red-600 bg-red-50 p-2 rounded mb-3">{errorMsg}</p>}
      
      {inscritos.length === 0 ? (
        <p className="text-xs text-gray-500">No hay docentes inscritos en este curso.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100 text-gray-600 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-3 py-2">Docente</th>
                <th className="px-3 py-2">RFC</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {inscritos.map(ins => (
                <tr key={ins.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {ins.docentes?.nombre_completo || <span className="text-red-500 italic">Usuario Eliminado (ID: {ins.docente_id})</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{ins.docentes?.rfc || '-'}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                      ins.estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {ins.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button 
                      onClick={() => eliminarInscripcion(ins.id, ins.docentes?.nombre_completo || 'Usuario Eliminado')}
                      className="text-itd-guinda hover:bg-itd-guinda/10 px-2 py-1 rounded transition-colors"
                      title="Eliminar inscripción"
                    >
                      Dar de baja
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
