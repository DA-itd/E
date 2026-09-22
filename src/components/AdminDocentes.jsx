import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const DEPARTAMENTOS = [
  'DEPARTAMENTO DE CIENCIAS BÁSICAS',
  'DEPARTAMENTO DE CIENCIAS ECONÓMICO ADMINISTRATIVAS',
  'DEPARTAMENTO DE INGENIERÍAS ELÉCTRICA - ELECTRÓNICA',
  'DEPARTAMENTO DE INGENIERÍA INDUSTRIAL',
  'DEPARTAMENTO DE METAL-MECÁNICA',
  'DEPARTAMENTO DE INGENIERÍAS QUÍMICA-BIOQUÍMICA',
  'DEPARTAMENTO DE SISTEMAS Y COMPUTACION',
  'DEPARTAMENTO DE CIENCIAS DE LA TIERRA',
  'DIVISION DE ESTUDIOS DE POSGRADO E INVESTIGACION',
  'DEPARTAMENTO DE DESARROLLO ACADÉMICO',
  'OTRO'
];

export default function AdminDocentes() {
  const [docentes, setDocentes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  
  // Estado para edición
  const [docenteEditando, setDocenteEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargarDocentes();
  }, []);

  async function cargarDocentes() {
    setCargando(true);
    const { data, error } = await supabase
      .from('docentes')
      .select('*')
      .order('nombre_completo', { ascending: true });
      
    if (!error && data) {
      setDocentes(data);
    }
    setCargando(false);
  }

  // Filtrar la lista según lo que se escriba en el buscador
  const docentesFiltrados = docentes.filter(d => 
    (d.nombre_completo || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (d.curp || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (d.email || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  async function guardarCambios(e) {
    e.preventDefault();
    setGuardando(true);

    const { error } = await supabase
      .from('docentes')
      .update({
        nombre_completo: docenteEditando.nombre_completo.toUpperCase(),
        curp: docenteEditando.curp.toUpperCase(),
        email: docenteEditando.email.toLowerCase(),
        departamento: docenteEditando.departamento,
        genero: docenteEditando.genero,
        telefono: docenteEditando.telefono,
        nivel: docenteEditando.nivel
      })
      .eq('id', docenteEditando.id);

    if (error) {
      alert('Error al guardar: ' + error.message);
    } else {
      alert('✅ Datos del docente actualizados correctamente.');
      setDocenteEditando(null);
      cargarDocentes(); // Recargar la lista
    }
    setGuardando(false);
  }

  async function eliminarDocente(id, nombre) {
    if (!confirm(`🚨 ATENCIÓN: ¿Estás completamente seguro de ELIMINAR a ${nombre}? Esta acción borrará su perfil, pero si el docente vuelve a iniciar sesión, se creará uno nuevo vacío.`)) return;
    
    const palabra = prompt(`Escribe BORRAR para confirmar la eliminación de ${nombre}:`);
    if (palabra !== 'BORRAR') {
      alert('Operación cancelada.');
      return;
    }

    const { error } = await supabase.from('docentes').delete().eq('id', id);
    
    if (error) {
      alert('Error al eliminar: ' + error.message);
    } else {
      alert('Docente eliminado correctamente.');
      cargarDocentes();
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">Gestión de Docentes (Base de Datos)</h2>
      <p className="text-sm text-itd-navyDark/60 mb-6">
        Busca, corrige nombres, CURP o departamentos, y da de baja a personal de la plataforma.
      </p>

      {/* Buscador */}
      <div className="mb-6">
        <input 
          type="text"
          placeholder="🔍 Buscar por nombre, CURP o correo electrónico..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border border-itd-navy/20 focus:border-itd-navy outline-none shadow-sm"
        />
      </div>

      {/* Modal / Formulario de Edición */}
      {docenteEditando && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-itd-navy text-white rounded-t-xl">
              <h3 className="font-semibold">Editar Datos del Docente</h3>
              <button onClick={() => setDocenteEditando(null)} className="text-white/70 hover:text-white font-bold text-xl">✕</button>
            </div>
            
            <form onSubmit={guardarCambios} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nombre Completo</label>
                <input required value={docenteEditando.nombre_completo} onChange={e => setDocenteEditando({...docenteEditando, nombre_completo: e.target.value})} className="w-full border rounded-lg px-3 py-2 uppercase" />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">CURP</label>
                <input required value={docenteEditando.curp} onChange={e => setDocenteEditando({...docenteEditando, curp: e.target.value})} className="w-full border rounded-lg px-3 py-2 uppercase" maxLength={18} />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Correo Electrónico</label>
                <input required type="email" value={docenteEditando.email} onChange={e => setDocenteEditando({...docenteEditando, email: e.target.value})} className="w-full border rounded-lg px-3 py-2 lowercase" />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Departamento</label>
                <select required value={docenteEditando.departamento || ''} onChange={e => setDocenteEditando({...docenteEditando, departamento: e.target.value})} className="w-full border rounded-lg px-3 py-2">
                  <option value="">Seleccione un departamento...</option>
                  {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Género</label>
                <select required value={docenteEditando.genero || ''} onChange={e => setDocenteEditando({...docenteEditando, genero: e.target.value})} className="w-full border rounded-lg px-3 py-2">
                  <option value="Hombre">Hombre</option>
                  <option value="Mujer">Mujer</option>
                  <option value="Prefiero no decirlo">Prefiero no decirlo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Teléfono</label>
                <input value={docenteEditando.telefono || ''} onChange={e => setDocenteEditando({...docenteEditando, telefono: e.target.value})} className="w-full border rounded-lg px-3 py-2" />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nivel Académico</label>
                <select required value={docenteEditando.nivel || ''} onChange={e => setDocenteEditando({...docenteEditando, nivel: e.target.value})} className="w-full border rounded-lg px-3 py-2">
                  <option value="">Seleccione...</option>
                  <option value="L">L - Licenciatura</option>
                  <option value="P">P - Posgrado (Maestría/Doctorado)</option>
                </select>
              </div>

              <div className="sm:col-span-2 mt-4 flex gap-3 justify-end border-t pt-4">
                <button type="button" onClick={() => setDocenteEditando(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} className="px-6 py-2 bg-itd-navy text-white rounded-lg font-medium hover:bg-itd-navyDark transition-colors disabled:opacity-50">
                  {guardando ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista de Docentes */}
      {cargando ? (
        <p className="text-center py-10 text-gray-400">Cargando base de datos...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-itd-navy/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-itd-sand/30 text-itd-navyDark font-semibold">
              <tr>
                <th className="px-4 py-3">Nombre / Correo</th>
                <th className="px-4 py-3">CURP</th>
                <th className="px-4 py-3">Departamento</th>
                <th className="px-4 py-3">Nivel</th> 
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docentesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                    No se encontraron docentes con esa búsqueda.
                  </td>
                </tr>
              ) : (
                docentesFiltrados.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-itd-navyDark">{d.nombre_completo || 'Sin nombre'}</p>
                      <p className="text-xs text-gray-500">{d.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{d.curp || 'N/A'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{d.departamento || 'N/A'}</td>
                    
                    <td className="px-4 py-3 text-gray-600 text-xs font-medium">
                      {d.nivel === 'P' ? 'Posgrado (P)' : d.nivel === 'L' ? 'Licenciatura (L)' : 'N/A'}
                    </td>

                    <td className="px-4 py-3 text-right space-x-2">
                      <button 
                        onClick={() => setDocenteEditando(d)}
                        className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                      >
                        ✏️ Editar
                      </button>
                      <button 
                        onClick={() => eliminarDocente(d.id, d.nombre_completo)}
                        className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors font-medium"
                      >
                        🗑️ Borrar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}