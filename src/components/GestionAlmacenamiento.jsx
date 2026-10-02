// src/components/GestionAlmacenamiento.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function GestionAlmacenamiento() {
  const [archivosPorCurso, setArchivosPorCurso] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [espacioTotalBytes, setEspacioTotalBytes] = useState(0);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    escanearStorage();
  }, []);

  async function escanearStorage() {
    setCargando(true);
    setMensaje('');
    try {
      // 1. Obtener los cursos registrados para cruzar ID con nombres reales
      const { data: cursos } = await supabase
        .from('preregistro_cursos')
        .select('id, curso, estado, docentes(nombre_completo)');

      const mapaCursos = {};
      (cursos || []).forEach(c => { mapaCursos[c.id] = c; });

      // 2. Listar carpetas en el bucket documentos_preregistro
      const { data: itemsRaiz, error: errorRaiz } = await supabase.storage
        .from('documentos_preregistro')
        .list('', { limit: 100 });

      if (errorRaiz) throw errorRaiz;

      let totalBytes = 0;
      const carpetasAnalizadas = [];

      for (const item of (itemsRaiz || [])) {
        // Excluimos la carpeta de plantillas y placeholders
        if (item.name === 'formatos_plantillas' || item.name.startsWith('.')) continue;

        // Cada subcarpeta corresponde al ID de un registro
        const registroId = item.name;
        const { data: archivosInternos } = await supabase.storage
          .from('documentos_preregistro')
          .list(registroId);

        if (archivosInternos && archivosInternos.length > 0) {
          const archivosFiltrados = archivosInternos.filter(a => !a.name.startsWith('.'));
          const pesoCarpeta = archivosFiltrados.reduce((acc, curr) => acc + (curr.metadata?.size || 0), 0);
          totalBytes += pesoCarpeta;

          carpetasAnalizadas.push({
            registroId,
            curso: mapaCursos[registroId]?.curso || `Curso ID: ${registroId}`,
            docente: mapaCursos[registroId]?.docentes?.nombre_completo || 'No asignado',
            estado: mapaCursos[registroId]?.estado || 'desconocido',
            archivos: archivosFiltrados,
            pesoBytes: pesoCarpeta,
          });
        }
      }

      setEspacioTotalBytes(totalBytes);
      setArchivosPorCurso(carpetasAnalizadas);
    } catch (err) {
      console.error('Error al escanear storage:', err);
      setMensaje('Error al obtener archivos: ' + err.message);
    } finally {
      setCargando(false);
    }
  }

  // Descargar un archivo individual directamente
  async function descargarArchivo(registroId, nombreArchivo, nombreSugerido) {
    const { data, error } = await supabase.storage
      .from('documentos_preregistro')
      .download(`${registroId}/${nombreArchivo}`);

    if (error) {
      alert('Error al descargar: ' + error.message);
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreSugerido || nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Descargar ambos archivos de un curso
  async function descargarExpedienteCompleto(item) {
    for (const arch of item.archivos) {
      const extension = arch.name.endsWith('.pdf') ? '.pdf' : '';
      const tipo = arch.name.includes('cvu') ? 'CVU' : 'FICHA';
      const nombreLimpio = `${item.curso.substring(0, 30)}_${tipo}_${item.docente}${extension}`.replace(/[/\\?%*:|"<>]/g, '-');
      await descargarArchivo(item.registroId, arch.name, nombreLimpio);
    }
  }

  // Borrar archivos de Storage para liberar espacio (sin borrar el registro del curso)
  async function liberarEspacioCurso(registroId, nombreCurso) {
    if (!confirm(`¿Eliminar los PDFs de "${nombreCurso}" de Supabase Storage para liberar espacio?\n\nASEGÚRATE de haberlos descargado primero a tu computadora.`)) {
      return;
    }

    try {
      const rutasABorrar = [
        `${registroId}/1_cvu_instructor.pdf`,
        `${registroId}/2_ficha_tecnica.pdf`
      ];

      const { error } = await supabase.storage
        .from('documentos_preregistro')
        .remove(rutasABorrar);

      if (error) throw error;

      alert('¡Espacio liberado con éxito!');
      escanearStorage();
    } catch (err) {
      alert('Error al liberar espacio: ' + err.message);
    }
  }

  const espacioMB = (espacioTotalBytes / (1024 * 1024)).toFixed(2);
  const porcentajeUso = Math.min(100, ((espacioTotalBytes / (50 * 1024 * 1024)) * 100)).toFixed(1);

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
        <div>
          <h2 className="font-display text-xl font-semibold text-itd-navy">
            Almacenamiento de Documentos (Límite 50 MB)
          </h2>
          <p className="text-sm text-itd-navyDark/60 mt-1">
            Descarga los expedientes de los cursos a tu equipo y libera espacio antes de que comience el siguiente periodo.
          </p>
        </div>
        <button
          onClick={escanearStorage}
          disabled={cargando}
          className="shrink-0 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
        >
          🔄 Actualizar almacenamiento
        </button>
      </div>

      {/* BARRA DE CONSUMO DE LOS 50 MB */}
      <div className="my-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex justify-between items-center text-xs font-bold mb-2">
          <span>Uso actual de Storage: {espacioMB} MB / 50.00 MB</span>
          <span className={porcentajeUso > 80 ? 'text-red-600' : 'text-slate-600'}>
            {porcentajeUso}% utilizado
          </span>
        </div>
        <div className="w-full h-3.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              porcentajeUso > 80 ? 'bg-red-500' : porcentajeUso > 50 ? 'bg-amber-500' : 'bg-green-600'
            }`}
            style={{ width: `${porcentajeUso}%` }}
          />
        </div>
      </div>

      {mensaje && <p className="text-xs text-red-600 mb-4">{mensaje}</p>}

      {cargando ? (
        <p className="text-center text-gray-500 py-8 text-sm">Escaneando archivos en Supabase...</p>
      ) : archivosPorCurso.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          🎉 El bucket está limpio. No hay archivos pesados acumulados en Storage.
        </div>
      ) : (
        <div className="space-y-3">
          {archivosPorCurso.map(item => (
            <div key={item.registroId} className="p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-gray-300 transition">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-itd-navy">{item.curso}</h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    item.estado === 'aprobado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {item.estado.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Profesor: <strong>{item.docente}</strong> · Peso en disco: <strong>{(item.pesoBytes / 1024).toFixed(0)} KB</strong>
                </p>
                <div className="flex gap-2 mt-2">
                  {item.archivos.map(a => (
                    <button
                      key={a.name}
                      onClick={() => descargarArchivo(item.registroId, a.name, `${item.curso}_${a.name}`)}
                      className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded hover:bg-blue-100 transition"
                    >
                      📥 {a.name.includes('cvu') ? 'Descargar CVU' : 'Descargar Ficha'}
                    </button>
                  ))}
                </div>
              </div>

              {/* ACCIONES DEL COORDINADOR */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => descargarExpedienteCompleto(item)}
                  className="px-3 py-1.5 bg-itd-navy text-white text-xs font-semibold rounded-lg hover:bg-itd-navyDark transition"
                >
                  📦 Descargar Ambos
                </button>
                <button
                  onClick={() => liberarEspacioCurso(item.registroId, item.curso)}
                  className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg hover:bg-rose-100 transition"
                  title="Elimina solo los archivos del Storage para liberar espacio"
                >
                  🗑️ Liberar espacio
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}