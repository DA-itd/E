import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AdminFormatos() {
  const [archivos, setArchivos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    cargarArchivos();
  }, []);

  async function cargarArchivos() {
    setCargando(true);
    // Usamos el mismo bucket de documentos, pero en una carpeta separada
    const { data, error } = await supabase.storage.from('documentos_preregistro').list('formatos_plantillas');
    if (data) {
      // Filtramos archivos ocultos del sistema
      setArchivos(data.filter(a => a.name !== '.emptyFolderPlaceholder' && a.name !== '.emptyFolder'));
    }
    setCargando(false);
  }

  async function subirArchivo(e) {
    const file = e.target.files[0];
    if (!file) return;

    setSubiendo(true);
    // Subir archivo (upsert: true permite sobreescribir si ya existe uno con el mismo nombre)
    const { error } = await supabase.storage.from('documentos_preregistro').upload(`formatos_plantillas/${file.name}`, file, {
      upsert: true 
    });

    if (error) {
      alert('Error al subir el formato: ' + error.message);
    } else {
      alert('✅ Formato subido y publicado correctamente.');
      cargarArchivos();
    }
    setSubiendo(false);
    e.target.value = ''; // Limpiar el input
  }

  async function eliminarArchivo(nombre) {
    if (!confirm(`¿Estás seguro de eliminar el formato "${nombre}"? Ya no aparecerá para que los docentes lo descarguen.`)) return;

    const { error } = await supabase.storage.from('documentos_preregistro').remove([`formatos_plantillas/${nombre}`]);
    if (error) {
      alert('Error al eliminar: ' + error.message);
    } else {
      cargarArchivos();
    }
  }

  async function descargarArchivo(nombre) {
    const { data, error } = await supabase.storage.from('documentos_preregistro').download(`formatos_plantillas/${nombre}`);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">Formatos Descargables</h2>
      <p className="text-sm text-itd-navyDark/60 mb-6">
        Sube aquí los documentos (.DOC, .DOCX, .PDF) que los docentes necesitan descargar para su preregistro. Si subes un archivo con el mismo nombre, se actualizará automáticamente.
      </p>

      {/* Zona para subir archivos */}
      <div className="mb-8 p-6 bg-itd-sand/20 rounded-xl border border-itd-navy/10 border-dashed text-center">
        <label className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 bg-itd-navy text-white rounded-lg font-semibold hover:bg-itd-navyDark transition-colors shadow-sm">
          {subiendo ? 'Subiendo archivo...' : '📁 Subir nuevo formato'}
          <input 
            type="file" 
            className="hidden" 
            onChange={subirArchivo} 
            disabled={subiendo}
            accept=".doc,.docx,.pdf,.xls,.xlsx"
          />
        </label>
        <p className="text-xs text-gray-500 mt-3">Archivos permitidos: Word, Excel, PDF.</p>
      </div>

      {/* Lista de archivos disponibles */}
      <h3 className="font-semibold text-itd-navyDark mb-3">Formatos publicados actualmente:</h3>
      
      {cargando ? (
        <p className="text-sm text-gray-500">Cargando formatos...</p>
      ) : archivos.length === 0 ? (
        <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg border">No hay ningún formato subido en este momento.</p>
      ) : (
        <div className="space-y-2">
          {archivos.map((archivo) => (
            <div key={archivo.name} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📄</span>
                <div>
                  <p className="font-medium text-sm text-itd-navyDark">{archivo.name}</p>
                  <p className="text-xs text-gray-400">Tamaño: {(archivo.metadata.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => descargarArchivo(archivo.name)}
                  className="text-xs font-medium text-itd-navy bg-itd-sand/50 px-3 py-1.5 rounded-lg hover:bg-itd-sand border border-itd-navy/10"
                >
                  ⬇️ Descargar
                </button>
                <button 
                  onClick={() => eliminarArchivo(archivo.name)}
                  className="text-xs font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 border border-red-200"
                >
                  🗑️ Borrar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}