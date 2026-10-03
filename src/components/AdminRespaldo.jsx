// src/components/AdminRespaldo.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { descargarOficioRegistro } from '../lib/oficio';
import { descargarCriteriosInstructor } from '../lib/criteriosInstructor';

const BUCKET_NAME = 'documentos_preregistro';
const CUOTA_MAXIMA_MB = 50; // Límite gratuito de cuota en Supabase Storage

function formatearBytes(bytes) {
  if (!bytes || bytes === 0) return '0 KB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function AdminRespaldo() {
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [estadoRespaldo, setEstadoRespaldo] = useState('');
  const [archivosEncontrados, setArchivosEncontrados] = useState(null);
  const [bytesTotales, setBytesTotales] = useState(0);
  const [archivosStorage, setArchivosStorage] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    setCargando(true);
    setMensaje(null);
    try {
      // 1. Obtener archivos reales del Storage de Supabase
      const { data: carpetas, error: errCarpetas } = await supabase.storage.from(BUCKET_NAME).list('');
      if (errCarpetas || !carpetas) {
        setArchivosEncontrados(0);
        setBytesTotales(0);
        setArchivosStorage([]);
      } else {
        const idsReales = carpetas.filter(c => c.id == null || !c.name.includes('.')).map(c => c.name);
        
        let contadorArchivos = 0;
        let sumaBytes = 0;
        let listaArchivos = [];

        for (const id of idsReales) {
          const { data: archivos } = await supabase.storage.from(BUCKET_NAME).list(id);
          if (archivos) {
            const validos = archivos.filter(a => a.name !== '.emptyFolderPlaceholder');
            contadorArchivos += validos.length;
            validos.forEach(a => {
              const size = a.metadata?.size || 0;
              sumaBytes += size;
              listaArchivos.push({
                registroId: id,
                nombre: a.name,
                ruta: `${id}/${a.name}`,
                size: size,
              });
            });
          }
        }
        setArchivosEncontrados(contadorArchivos);
        setBytesTotales(sumaBytes);
        setArchivosStorage(listaArchivos);
      }

      // 2. Obtener lista de cursos propuestos de la base de datos
      const { data: preregistros, error: errDb } = await supabase
        .from('preregistro_cursos')
        .select('*, docentes(nombre_completo, email, departamento)')
        .order('created_at', { ascending: false });

      if (!errDb && preregistros) {
        setCursos(preregistros);
      }
    } catch (e) {
      console.error('Error al cargar datos de respaldo:', e);
      setMensaje({ tipo: 'error', texto: 'No se pudo cargar la información de almacenamiento.' });
    } finally {
      setCargando(false);
    }
  }

  // Ver archivo en nueva pestaña
  async function abrirArchivo(ruta) {
    try {
      const { data, error } = await supabase.storage.from(BUCKET_NAME).download(ruta);
      if (error) {
        const { data: pub } = supabase.storage.from(BUCKET_NAME).getPublicUrl(ruta);
        if (pub?.publicUrl) {
          window.open(pub.publicUrl, '_blank');
          return;
        }
        throw error;
      }
      const url = URL.createObjectURL(data);
      window.open(url, '_blank');
    } catch (e) {
      alert('Error al abrir el documento: ' + e.message);
    }
  }

  // Descargar archivo individual a la computadora
  async function descargarArchivo(ruta, nombreDescarga) {
    try {
      const { data, error } = await supabase.storage.from(BUCKET_NAME).download(ruta);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreDescarga || ruta.split('/').pop();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Error al descargar el archivo: ' + e.message);
    }
  }

  // Eliminar / Liberar archivo individual del Storage de Supabase
  async function eliminarArchivoIndividual(ruta, nombreDocente, tipoTexto) {
    const confirmar = window.confirm(
      `¿Deseas eliminar del Storage este ${tipoTexto}?\n\n` +
      `• Archivo: ${ruta}\n` +
      `• Docente: ${nombreDocente}\n\n` +
      `El PDF se borrará del servidor liberando espacio en Supabase, pero la información y datos del curso permanecerán intactos en la base de datos.`
    );
    if (!confirmar) return;

    setProcesando(true);
    try {
      const { error } = await supabase.storage.from(BUCKET_NAME).remove([ruta]);
      if (error) throw error;

      setMensaje({
        tipo: 'exito',
        texto: `Se eliminó "${tipoTexto}" de ${nombreDocente}. Cuota de Supabase liberada.`,
      });

      await cargarTodo();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'No se pudo eliminar el archivo: ' + err.message });
    } finally {
      setProcesando(false);
    }
  }

  // Generar respaldo masivo en archivo ZIP
  async function generarZip() {
    if (!confirm('¿Deseas generar y descargar el respaldo ZIP ahora? Esto puede tardar unos minutos dependiendo de tu conexión.')) return;
    
    setCargando(true);
    setEstadoRespaldo('Obteniendo información de los cursos y la convocatoria activa...');
    
    try {
      const zip = new JSZip();
      
      const { data: convActiva } = await supabase
        .from('convocatorias')
        .select('*')
        .eq('activo', true)
        .order('fecha_inicio', { ascending: true })
        .limit(1)
        .maybeSingle();
      
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

      const { data: evaluacionesData } = await supabase.from('evaluaciones_instructores').select('*');
      const mapaEvaluaciones = {};
      (evaluacionesData || []).forEach(ev => { mapaEvaluaciones[ev.preregistro_id] = ev; });

      setEstadoRespaldo('Buscando archivos físicos en el servidor...');
      const { data: carpetas } = await supabase.storage.from(BUCKET_NAME).list('');
      const idsReales = (carpetas || []).filter(c => c.id == null || !c.name.includes('.')).map(c => c.name);

      let descargados = 0;
      const carpetaPrincipal = zip.folder('Documentos_Cursos_ITD');

      for (const id of idsReales) {
        const infoCurso = mapaCursos[id];
        if (!infoCurso) continue;

        const nombreCurso = infoCurso.nombreLimpio;
        const preregistroInfo = infoCurso.datosPreregistro;
        const evaluacionInfo = mapaEvaluaciones[id];

        // A) DESCARGAR ARCHIVOS FÍSICOS (CVU Y Ficha Técnica)
        const { data: archivos } = await supabase.storage.from(BUCKET_NAME).list(id);
        if (archivos && archivos.length > 0) {
          for (const archivo of archivos) {
            if (archivo.name === '.emptyFolderPlaceholder') continue;
            setEstadoRespaldo(`Descargando físicos de: ${nombreCurso}...`);
            const { data: blob } = await supabase.storage.from(BUCKET_NAME).download(`${id}/${archivo.name}`);
            
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

  // Vaciar completamente el storage
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
      const { data: carpetas } = await supabase.storage.from(BUCKET_NAME).list('');
      const idsReales = (carpetas || []).filter(c => c.id == null || !c.name.includes('.')).map(c => c.name);
      let eliminados = 0;
      for (const id of idsReales) {
        const { data: archivos } = await supabase.storage.from(BUCKET_NAME).list(id);
        if (!archivos || archivos.length === 0) continue;
        const rutasAEliminar = archivos.map(a => `${id}/${a.name}`);
        const { data } = await supabase.storage.from(BUCKET_NAME).remove(rutasAEliminar);
        if (data) eliminados += data.length;
      }
      alert(`Se han eliminado ${eliminados} archivos correctamente. Tu Storage ahora está completamente limpio (0 MB).`);
      await cargarTodo(); 
    } catch (error) {
      console.error('Error eliminando archivos:', error);
      alert('Hubo un problema al intentar borrar algunos archivos.');
    }

    setEstadoRespaldo('');
    setCargando(false);
  }

  // Cálculos de cuota
  const mbOcupados = (bytesTotales / (1024 * 1024)).toFixed(2);
  const porcentajeCuota = Math.min(100, Math.round((mbOcupados / CUOTA_MAXIMA_MB) * 100));
  const mbDisponibles = Math.max(0, (CUOTA_MAXIMA_MB - parseFloat(mbOcupados)).toFixed(2));

  let colorBarra = 'bg-emerald-500';
  let estadoCuota = 'Óptimo';
  if (porcentajeCuota >= 85) {
    colorBarra = 'bg-rose-500';
    estadoCuota = 'Crítico (Se recomienda respaldar y vaciar)';
  } else if (porcentajeCuota >= 65) {
    colorBarra = 'bg-amber-500';
    estadoCuota = 'Atención (Se recomienda respaldo)';
  }

  // Filtro de cursos por búsqueda
  const cursosFiltrados = cursos.filter((c) => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return true;
    const nombre = (c.curso || '').toLowerCase();
    const docente = (c.docentes?.nombre_completo || c.nombre_jefe || '').toLowerCase();
    const depto = (c.dirigido_a || c.docentes?.departamento || '').toLowerCase();
    return nombre.includes(q) || docente.includes(q) || depto.includes(q);
  });

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8 space-y-6">
      
      {/* Encabezado Principal */}
      <div>
        <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">
          Respaldo y Limpieza (Storage)
        </h2>
        <p className="text-sm text-itd-navyDark/60">
          Supervisa el espacio ocupado, respalda y libera archivos individuales por curso, o genera un respaldo completo en ZIP y vacía el servidor al finalizar el ciclo.
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 1. MONITOR DE CUOTA EN TIEMPO REAL (SUPABASE STORAGE)                      */}
      {/* ========================================================================= */}
      <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">☁️</span>
            <div>
              <h3 className="text-sm font-bold text-[#1B396A]">
                Cuota de Almacenamiento en Supabase
              </h3>
              <p className="text-xs text-slate-500">
                Monitoreo en tiempo real del bucket <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[11px] text-slate-700">{BUCKET_NAME}</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
              porcentajeCuota >= 85 ? 'bg-rose-100 text-rose-800' : porcentajeCuota >= 65 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              ● {estadoCuota}
            </span>
            <button
              onClick={cargarTodo}
              disabled={cargando}
              className="text-xs font-semibold px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
              title="Recalcular métricas"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Barra de Consumo de MB */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-700">
              {mbOcupados} MB utilizados de {CUOTA_MAXIMA_MB} MB
            </span>
            <span className="text-slate-500 font-semibold">
              {mbDisponibles} MB disponibles ({porcentajeCuota}%)
            </span>
          </div>

          <div className="w-full h-3.5 bg-slate-200/80 rounded-full overflow-hidden p-0.5 border border-slate-300/60">
            <div
              className={`h-full rounded-full transition-all duration-700 ${colorBarra}`}
              style={{ width: `${porcentajeCuota}%` }}
            />
          </div>
        </div>

        {/* 3 Tarjetas de Resumen Numérico */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3 bg-white rounded-lg border border-slate-200 text-center shadow-2xs">
            <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold mb-0.5">
              Archivos PDF Detectados
            </p>
            <p className="text-2xl font-display font-bold text-[#1B396A]">
              {archivosEncontrados === null ? 'Calculando…' : archivosEncontrados}
            </p>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 text-center shadow-2xs">
            <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold mb-0.5">
              Espacio Ocupado
            </p>
            <p className="text-2xl font-display font-bold text-[#781834]">
              {mbOcupados} MB
            </p>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 text-center shadow-2xs">
            <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold mb-0.5">
              Límite Gratuito
            </p>
            <p className="text-2xl font-display font-bold text-slate-700">
              {CUOTA_MAXIMA_MB} MB
            </p>
          </div>
        </div>
      </div>

      {/* Mensajes del sistema */}
      {mensaje && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
          mensaje.tipo === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
        }`}>
          <div className="flex items-center gap-2">
            <span>{mensaje.tipo === 'error' ? '⚠️' : '✅'}</span>
            <span>{mensaje.texto}</span>
          </div>
          <button onClick={() => setMensaje(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ACCIONES MASIVAS ORIGINALES (RESPALDO ZIP + VACIAR STORAGE)            */}
      {/* ========================================================================= */}
      <div className="p-6 bg-itd-sand/20 border border-itd-navy/10 rounded-xl space-y-4">
        <h3 className="text-sm font-semibold text-itd-navyDark">
          Acciones de Fin de Periodo (Respaldo y Vaciado Masivo)
        </h3>

        {estadoRespaldo && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm font-medium text-itd-navy animate-pulse text-center">
              ⏳ {estadoRespaldo}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <button
            onClick={generarZip}
            disabled={cargando || archivosEncontrados === 0}
            className="flex-1 rounded-lg bg-green-600 hover:bg-green-700 text-white px-4 py-3 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>⬇️</span>
            <span>1. Generar Respaldo Completo (.ZIP)</span>
          </button>

          <button
            onClick={vaciarStorage}
            disabled={cargando || archivosEncontrados === 0}
            className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 text-white px-4 py-3 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>🗑️</span>
            <span>2. Vaciar Servidor (Limpieza Global)</span>
          </button>
        </div>
        
        <p className="text-[11px] text-itd-navyDark/60 text-center leading-relaxed">
          Nota: El ZIP incluye CVU, Ficha Técnica, Oficios Generados y Criterios. Al vaciar, se eliminan los <strong>archivos PDF físicos</strong> liberando la cuota, pero los registros de cursos y calificaciones siguen intactos en la base de datos.
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 3. GESTIÓN INDIVIDUAL DE EXPEDIENTES POR CURSO (DESCARGAR Y ELIMINAR PDF) */}
      {/* ========================================================================= */}
      <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-serif font-bold text-base text-[#1B396A]">
              Expedientes por Curso: Ver, Descargar y Eliminar
            </h3>
            <p className="text-xs text-slate-500">
              Descarga o elimina archivos PDF individuales de cada curso sin tener que vaciar todo el servidor.
            </p>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar curso o docente…"
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </div>
        </div>

        {cursosFiltrados.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            No se encontraron cursos propuestos registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Curso / Propuesta</th>
                  <th className="py-2.5 px-3">Instructor / Docente</th>
                  <th className="py-2.5 px-3">CVU del Instructor</th>
                  <th className="py-2.5 px-3">Ficha Técnica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cursosFiltrados.map((item) => {
                  const rutaCvu = `${item.id}/1_cvu_instructor.pdf`;
                  const rutaFicha = `${item.id}/2_ficha_tecnica.pdf`;

                  // Verificar si existen físicamente en el storage
                  const archivoCvu = archivosStorage.find(a => a.ruta === rutaCvu || (a.registroId === item.id && a.nombre.includes('cvu')));
                  const archivoFicha = archivosStorage.find(a => a.ruta === rutaFicha || (a.registroId === item.id && a.nombre.includes('ficha')));

                  const nombreDocente = item.docentes?.nombre_completo || 'Docente';
                  const nombreCurso = item.curso || 'Curso';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-800 max-w-xs truncate">
                        {nombreCurso}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {item.dirigido_a || item.docentes?.departamento || 'Sin departamento'}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-600 font-medium">
                        {nombreDocente}
                      </td>

                      {/* Columna CVU: Ver, Descargar y Eliminar */}
                      <td className="py-3 px-3">
                        {archivoCvu ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => abrirArchivo(archivoCvu.ruta)}
                              className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-[11px] cursor-pointer"
                              title="Ver CVU en nueva pestaña"
                            >
                              📄 Ver
                            </button>
                            <button
                              onClick={() => descargarArchivo(archivoCvu.ruta, `CVU_${nombreDocente}.pdf`)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] border border-slate-200 cursor-pointer"
                              title="Descargar CVU a la computadora"
                            >
                              ⬇️ {formatearBytes(archivoCvu.size)}
                            </button>
                            <button
                              onClick={() => eliminarArchivoIndividual(archivoCvu.ruta, nombreDocente, 'CVU')}
                              disabled={procesando}
                              className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] border border-rose-200 transition-colors cursor-pointer"
                              title="Eliminar este PDF del servidor para liberar espacio"
                            >
                              🗑️
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">
                            ✅ Sin archivo / Liberado
                          </span>
                        )}
                      </td>

                      {/* Columna Ficha Técnica: Ver, Descargar y Eliminar */}
                      <td className="py-3 px-3">
                        {archivoFicha ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => abrirArchivo(archivoFicha.ruta)}
                              className="px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-bold text-[11px] cursor-pointer"
                              title="Ver Ficha Técnica en nueva pestaña"
                            >
                              📄 Ver
                            </button>
                            <button
                              onClick={() => descargarArchivo(archivoFicha.ruta, `Ficha_${nombreCurso}.pdf`)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] border border-slate-200 cursor-pointer"
                              title="Descargar Ficha Técnica a la computadora"
                            >
                              ⬇️ {formatearBytes(archivoFicha.size)}
                            </button>
                            <button
                              onClick={() => eliminarArchivoIndividual(archivoFicha.ruta, nombreDocente, 'Ficha Técnica')}
                              disabled={procesando}
                              className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] border border-rose-200 transition-colors cursor-pointer"
                              title="Eliminar este PDF del servidor para liberar espacio"
                            >
                              🗑️
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">
                            ✅ Sin archivo / Liberado
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
