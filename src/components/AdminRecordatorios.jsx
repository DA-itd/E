import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatearRangoFechas, formatearHora } from '../lib/formatoFechas';
import { DEPARTAMENTOS_ITD, coincideDepartamento } from './proydoce/AdminProyectosDocencia';

export default function AdminRecordatorios({ onIrAConvocatorias }) {
  const [cursosActivos, setCursosActivos] = useState([]);
  const [convocatoriasActivas, setConvocatoriasActivas] = useState([]);
  const [cursoSeleccionado, setCursoSeleccionado] = useState(null);
  const [inscritos, setInscritos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoInscritos, setCargandoInscritos] = useState(false);

  // Filtros para los cursos activos del periodo vigente
  const [departamentoFiltro, setDepartamentoFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [busquedaInscrito, setBusquedaInscrito] = useState('');
  const [notificacion, setNotificacion] = useState(null);

  useEffect(() => {
    cargarCursosActivos();
  }, []);

  async function cargarCursosActivos() {
    setCargando(true);
    setCursoSeleccionado(null);
    setInscritos([]);
    try {
      // 1. Consultar únicamente convocatorias activas (activo = true)
      const { data: convs, error: errConvs } = await supabase
        .from('convocatorias')
        .select('*')
        .eq('activo', true)
        .order('fecha_inicio', { ascending: false });

      if (errConvs || !convs || convs.length === 0) {
        setConvocatoriasActivas([]);
        setCursosActivos([]);
        return;
      }

      setConvocatoriasActivas(convs);
      const idsActivas = convs.map((c) => c.id);

      // 2. Consultar cursos activos de esas convocatorias
      const { data: cursosData, error: errCursos } = await supabase
        .from('cursos')
        .select('*, convocatorias(*), inscripciones(*)')
        .in('convocatoria_id', idsActivas)
        .eq('status', 'activo')
        .order('fecha_inicio', { ascending: true })
        .order('nombre', { ascending: true });

      if (errCursos || !cursosData) {
        setCursosActivos([]);
      } else {
        const cursosValidos = cursosData.filter(
          (c) => !c.cerrado_manualmente && c.estado !== 'cerrado' && c.estado !== 'concluido'
        );
        setCursosActivos(cursosValidos);
      }
    } catch (err) {
      console.error('Error al cargar cursos activos:', err);
      setCursosActivos([]);
    } finally {
      setCargando(false);
    }
  }

  async function cargarInscritos(cursoId) {
    setCargandoInscritos(true);
    try {
      const { data, error } = await supabase
        .from('inscripciones')
        .select('id, estado, docente_id, docentes(id, nombre_completo, email, telefono, rfc, departamento)')
        .eq('curso_id', cursoId)
        .order('id', { ascending: true });

      if (!error && data) {
        setInscritos(data.filter((ins) => ins.estado !== 'cancelado' && ins.estado !== 'baja'));
      } else {
        setInscritos([]);
      }
    } catch (err) {
      console.error('Error al cargar inscritos:', err);
      setInscritos([]);
    } finally {
      setCargandoInscritos(false);
    }
  }

  function seleccionarCurso(curso) {
    setCursoSeleccionado(curso);
    setBusquedaInscrito('');
    cargarInscritos(curso.id);
  }

  function mostrarToast(texto) {
    setNotificacion({ texto });
    setTimeout(() => {
      setNotificacion((prev) => (prev?.texto === texto ? null : prev));
    }, 4000);
  }

  // --- GENERACIÓN DE ENLACES Y MENSAJES WHATSAPP ---
  function construirWhatsAppLink(telefono, mensaje) {
    if (!telefono) {
      return `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    }
    let telLimpio = telefono.replace(/[^0-9]/g, '');
    if (telLimpio.length === 10) telLimpio = '52' + telLimpio;
    return `https://api.whatsapp.com/send?phone=${telLimpio}&text=${encodeURIComponent(mensaje)}`;
  }

  function generarMensajeUnDia(nombreDocente, curso) {
    const fechas = curso.fecha_inicio && curso.fecha_fin
      ? formatearRangoFechas(curso.fecha_inicio, curso.fecha_fin)
      : 'Fechas programadas';
    const horario = curso.hora_inicio && curso.hora_fin
      ? `${formatearHora(curso.hora_inicio)} a ${formatearHora(curso.hora_fin)} hrs`
      : 'Horario institucional';
    const primerNombre = nombreDocente ? nombreDocente.split(' ')[0] : 'Docente';
    return `Hola ${primerNombre} 🚨,\n\n¡Te recordamos que tu curso *${curso.nombre}* inicia el día de *MAÑANA*!\n\n📅 Fechas: ${fechas}\n⏰ Horario: ${horario}\n📍 Lugar: ${curso.lugar || 'Aula designada'}\n\nFavor de asistir puntualmente. ¡Mucho éxito en tu formación docente!`;
  }

  function generarMensajeUnDiaGrupo(curso) {
    const fechas = curso.fecha_inicio && curso.fecha_fin
      ? formatearRangoFechas(curso.fecha_inicio, curso.fecha_fin)
      : 'Fechas programadas';
    const horario = curso.hora_inicio && curso.hora_fin
      ? `${formatearHora(curso.hora_inicio)} a ${formatearHora(curso.hora_fin)} hrs`
      : 'Horario institucional';
    return `Estimados docentes del curso *${curso.nombre}* 🚨${curso.folio ? ` (Folio: ${curso.folio})` : ''}:\n\nLes recordamos que nuestro curso inicia el día de *MAÑANA*.\n\n📅 Fechas: ${fechas}\n⏰ Horario: ${horario}\n📍 Lugar: ${curso.lugar || 'Aula designada'}\n\nFavor de asistir puntualmente. ¡Mucho éxito en esta jornada de capacitación!`;
  }

  function generarMensajeEncuesta(nombreDocente, curso) {
    const urlPortal = typeof window !== 'undefined' ? window.location.origin : 'https://itdurango.edu.mx';
    const primerNombre = nombreDocente ? nombreDocente.split(' ')[0] : 'Docente';
    return `Hola ${primerNombre} 🎓,\n\nEsperamos que hayas concluido exitosamente tu curso *${curso.nombre}*${curso.folio ? ` (Folio: ${curso.folio})` : ''}.\n\nPara poder *liberar y descargar tu constancia oficial con valor curricular*, es indispensable que ingreses a la plataforma y respondas la *Encuesta de Opinión (Formato ITD-AD-FO-09)*.\n\n🔗 *Ingresa aquí:* ${urlPortal}\n\n¡Agradecemos mucho tu valiosa retroalimentación para la Coordinación de Actualización Docente!`;
  }

  function generarMensajeEncuestaGrupo(curso) {
    const urlPortal = typeof window !== 'undefined' ? window.location.origin : 'https://itdurango.edu.mx';
    return `Estimados docentes del curso *${curso.nombre}* 🎓${curso.folio ? ` (Folio: ${curso.folio})` : ''}:\n\nEsperamos que hayan concluido con éxito su capacitación docente.\n\nLes recordamos que para poder *liberar y descargar su constancia oficial con valor curricular*, es indispensable ingresar al sistema institucional y responder la *Encuesta de Opinión (Formato ITD-AD-FO-09)*.\n\n🔗 *Portal institucional:* ${urlPortal}\n\n¡Agradecemos mucho su valiosa retroalimentación para seguir fortaleciendo el desarrollo académico!`;
  }

  async function copiarAlPortapapeles(texto, msgToast) {
    try {
      await navigator.clipboard.writeText(texto);
      mostrarToast(msgToast || '¡Mensaje copiado al portapapeles!');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = texto;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      mostrarToast(msgToast || '¡Mensaje copiado al portapapeles!');
    }
  }

  // Filtrado de cursos
  const cursosFiltrados = useMemo(() => {
    return cursosActivos.filter((c) => {
      if (departamentoFiltro !== 'todos' && !coincideDepartamento(c.departamento, departamentoFiltro)) {
        return false;
      }
      if (busqueda.trim() !== '') {
        const q = busqueda.toLowerCase().trim();
        const matchNombre = c.nombre?.toLowerCase().includes(q);
        const matchFolio = c.folio?.toLowerCase().includes(q);
        const matchInstructor = c.instructor?.toLowerCase().includes(q);
        const matchDepto = c.departamento?.toLowerCase().includes(q);
        if (!matchNombre && !matchFolio && !matchInstructor && !matchDepto) return false;
      }
      return true;
    });
  }, [cursosActivos, departamentoFiltro, busqueda]);

  // Filtrado de inscritos
  const inscritosVisibles = useMemo(() => {
    if (!busquedaInscrito.trim()) return inscritos;
    const q = busquedaInscrito.toLowerCase().trim();
    return inscritos.filter((ins) => {
      const nom = ins.docentes?.nombre_completo?.toLowerCase() || '';
      const tel = ins.docentes?.telefono?.toLowerCase() || '';
      const email = ins.docentes?.email?.toLowerCase() || '';
      return nom.includes(q) || tel.includes(q) || email.includes(q);
    });
  }, [inscritos, busquedaInscrito]);

  return (
    <div className="space-y-6">
      {/* Toast informativo */}
      {notificacion && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-fade-in text-sm max-w-md">
          <span className="text-emerald-400 text-lg">💬</span>
          <span className="flex-1">{notificacion.texto}</span>
          <button
            onClick={() => setNotificacion(null)}
            className="ml-2 text-white/70 hover:text-white font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ENCABEZADO */}
      <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-semibold text-itd-navy">
                Recordatorios y Avisos por WhatsApp
              </h2>
              <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-300">
                Periodo Actual
              </span>
            </div>
            <p className="text-sm text-itd-navyDark/60 mt-1">
              Envío de recordatorios de inicio de clases y enlaces de <strong>Encuesta de Opinión (ITD-AD-FO-09)</strong> para los cursos del periodo vigente.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={cargarCursosActivos}
              className="rounded-lg bg-itd-sand/60 border border-itd-navy/20 text-itd-navy px-3.5 py-2 text-xs font-semibold hover:bg-itd-sand transition-colors cursor-pointer"
              title="Recargar cursos activos"
            >
              🔄 Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* ESTADO: CARGANDO */}
      {cargando && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-500 space-y-2">
          <span className="inline-block animate-spin text-2xl">⏳</span>
          <p>Verificando convocatorias y cursos activos...</p>
        </div>
      )}

      {/* ESTADO: SIN PERIODOS O CURSOS ACTIVOS (ARCHIVADOS) */}
      {!cargando && cursosActivos.length === 0 && (
        <div className="bg-white rounded-3xl border border-amber-200/90 bg-gradient-to-b from-white via-amber-50/25 to-amber-50/40 shadow-sm p-8 sm:p-12 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-center text-3xl shadow-xs">
            🔒
          </div>

          <div className="max-w-xl mx-auto space-y-2">
            <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300 uppercase tracking-wider">
              Sin Periodos ni Cursos Activos
            </span>
            <h3 className="text-xl font-bold text-itd-navy">
              No hay periodos o cursos activos en este momento
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Los periodos y cursos han sido archivados o dados de baja en la pestaña <strong>Convocatorias y Cursos</strong>. Al no existir cursos activos en impartición durante este ciclo, no se requiere enviar recordatorios por WhatsApp.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={cargarCursosActivos}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-xs cursor-pointer"
            >
              <span>🔄</span>
              <span>Comprobar de nuevo</span>
            </button>

            {onIrAConvocatorias && (
              <button
                onClick={onIrAConvocatorias}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-itd-navy hover:bg-itd-navyDark text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <span>📁</span>
                <span>Ir a Convocatorias y Cursos</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ESTADO CON CURSOS ACTIVOS: PANEL PRINCIPAL */}
      {!cargando && cursosActivos.length > 0 && (
        <div className="space-y-6">
          {/* BARRA DE FILTROS */}
          <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-4 sm:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-itd-navy/10 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-itd-navy">
                    Cursos en Impartición / Periodo Activo
                    {convocatoriasActivas.length > 0 && (
                      <span className="ml-2 font-normal text-slate-500">
                        ({convocatoriasActivas.map((c) => c.nombre).join(', ')})
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {cursosFiltrados.length} curso(s) disponibles para envío de recordatorios
                  </p>
                </div>
              </div>

              {(departamentoFiltro !== 'todos' || busqueda) && (
                <button
                  onClick={() => {
                    setDepartamentoFiltro('todos');
                    setBusqueda('');
                  }}
                  className="text-xs text-itd-guinda hover:underline font-semibold cursor-pointer"
                >
                  Restablecer filtros
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-itd-navyDark/70 mb-1">
                  Filtrar por Departamento
                </label>
                <select
                  value={departamentoFiltro}
                  onChange={(e) => setDepartamentoFiltro(e.target.value)}
                  className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-xs bg-white"
                >
                  <option value="todos">🏢 Todos los departamentos</option>
                  {DEPARTAMENTOS_ITD.map((depto) => (
                    <option key={depto} value={depto}>
                      {depto}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-7">
                <label className="block text-xs font-semibold text-itd-navyDark/70 mb-1">
                  Buscar Curso o Instructor
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Nombre del curso, folio o instructor..."
                    className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-itd-navy pr-7"
                  />
                  {busqueda && (
                    <button
                      onClick={() => setBusqueda('')}
                      className="absolute right-2 top-2 text-xs text-gray-400 hover:text-gray-700 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* LISTA Y DETALLES DEL CURSO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* PANEL IZQUIERDO: LISTA DE CURSOS ACTIVOS */}
            <div className="lg:col-span-5 space-y-3">
              <h4 className="text-xs font-bold text-itd-navy uppercase tracking-wider">
                Cursos Activos ({cursosFiltrados.length})
              </h4>

              {cursosFiltrados.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
                  <p className="text-xs text-slate-600 font-medium">
                    No se encontraron cursos con los filtros aplicados.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
                  {cursosFiltrados.map((c) => {
                    const estaSeleccionado = cursoSeleccionado?.id === c.id;
                    const inscritosCount = Array.isArray(c.inscripciones)
                      ? c.inscripciones.filter((ins) => ins.estado !== 'cancelado' && ins.estado !== 'baja').length
                      : 0;

                    return (
                      <div
                        key={c.id}
                        onClick={() => seleccionarCurso(c)}
                        className={`w-full text-left p-3.5 rounded-xl border text-sm transition-all cursor-pointer relative ${
                          estaSeleccionado
                            ? 'bg-blue-50/90 border-itd-navy text-itd-navy shadow-sm ring-1 ring-itd-navy'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-xs sm:text-sm leading-snug line-clamp-2">
                            {c.nombre}
                          </h4>
                          <span className="text-[10px] shrink-0 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Activo
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs text-slate-500">
                          {c.folio && (
                            <span className="font-mono text-[11px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-semibold">
                              {c.folio}
                            </span>
                          )}
                          {c.departamento && (
                            <span className="truncate max-w-[190px] text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
                              {c.departamento}
                            </span>
                          )}
                          <span className="text-[11px] px-1.5 py-0.5 rounded font-medium border bg-blue-50 text-blue-800 border-blue-200">
                            👥 {inscritosCount} {inscritosCount === 1 ? 'inscrito' : 'inscritos'}
                          </span>
                        </div>

                        {c.instructor && (
                          <p className="text-[11px] text-slate-600 mt-1 truncate">
                            👨‍🏫 <strong>Instructor:</strong> {c.instructor}
                          </p>
                        )}

                        {c.fecha_inicio && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            📅 {formatearRangoFechas(c.fecha_inicio, c.fecha_fin)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* PANEL DERECHO: DETALLE DEL CURSO Y WHATSAPP */}
            <div className="lg:col-span-7">
              {!cursoSeleccionado ? (
                <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl">
                    📱
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-700 text-base">
                      Selecciona un curso activo
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Elige un curso de la lista para enviar los avisos de <strong>Inicio de Clase</strong> o la <strong>Encuesta de Opinión</strong> a través de WhatsApp.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
                  {/* Cabecera del Curso */}
                  <div className="border-b border-slate-100 pb-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-itd-navy text-white">
                          {cursoSeleccionado.folio || 'Curso'}
                        </span>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                          🟢 Curso Activo
                        </span>
                      </div>

                      <span className="text-xs font-semibold text-slate-500">
                        👥 {inscritos.length} docente(s) registrado(s)
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-itd-navy leading-snug">
                      {cursoSeleccionado.nombre}
                    </h3>

                    <div className="text-xs text-slate-600 flex flex-wrap gap-y-1 gap-x-4">
                      {cursoSeleccionado.departamento && (
                        <span>🏢 <strong>Depto:</strong> {cursoSeleccionado.departamento}</span>
                      )}
                      {cursoSeleccionado.instructor && (
                        <span>👨‍🏫 <strong>Instructor:</strong> {cursoSeleccionado.instructor}</span>
                      )}
                      {cursoSeleccionado.fecha_inicio && (
                        <span>📅 {formatearRangoFechas(cursoSeleccionado.fecha_inicio, cursoSeleccionado.fecha_fin)}</span>
                      )}
                      {cursoSeleccionado.lugar && (
                        <span>📍 {cursoSeleccionado.lugar}</span>
                      )}
                    </div>
                  </div>

                  {/* BLOQUE DE ACCIONES PARA GRUPO DE WHATSAPP O INSTRUCTOR */}
                  <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-blue-50/40 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-base font-bold shadow-xs">
                        💬
                      </span>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                          Avisos Generales para Grupo de WhatsApp
                        </h4>
                        <p className="text-[11px] text-slate-600">
                          Envía el aviso institucional directamente al grupo del curso o cópialo al portapapeles.
                        </p>
                      </div>
                    </div>

                    {/* Botones de acción grupal */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <a
                        href={construirWhatsAppLink('', generarMensajeUnDiaGrupo(cursoSeleccionado))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer text-center"
                        title="Abrir WhatsApp para enviar aviso de inicio de clases al grupo"
                      >
                        <span>🚨</span>
                        <span>Enviar "1 Día Antes" a Grupo</span>
                      </a>

                      <a
                        href={construirWhatsAppLink('', generarMensajeEncuestaGrupo(cursoSeleccionado))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer text-center"
                        title="Abrir WhatsApp para enviar recordatorio de encuesta al grupo"
                      >
                        <span>📊</span>
                        <span>Enviar "Encuesta" a Grupo</span>
                      </a>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-100/70">
                      <button
                        onClick={() =>
                          copiarAlPortapapeles(
                            generarMensajeUnDiaGrupo(cursoSeleccionado),
                            '✅ Aviso de inicio copiado al portapapeles.'
                          )
                        }
                        className="text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition cursor-pointer"
                      >
                        📋 Copiar Inicio (1 Día)
                      </button>

                      <button
                        onClick={() =>
                          copiarAlPortapapeles(
                            generarMensajeEncuestaGrupo(cursoSeleccionado),
                            '✅ Recordatorio de encuesta copiado al portapapeles.'
                          )
                        }
                        className="text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition cursor-pointer"
                      >
                        📋 Copiar Encuesta
                      </button>
                    </div>
                  </div>

                  {/* SECCIÓN DE DOCENTES INSCRITOS */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-itd-navy">
                          Docentes Inscritos ({inscritos.length})
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Envío personalizado persona por persona con su número telefónico.
                        </p>
                      </div>

                      {inscritos.length > 0 && (
                        <div className="relative flex-1 max-w-xs">
                          <input
                            type="text"
                            value={busquedaInscrito}
                            onChange={(e) => setBusquedaInscrito(e.target.value)}
                            placeholder="Buscar docente o teléfono..."
                            className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-itd-navy bg-white"
                          />
                          {busquedaInscrito && (
                            <button
                              onClick={() => setBusquedaInscrito('')}
                              className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {cargandoInscritos ? (
                      <div className="py-10 text-center text-sm text-slate-400">
                        <span className="inline-block animate-spin mr-2">⏳</span>
                        Cargando docentes inscritos...
                      </div>
                    ) : inscritosVisibles.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                        {inscritos.length === 0
                          ? 'No hay docentes registrados en este curso en la base de datos. Utiliza los botones de arriba para enviar el aviso directo al grupo de WhatsApp.'
                          : 'No se encontraron docentes con el término de búsqueda ingresado.'}
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2.5">Docente</th>
                              <th className="px-3 py-2.5 text-right">Acciones WhatsApp</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {inscritosVisibles.map((ins) => {
                              const doc = ins.docentes;
                              const nombreDoc = doc?.nombre_completo || 'Docente sin nombre';
                              const telefono = doc?.telefono || '';
                              const email = doc?.email || '';

                              const linkUnDia = construirWhatsAppLink(
                                telefono,
                                generarMensajeUnDia(nombreDoc, cursoSeleccionado)
                              );
                              const linkEncuesta = construirWhatsAppLink(
                                telefono,
                                generarMensajeEncuesta(nombreDoc, cursoSeleccionado)
                              );

                              return (
                                <tr key={ins.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-3 py-2.5">
                                    <p className="font-bold text-slate-900 text-xs">
                                      {nombreDoc}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                                      {telefono ? (
                                        <span className="font-mono text-emerald-700 font-semibold">
                                          📱 {telefono}
                                        </span>
                                      ) : (
                                        <span className="text-rose-600 font-semibold">
                                          ⚠️ Sin teléfono
                                        </span>
                                      )}
                                      {email && (
                                        <span className="text-slate-400">
                                          ✉️ {email}
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  <td className="px-3 py-2.5">
                                    <div className="flex flex-wrap justify-end gap-1.5 items-center">
                                      {linkUnDia ? (
                                        <a
                                          href={linkUnDia}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1 shadow-2xs"
                                          title="Enviar aviso de inicio de clases por WhatsApp"
                                        >
                                          <span>🚨</span> 1 Día Antes
                                        </a>
                                      ) : (
                                        <button
                                          disabled
                                          className="text-[11px] font-semibold bg-slate-100 text-slate-400 border border-slate-200 px-2 py-1 rounded-lg cursor-not-allowed"
                                          title="Docente sin teléfono registrado"
                                        >
                                          🚨 1 Día Antes
                                        </button>
                                      )}

                                      {linkEncuesta ? (
                                        <a
                                          href={linkEncuesta}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1 shadow-2xs"
                                          title="Enviar recordatorio de Encuesta de Opinión para liberar constancia"
                                        >
                                          <span>📊</span> Encuesta
                                        </a>
                                      ) : (
                                        <button
                                          disabled
                                          className="text-[11px] font-semibold bg-slate-100 text-slate-400 border border-slate-200 px-2 py-1 rounded-lg cursor-not-allowed"
                                          title="Docente sin teléfono registrado"
                                        >
                                          📊 Encuesta
                                        </button>
                                      )}
                                    </div>
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
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
