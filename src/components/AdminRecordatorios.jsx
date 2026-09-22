import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatearRangoFechas, formatearHora } from '../lib/formatoFechas';

export default function AdminRecordatorios() {
  const [cursos, setCursos] = useState([]);
  const [cursoSeleccionado, setCursoSeleccionado] = useState(null);
  const [inscritos, setInscritos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoInscritos, setCargandoInscritos] = useState(false);

  useEffect(() => {
    cargarCursos();
  }, []);

  async function cargarCursos() {
    setCargando(true);
    // Cargamos todos los cursos activos
    const { data, error } = await supabase
      .from('cursos')
      .select('id, nombre, fecha_inicio, fecha_fin, hora_inicio, hora_fin, lugar')
      .order('fecha_inicio', { ascending: false });

    if (!error && data) {
      setCursos(data);
    }
    setCargando(false);
  }

  async function cargarInscritos(cursoId) {
    setCargandoInscritos(true);
    const { data, error } = await supabase
      .from('inscripciones')
      .select('id, estado, docentes(nombre_completo, email, telefono)')
      .eq('curso_id', cursoId)
      .eq('estado', 'activo');

    if (!error && data) {
      setInscritos(data);
    }
    setCargandoInscritos(false);
  }

  function seleccionarCurso(curso) {
    setCursoSeleccionado(curso);
    cargarInscritos(curso.id);
  }

  // --- PLANTILLAS DE WHATSAPP ---

  function generarWhatsAppUnDia(nombre, curso) {
    const fechas = formatearRangoFechas(curso.fecha_inicio, curso.fecha_fin);
    const horario = `${formatearHora(curso.hora_inicio)} a ${formatearHora(curso.hora_fin)} hrs`;
    return `Hola ${nombre} 🚨,\n\n¡Tu curso *${curso.nombre}* inicia el día de *MAÑANA*!\n\n📅 Fechas: ${fechas}\n⏰ Horario: ${horario}\n📍 Lugar: ${curso.lugar || 'Por definir'}\n\nPor favor sé puntual.`;
  }

  function generarWhatsAppEncuesta(nombre, curso) {
    return `Hola ${nombre} 🎓,\n\nEsperamos que hayas disfrutado tu curso *${curso.nombre}*.\n\nPara poder liberar y descargar tu *constancia de participación*, es indispensable que entres al sistema y contestes la *Encuesta de Opinión*.\n\n¡Gracias por tu tiempo!`;
  }

  function abrirWhatsApp(telefono, mensaje) {
    if (!telefono) {
      alert("Este docente no tiene teléfono registrado.");
      return;
    }
    let telLimpio = telefono.replace(/[^0-9]/g, '');
    if (telLimpio.length === 10) telLimpio = '52' + telLimpio;
    const textoCodificado = encodeURIComponent(mensaje);
    window.open(`https://api.whatsapp.com/send?phone=${telLimpio}&text=${textoCodificado}`, '_blank');
  }

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">Avisos y Recordatorios (WhatsApp)</h2>
      <p className="text-sm text-itd-navyDark/60 mb-6">
        Contacta individualmente por WhatsApp a los docentes inscritos en un curso.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* COLUMNA IZQUIERDA: LISTA DE CURSOS */}
        <div className="col-span-1 border-r border-gray-100 pr-0 xl:pr-6">
          <h3 className="font-semibold text-itd-navyDark mb-3">1. Selecciona un Curso</h3>
          
          {cargando ? (
            <p className="text-sm text-gray-500">Cargando cursos...</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {cursos.map(c => (
                <button
                  key={c.id}
                  onClick={() => seleccionarCurso(c)}
                  className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                    cursoSeleccionado?.id === c.id 
                      ? 'bg-blue-50 border-blue-200 text-blue-900 font-medium' 
                      : 'hover:bg-gray-50 border-gray-200 text-gray-700'
                  }`}
                >
                  <p className="font-semibold line-clamp-2">{c.nombre}</p>
                  <p className="text-xs mt-1 text-gray-500">{formatearRangoFechas(c.fecha_inicio, c.fecha_fin)}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: DOCENTES INSCRITOS */}
        <div className="col-span-1 xl:col-span-2">
          {!cursoSeleccionado ? (
            <div className="h-full flex items-center justify-center text-gray-400 bg-gray-50 rounded-xl border border-dashed p-10 text-center">
              Selecciona un curso de la izquierda para ver a los docentes y enviar los avisos.
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="mb-6">
                <h3 className="font-semibold text-itd-navyDark mb-1">2. Enviar Avisos ({inscritos.length} inscritos)</h3>
                <p className="text-xs text-gray-500">
                  Curso: <span className="font-medium text-itd-navy">{cursoSeleccionado.nombre}</span>
                </p>
              </div>

              {cargandoInscritos ? (
                <p className="text-sm text-gray-500">Cargando docentes inscritos...</p>
              ) : inscritos.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 p-4 rounded-lg border border-amber-200">
                  Este curso aún no tiene inscritos activos.
                </p>
              ) : (
                <div className="space-y-8 flex-1">
                  
                  {/* SECCIÓN DE WHATSAPP INDIVIDUAL */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <span>📱</span> Mensajes Directos (WhatsApp individual)
                    </h4>
                    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                          <tr>
                            <th className="px-4 py-3">Docente</th>
                            <th className="px-4 py-3 text-right">Enviar WhatsApp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {inscritos.map((ins) => (
                            <tr key={ins.id} className="hover:bg-green-50/30 transition-colors">
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900">{ins.docentes.nombre_completo}</p>
                                <div className="text-[11px] text-gray-500 flex flex-col gap-0.5 mt-1">
                                  {ins.docentes.telefono ? <span>📱 {ins.docentes.telefono}</span> : <span className="text-red-400">Sin teléfono</span>}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap justify-end gap-2">
                                  <button 
                                    onClick={() => abrirWhatsApp(ins.docentes.telefono, generarWhatsAppUnDia(ins.docentes.nombre_completo, cursoSeleccionado))}
                                    disabled={!ins.docentes.telefono}
                                    className="text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 px-2 py-1.5 rounded hover:bg-green-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    🚨 1 Día Antes
                                  </button>
                                  
                                  <button 
                                    onClick={() => abrirWhatsApp(ins.docentes.telefono, generarWhatsAppEncuesta(ins.docentes.nombre_completo, cursoSeleccionado))}
                                    disabled={!ins.docentes.telefono}
                                    className="text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 px-2 py-1.5 rounded hover:bg-green-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    📊 Encuesta
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
