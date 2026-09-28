// src/components/AdminRespaldo.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { descargarOficioRegistro } from '../lib/oficio';
import { descargarCriteriosInstructor } from '../lib/criteriosInstructor';

export default function AdminRespaldo() {
  const [cargando, setCargando] = useState(false);
  const [estadoRespaldo, setEstadoRespaldo] = useState('');
  const [archivosEncontrados, setArchivosEncontrados] = useState(null);

  useEffect(() => {
    calcularArchivos();
  }, []);

  async function calcularArchivos() {
    setCargando(true);
    try {
      const { data: carpetas, error: errCarpetas } = await supabase.storage.from('documentos_preregistro').list('');
      if (errCarpetas || !carpetas) {
        setArchivosEncontrados(0);
        setCargando(false);
        return;
      }
      const idsReales = carpetas.filter(c => c.id == null || !c.name.includes('.')).map(c => c.name);
      
      let contadorArchivos = 0;
      for (const id of idsReales) {
        const { data: archivos } = await supabase.storage.from('documentos_preregistro').list(id);
        if (archivos) {
           contadorArchivos += archivos.filter(a => a.name !== '.emptyFolderPlaceholder').length;
        }
      }
      setArchivosEncontrados(contadorArchivos);
    } catch (e) {
      console.error(e);
      setArchivosEncontrados(0);
    }
    setCargando(false);
  }

  async function generarZip() {
    if (!confirm('¿Deseas generar y descargar el respaldo ZIP ahora? Esto puede tardar unos minutos dependiendo de tu conexión.')) return;
    
    setCargando(true);
    setEstadoRespaldo('Obteniendo información de los cursos y la convocatoria activa...');
    
    try {
      const zip = new JSZip();
      
      // 1. Obtener la convocatoria activa para los oficios
      const { data: convActiva } = await supabase
        .from('convocatorias')
        .select('*')
        .eq('activo', true)
        .order('fecha_inicio', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      // 2. Obtener la información de TODOS los preregistros
      const { data: preregistros } = await supabase
        .from('preregistro_cursos')
        .select('*, docentes(nombre_completo, email, departamento)');
      
      const mapaCursos = {};
      (preregistros || []).forEach(p => {
        const nombreLimpio = p.curso.replace(/[^a-zA-Z0-9 áéíóúÁÉÍÓÚñÑ-]/g, "").trim();
        mapaCursos[p.id] = {
          nombreLimpio: nombreLimpio || `Curso_${p.id.substring(0, 5)}`,
          datosPreregistro: p
        };
      });

      // 3. Obtener todas las evaluaciones (criterios)
      const { data: evaluacionesData } = await supabase.from('evaluaciones_instructores').select('*');
      const mapaEvaluaciones = {};
      (evaluacionesData || []).forEach(ev => { mapaEvaluaciones[ev.preregistro_id] = ev; });

      setEstadoRespaldo('Buscando archivos físicos en el servidor...');
      const { data: carpetas } = await supabase.storage.from('documentos_preregistro').list('');
      const idsReales = (carpetas || []).filter(c => c.id == null || !c.name.includes('.')).map(c => c.name);

      let descargados = 0;
      const carpetaPrincipal = zip.folder('Documentos_Cursos_ITD');

      // 4. Procesar cada carpeta (curso) que tiene archivos físicos
      for (const id of idsReales) {
        const infoCurso = mapaCursos[id];
        if (!infoCurso) continue; // Si por alguna razón la carpeta no tiene registro de DB

        const nombreCurso = infoCurso.nombreLimpio;
        const preregistroInfo = infoCurso.datosPreregistro;
        const evaluacionInfo = mapaEvaluaciones[id];

        // A) DESCARGAR ARCHIVOS FÍSICOS (CVU Y Ficha Técnica)
        const { data: archivos } = await supabase.storage.from('documentos_preregistro').list(id);
        if (archivos && archivos.length > 0) {
          for (const archivo of archivos) {
            if (archivo.name === '.emptyFolderPlaceholder') continue;
            setEstadoRespaldo(`Descargando físicos de: ${nombreCurso}...`);
            const { data: blob } = await supabase.storage.from('documentos_preregistro').download(`${id}/${archivo.name}`);
            
            if (blob) {
              let nombreArchivoFinal = `${nombreCurso} - Documento_Extra.pdf`;
              if (archivo.name.includes('cvu')) {
                nombreArchivoFinal = `${nombreCurso} - CVU.pdf`;
              } else if (archivo.name.includes('ficha')) {
                nombreArchivoFinal = `${nombreCurso} - Ficha_Tecnica.pdf`;
              }
              carpetaPrincipal.file(nombreArchivoFinal, blob);
              descargados++;
            }
          }
        }

        // B) GENERAR EL OFICIO "AL VUELO"
        setEstadoRespaldo(`Generando Oficio de: ${nombreCurso}...`);
        try {
          if (convActiva) {
            // Le pasamos retornarBytes: true para que no trate de forzar la descarga en el navegador
            const bytesOficio = await descargarOficioRegistro({ ...preregistroInfo, retornarBytes: true }, convActiva);
            if (bytesOficio) {
              carpetaPrincipal.file(`${nombreCurso} - Oficio_Registro.pdf`, bytesOficio);
              descargados++;
            }
          }
        } catch (err) {
          console.error(`Fallo al generar oficio de ${nombreCurso}`, err);
        }

        // C) GENERAR LOS CRITERIOS "AL VUELO"
        if (evaluacionInfo) {
          setEstadoRespaldo(`Generando Criterios de: ${nombreCurso}...`);
          try {
            const bytesCriterios = await descargarCriteriosInstructor({ ...evaluacionInfo, retornarBytes: true });
            if (bytesCriterios) {
              carpetaPrincipal.file(`${nombreCurso} - Criterios.pdf`, bytesCriterios);
              descargados++;
            }
          } catch (err) {
            console.error(`Fallo al generar criterios de ${nombreCurso}`, err);
          }
        }
      }

      if (descargados === 0) {
        alert('No se encontraron archivos PDF para respaldar.');
        setCargando(false);
        setEstadoRespaldo('');
        return;
      }

      setEstadoRespaldo(`Comprimiendo ${descargados} archivos PDF. Por favor espera...`);
      const contenidoZip = await zip.generateAsync({ type: 'blob' });
      
      setEstadoRespaldo('¡Descarga lista!');
      saveAs(contenidoZip, `Respaldo_Documentos_ITD_${new Date().toISOString().split('T')[0]}.zip`);
      
    } catch (error) {
      console.error('Error generando ZIP:', error);
      alert('Hubo un error al generar el respaldo.');
    }

    setEstadoRespaldo('');
    setCargando(false);
  }

  async function vaciarStorage() {
    if (!confirm('🚨 ¡ATENCIÓN! Esto ELIMINARÁ PERMANENTEMENTE todos los archivos PDF almacenados en el servidor. ¿Estás completamente seguro de que ya hiciste tu respaldo ZIP y deseas vaciar el almacenamiento?')) return;
    
    const palabra = prompt('Escribe la palabra BORRAR en mayúsculas para confirmar:');
    if (palabra !== 'BORRAR') {
      alert('Operación cancelada.');
      return;
    }

    setCargando(true);
    setEstadoRespaldo('Eliminando archivos del servidor...');

    try {
      const { data: carpetas } = await supabase.storage.from('documentos_preregistro').list('');
      const idsReales = (carpetas || []).filter(c => c.id == null || !c.name.includes('.')).map(c => c.name);
      let eliminados = 0;
      for (const id of idsReales) {
        const { data: archivos } = await supabase.storage.from('documentos_preregistro').list(id);
        if (!archivos || archivos.length === 0) continue;
        const rutasAEliminar = archivos.map(a => `${id}/${a.name}`);
        const { data } = await supabase.storage.from('documentos_preregistro').remove(rutasAEliminar);
        if (data) eliminados += data.length;
      }
      alert(`Se han eliminado ${eliminados} archivos correctamente. Tu Storage ahora está limpio.`);
      await calcularArchivos(); 
    } catch (error) {
      console.error('Error eliminando archivos:', error);
      alert('Hubo un problema al intentar borrar algunos archivos.');
    }

    setEstadoRespaldo('');
    setCargando(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">Respaldo y Limpieza (Storage)</h2>
      <p className="text-sm text-itd-navyDark/60 mb-6">
        Al finalizar un periodo, descarga un respaldo completo. Este ZIP contendrá: <strong>CVU, Ficha Técnica, Oficios Generados y Criterios de Evaluación</strong> de todos los cursos. Luego, vacía el servidor.
      </p>

      <div className="p-6 bg-itd-sand/20 border border-itd-navy/10 rounded-xl mb-6">
        <h3 className="text-sm font-semibold text-itd-navyDark mb-4">Estado del Almacenamiento (Documentos Físicos)</h3>
        
        <div className="flex items-center gap-4 mb-4">
          <div className="p-4 bg-white rounded-lg border border-itd-navy/10 shadow-sm flex-1 text-center">
            <p className="text-xs text-itd-navyDark/60 uppercase tracking-wide font-semibold mb-1">Archivos PDF Detectados</p>
            <p className="text-3xl font-display font-bold text-itd-navy">
              {archivosEncontrados === null ? 'Calculando...' : archivosEncontrados}
            </p>
          </div>
        </div>

        {estadoRespaldo && (
          <p className="text-sm font-medium text-itd-navy animate-pulse text-center my-4">
            ⏳ {estadoRespaldo}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <button
            onClick={generarZip}
            disabled={cargando || archivosEncontrados === 0}
            className="flex-1 rounded-lg bg-green-600 text-white px-4 py-3 text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            ⬇️ 1. Generar Respaldo Completo (.ZIP)
          </button>

          <button
            onClick={vaciarStorage}
            disabled={cargando || archivosEncontrados === 0}
            className="flex-1 rounded-lg bg-red-600 text-white px-4 py-3 text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            🗑️ 2. Vaciar Servidor (Limpieza)
          </button>
        </div>
        
        <p className="text-[11px] text-itd-navyDark/50 mt-4 text-center">
          Nota: Esto solo respalda y elimina los <strong>archivos PDF</strong> subidos a la nube. La información de los cursos y calificaciones seguirán intactas en la base de datos.
        </p>
      </div>
    </div>
  );
}