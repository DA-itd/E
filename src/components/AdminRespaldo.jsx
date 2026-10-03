// src/components/AdminRespaldo.jsx
// Módulo de Gestión de Almacenamiento y Respaldo de Expedientes en Supabase Storage

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const BUCKET_NAME = 'documentos_preregistro';
const CUOTA_MAXIMA_MB = 50; // Límite de cuota gratuita en Supabase Storage

function formatearBytes(bytes) {
  if (!bytes || bytes === 0) return '0 KB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function AdminRespaldo() {
  const [cargando, setCargando] = useState(true);
  const [archivosStorage, setArchivosStorage] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [bytesTotales, setBytesTotales] = useState(0);
  const [mensaje, setMensaje] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);
    setMensaje(null);
    try {
      // 1. Consultar archivos reales en el bucket 'documentos_preregistro'
      let todosLosArchivos = [];
      let sumaBytes = 0;

      const { data: carpetasRaiz, error: errRaiz } = await supabase.storage
        .from(BUCKET_NAME)
        .list('', { limit: 100 });

      if (!errRaiz && carpetasRaiz) {
        for (const item of carpetasRaiz) {
          if (!item.id) {
            // Es una subcarpeta nombrada con el ID del preregistro (ej: "15/")
            const { data: archivosSub } = await supabase.storage
              .from(BUCKET_NAME)
              .list(item.name, { limit: 20 });

            if (archivosSub) {
              archivosSub.forEach((sub) => {
                if (sub.id) {
                  const size = sub.metadata?.size || 0;
                  sumaBytes += size;
                  todosLosArchivos.push({
                    ...sub,
                    registroId: item.name,
                    rutaCompleta: `${item.name}/${sub.name}`,
                    size,
                  });
                }
              });
            }
          } else {
            // Archivo en la raíz
            const size = item.metadata?.size || 0;
            sumaBytes += size;
            todosLosArchivos.push({
              ...item,
              rutaCompleta: item.name,
              size,
            });
          }
        }
      }

      setArchivosStorage(todosLosArchivos);
      setBytesTotales(sumaBytes);

      // 2. Consultar preregistro_cursos (la tabla oficial de propuestas)
      const { data: propuestas, error: errCursos } = await supabase
        .from('preregistro_cursos')
        .select('*, docentes(nombre_completo, email, departamento)')
        .order('created_at', { ascending: false });

      if (!errCursos && propuestas) {
        setCursos(propuestas);
      }
    } catch (error) {
      console.error('Error al cargar almacenamiento:', error);
      setMensaje({ tipo: 'error', texto: 'No se pudo cargar la información del almacenamiento: ' + error.message });
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
      alert('Error al abrir archivo: ' + e.message);
    }
  }

  // Descargar archivo a la computadora
  async function descargarArchivo(ruta, nombreSugerido) {
    try {
      const { data, error } = await supabase.storage.from(BUCKET_NAME).download(ruta);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreSugerido || ruta.split('/').pop();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Error al descargar archivo: ' + e.message);
    }
  }

  // Liberar espacio: Elimina físicamente el PDF del Storage de Supabase
  async function liberarEspacio(ruta, nombreDocente, tipoTexto) {
    const confirmar = window.confirm(
      `¿Deseas liberar el espacio de este documento (${tipoTexto})?\n\n` +
      `• Archivo a eliminar del Storage: ${ruta}\n` +
      `• Docente: ${nombreDocente}\n\n` +
      `El PDF se borrará del almacenamiento para recuperar cuota en Supabase, pero la información y datos del curso permanecerán intactos en la base de datos.`
    );
    if (!confirmar) return;

    setProcesando(true);
    try {
      const { error } = await supabase.storage.from(BUCKET_NAME).remove([ruta]);
      if (error) throw error;

      setMensaje({
        tipo: 'exito',
        texto: `Espacio liberado con éxito. Se eliminó "${ruta}" y se recuperó cuota en Supabase.`,
      });

      await cargarDatos();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: 'No se pudo eliminar el archivo: ' + err.message });
    } finally {
      setProcesando(false);
    }
  }

  // Cálculos de cuota
  const mbOcupados = (bytesTotales / (1024 * 1024)).toFixed(2);
  const porcentajeCuota = Math.min(100, Math.round((mbOcupados / CUOTA_MAXIMA_MB) * 100));
  const mbDisponibles = Math.max(0, (CUOTA_MAXIMA_MB - parseFloat(mbOcupados)).toFixed(2));

  let colorBarra = 'bg-emerald-500';
  let estadoCuota = 'Óptimo';
  if (porcentajeCuota >= 85) {
    colorBarra = 'bg-rose-500';
    estadoCuota = 'Crítico (Alerta: se recomienda respaldar y liberar)';
  } else if (porcentajeCuota >= 65) {
    colorBarra = 'bg-amber-500';
    estadoCuota = 'Atención (Se recomienda respaldo)';
  }

  // Filtrado de cursos por búsqueda
  const cursosFiltrados = cursos.filter((c) => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return true;
    const nombre = (c.curso || '').toLowerCase();
    const docente = (c.docentes?.nombre_completo || c.nombre_jefe || '').toLowerCase();
    const depto = (c.dirigido_a || c.docentes?.departamento || '').toLowerCase();
    return nombre.includes(q) || docente.includes(q) || depto.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. MONITOR DE CUOTA EN TIEMPO REAL                                       */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">☁️</span>
              <h3 className="font-serif font-bold text-lg text-[#1B396A]">
                Almacenamiento en Supabase Storage
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                porcentajeCuota >= 85 ? 'bg-rose-100 text-rose-800' : porcentajeCuota >= 65 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {estadoCuota}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Monitoreo del espacio ocupado por expedientes, CVUs y Fichas Técnicas en el bucket <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">{BUCKET_NAME}</code>.
            </p>
          </div>

          <button
            onClick={cargarDatos}
            disabled={cargando}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition cursor-pointer self-start sm:self-auto"
          >
            <span>🔄</span>
            <span>{cargando ? 'Actualizando…' : 'Actualizar métricas'}</span>
          </button>
        </div>

        {/* Barra de progreso */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-700">
              {mbOcupados} MB ocupados de {CUOTA_MAXIMA_MB} MB
            </span>
            <span className="text-slate-500">
              {mbDisponibles} MB libres ({porcentajeCuota}%)
            </span>
          </div>

          <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-700 ${colorBarra}`}
              style={{ width: `${porcentajeCuota}%` }}
            />
          </div>
        </div>

        {/* 3 Métricas Rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Archivos en Storage</p>
            <p className="text-lg font-bold text-slate-800">{archivosStorage.length}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Espacio consumido</p>
            <p className="text-lg font-bold text-[#1B396A]">{mbOcupados} MB</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Límite establecido</p>
            <p className="text-lg font-bold text-slate-700">{CUOTA_MAXIMA_MB} MB</p>
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
      {/* 2. TABLA DE EXPEDIENTES Y LIBERACIÓN DE ESPACIO                           */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h4 className="font-serif font-bold text-base text-[#1B396A]">
              Expedientes de Prerregistro (CVU y Ficha Técnica)
            </h4>
            <p className="text-xs text-slate-500">
              Descarga los archivos a tu computadora antes de liberar espacio en el Storage para los siguientes periodos.
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
          <div className="text-center py-10 text-slate-400 text-xs">
            No se encontraron propuestas registradas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Curso / Propuesta</th>
                  <th className="py-2.5 px-3">Docente</th>
                  <th className="py-2.5 px-3">CVU del Instructor</th>
                  <th className="py-2.5 px-3">Ficha Técnica</th>
                  <th className="py-2.5 px-3 text-right">Descargas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cursosFiltrados.map((item) => {
                  const rutaCvu = `${item.id}/1_cvu_instructor.pdf`;
                  const rutaFicha = `${item.id}/2_ficha_tecnica.pdf`;

                  // Verificar si el archivo existe físicamente en el storage
                  const archivoCvuEnStorage = archivosStorage.find((a) => a.rutaCompleta === rutaCvu);
                  const archivoFichaEnStorage = archivosStorage.find((a) => a.rutaCompleta === rutaFicha);

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

                      {/* Columna CVU */}
                      <td className="py-3 px-3">
                        {archivoCvuEnStorage ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => abrirArchivo(rutaCvu)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-[11px] cursor-pointer"
                              title="Ver CVU"
                            >
                              <span>📄 Ver</span>
                              <span className="text-[9px] text-blue-500 font-normal">({formatearBytes(archivoCvuEnStorage.size)})</span>
                            </button>
                            <button
                              onClick={() => liberarEspacio(rutaCvu, nombreDocente, 'CVU')}
                              disabled={procesando}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 font-bold text-[11px] transition-colors cursor-pointer"
                              title="Liberar espacio (elimina el PDF de Supabase Storage)"
                            >
                              🗑️
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">
                            Libre / Sin archivo
                          </span>
                        )}
                      </td>

                      {/* Columna Ficha Técnica */}
                      <td className="py-3 px-3">
                        {archivoFichaEnStorage ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => abrirArchivo(rutaFicha)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-bold text-[11px] cursor-pointer"
                              title="Ver Ficha Técnica"
                            >
                              <span>📄 Ver</span>
                              <span className="text-[9px] text-purple-500 font-normal">({formatearBytes(archivoFichaEnStorage.size)})</span>
                            </button>
                            <button
                              onClick={() => liberarEspacio(rutaFicha, nombreDocente, 'Ficha Técnica')}
                              disabled={procesando}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 font-bold text-[11px] transition-colors cursor-pointer"
                              title="Liberar espacio (elimina el PDF de Supabase Storage)"
                            >
                              🗑️
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">
                            Libre / Sin archivo
                          </span>
                        )}
                      </td>

                      {/* Descarga a PC */}
                      <td className="py-3 px-3 text-right">
                        {(archivoCvuEnStorage || archivoFichaEnStorage) ? (
                          <div className="inline-flex items-center gap-1">
                            {archivoCvuEnStorage && (
                              <button
                                onClick={() => descargarArchivo(rutaCvu, `CVU_${nombreDocente}.pdf`)}
                                className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[10px] shadow-2xs cursor-pointer"
                                title="Descargar CVU a tu computadora"
                              >
                                ⬇️ CVU
                              </button>
                            )}
                            {archivoFichaEnStorage && (
                              <button
                                onClick={() => descargarArchivo(rutaFicha, `Ficha_${nombreCurso}.pdf`)}
                                className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[10px] shadow-2xs cursor-pointer"
                                title="Descargar Ficha Técnica a tu computadora"
                              >
                                ⬇️ Ficha
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Sin archivos</span>
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
