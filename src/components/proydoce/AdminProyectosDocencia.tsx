import React, { useEffect, useState } from 'react';
import { supabase, DOMINIO_PERMITIDO } from '../../lib/supabaseClient';
import GenerarListaAsistencia from './GenerarListaAsistencia';

export const DEPARTAMENTOS_ITD = [
  'DEPARTAMENTO DE CIENCIAS BÁSICAS',
  'DEPARTAMENTO DE CIENCIAS ECONÓMICO ADMINISTRATIVAS',
  'DEPARTAMENTO DE INGENIERÍAS ELÉCTRICA - ELECTRÓNICA',
  'DEPARTAMENTO DE INGENIERÍA INDUSTRIAL',
  'DEPARTAMENTO DE METAL-MECÁNICA',
  'DEPARTAMENTO DE INGENIERÍAS QUÍMICA-BIOQUÍMICA',
  'DEPARTAMENTO DE SISTEMAS Y COMPUTACION',
  'DEPARTAMENTO DE CIENCIAS DE LA TIERRA',
  'DIVISION DE ESTUDIOS DE POSGRADO E INVESTIGACION',
  'DEPARTAMENTO DESARROLLO ACADÉMICO',
];

// Normalización profunda de texto para comparar departamentos de cualquier año
// Ignora mayúsculas, minúsculas, acentos, diéresis, guiones, espacios y prefijos como "departamento", "depto", "division"
export function normalizarTexto(txt: string = ''): string {
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quita acentos y tildes (á->a, é->e, etc.)
    .replace(/departamento\s+de\s+/gi, '')
    .replace(/depto\.?\s+de\s+/gi, '')
    .replace(/depto\.?\s+/gi, '')
    .replace(/departamento\s+/gi, '')
    .replace(/division\s+de\s+/gi, '')
    .replace(/coordinacion\s+de\s+/gi, '')
    .replace(/ing\.?\s+/gi, 'ingenieria ')
    .replace(/ingenierias/gi, 'ingenieria')
    .replace(/[^a-z0-9]/g, '') // Elimina signos, guiones y espacios
    .trim();
}

export function coincideDepartamento(deptoCurso: string = '', deptoUsuario: string = ''): boolean {
  if (!deptoCurso || !deptoUsuario) return false;
  const n1 = normalizarTexto(deptoCurso);
  const n2 = normalizarTexto(deptoUsuario);
  if (!n1 || !n2) return false;
  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}

// Determinar el periodo actual según la fecha del sistema (Enero, Junio o Agosto)
export function obtenerPeriodoActual(): { mes: 'Enero' | 'Junio' | 'Agosto'; nombre: string; anio: number } {
  const ahora = new Date();
  const mesNum = ahora.getMonth() + 1; // 1 a 12
  const anio = ahora.getFullYear();

  let mes: 'Enero' | 'Junio' | 'Agosto' = 'Enero';
  if (mesNum >= 1 && mesNum <= 5) {
    mes = 'Enero';
  } else if (mesNum >= 6 && mesNum <= 7) {
    mes = 'Junio';
  } else {
    mes = 'Agosto';
  }

  return {
    mes,
    nombre: `Periodo ${mes} ${anio}`,
    anio,
  };
}

// Evaluar si un curso pertenece a un mes / periodo específico
export function coincidePeriodoCurso(c: any, mesFiltro: string): boolean {
  if (mesFiltro === 'todos') return true;
  const mesStr = mesFiltro.toLowerCase();
  const mesNum = mesFiltro === 'Enero' ? 1 : mesFiltro === 'Junio' ? 6 : mesFiltro === 'Agosto' ? 8 : 0;

  const matchConvMes = c.convocatorias?.mes === mesNum || c.convocatorias?.nombre?.toLowerCase().includes(mesStr);
  const matchSemana = c.semana?.toLowerCase().includes(mesStr);
  const matchNombre = c.nombre?.toLowerCase().includes(mesStr);
  const matchPeriodo = c.periodo?.toLowerCase().includes(mesStr);
  const matchFecha = c.fecha_inicio?.toLowerCase().includes(mesStr);

  return Boolean(matchConvMes || matchSemana || matchNombre || matchPeriodo || matchFecha);
}

export interface AdminProyectosDocenciaProps {
  key?: React.Key;
  userEmail?: string;
  esAdminGlobal?: boolean;
  departamentoFijo?: string;
  onCrearNuevoCurso?: () => void;
}

export default function AdminProyectosDocencia({
  userEmail = 'coord_actualizaciondocente@itdurango.edu.mx',
  esAdminGlobal = true,
  departamentoFijo = '',
  onCrearNuevoCurso,
}: AdminProyectosDocenciaProps = {}) {
  const [seccionActiva, setSeccionActiva] = useState<'cursos' | 'permisos_deptos'>('cursos');
  const [cursos, setCursos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Permisos Departamentales persistidos
  const [permisosDeptos, setPermisosDeptos] = useState<any[]>([]);
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoDepto, setNuevoDepto] = useState(DEPARTAMENTOS_ITD[0]);
  const [mensajeExito, setMensajeExito] = useState('');
  const [guardandoPermiso, setGuardandoPermiso] = useState(false);

  // 1. Detección de Usuario de Departamento vs Administrador Global
  const permisoUsuarioActivo = permisosDeptos.find(
    (p) => p.email?.trim().toLowerCase() === userEmail?.trim().toLowerCase() && p.activo !== false
  );
  const deptoAsignado = departamentoFijo || permisoUsuarioActivo?.departamento || '';
  const esUsuarioDepto = Boolean(deptoAsignado && !esAdminGlobal);

  // Periodo actual detectado dinámicamente
  const periodoActual = obtenerPeriodoActual();

  // 2. Generador dinámico de Años: del 2022 al año actual
  const anioActual = new Date().getFullYear();
  const aniosDisponibles: number[] = [];
  for (let y = 2022; y <= Math.max(anioActual, 2026); y++) {
    aniosDisponibles.push(y);
  }

  // Filtros (Para Administradores)
  const [anioSeleccionado, setAnioSeleccionado] = useState<string>('todos');
  const [mesSeleccionado, setMesSeleccionado] = useState<string>('todos');
  const [departamentoFiltro, setDepartamentoFiltro] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');

  // Modal para formato oficial y exportación (PDF / Excel)
  const [cursoParaLista, setCursoParaLista] = useState<any>(null);
  const [mostrarListaAsistencia, setMostrarListaAsistencia] = useState(false);

  useEffect(() => {
    cargarCursosReales();
    cargarPermisos();
  }, [userEmail]);

  // Carga directa de Supabase o almacenamiento sincronizado
  async function cargarCursosReales() {
    setCargando(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase
        .from('cursos')
        .select('*, convocatorias(*), inscripciones(*)')
        .order('id', { ascending: false });

      if (error) throw error;
      setCursos(data || []);
    } catch (err) {
      console.error('Error al cargar cursos:', err);
      setErrorMsg('No se pudieron consultar los cursos en la base de datos.');
    } finally {
      setCargando(false);
    }
  }

  // Carga de permisos
  async function cargarPermisos() {
    try {
      const raw = localStorage.getItem('itd_permisos_departamentos');
      if (raw) setPermisosDeptos(JSON.parse(raw));
    } catch (e) {
      console.error('Error al leer permisos locales:', e);
    }
  }

  function handleGuardarPermiso(e: React.FormEvent) {
    e.preventDefault();
    setMensajeExito('');
    const emailLimpo = nuevoEmail.trim().toLowerCase();
    if (!emailLimpo.endsWith(`@${DOMINIO_PERMITIDO}`)) {
      alert(`El correo debe pertenecer al dominio oficial institucional: @${DOMINIO_PERMITIDO}`);
      return;
    }
    if (!nuevoNombre.trim()) {
      alert('Por favor ingrese el nombre completo del responsable o jefe de departamento.');
      return;
    }

    const nuevoRegistro = {
      id: String(Date.now()),
      email: emailLimpo,
      nombre_completo: nuevoNombre.trim().toUpperCase(),
      departamento: nuevoDepto,
      rol: 'JEFE_DEPARTAMENTO',
      activo: true,
      creado_el: new Date().toISOString(),
    };

    const filtrados = permisosDeptos.filter((p) => p.email?.toLowerCase() !== emailLimpo);
    const actualizados = [nuevoRegistro, ...filtrados];
    setPermisosDeptos(actualizados);
    localStorage.setItem('itd_permisos_departamentos', JSON.stringify(actualizados));
    setMensajeExito(`Acceso autorizado para ${nuevoNombre.trim()} (${nuevoDepto})`);
    setNuevoEmail('');
    setNuevoNombre('');
  }

  function handleEliminarPermiso(id: string, nombre: string) {
    if (!confirm(`¿Dar de baja el acceso a las listas de asistencia para ${nombre}?`)) return;
    const actualizados = permisosDeptos.filter((p) => p.id !== id);
    setPermisosDeptos(actualizados);
    localStorage.setItem('itd_permisos_departamentos', JSON.stringify(actualizados));
    setMensajeExito(`Acceso revocado a ${nombre}`);
  }

  // Filtrado reactivo de cursos
  const cursosFiltrados = cursos.filter((c) => {
    // REGLA PARA USUARIOS DADOS DE ALTA (JEFES / DEPARTAMENTOS):
    if (esUsuarioDepto && deptoAsignado) {
      if (!coincideDepartamento(c.departamento, deptoAsignado)) {
        return false;
      }
      if (!coincidePeriodoCurso(c, periodoActual.mes)) {
        return false;
      }
      if (busqueda.trim() !== '') {
        const q = busqueda.toLowerCase().trim();
        const matchNombre = c.nombre?.toLowerCase().includes(q);
        const matchFolio = c.folio?.toLowerCase().includes(q);
        const matchInstructor = c.instructor?.toLowerCase().includes(q);
        if (!matchNombre && !matchFolio && !matchInstructor) {
          return false;
        }
      }
      return true;
    }

    // REGLA PARA ADMINISTRADOR GLOBAL:
    if (departamentoFiltro !== 'todos') {
      if (!coincideDepartamento(c.departamento, departamentoFiltro)) return false;
    }

    if (anioSeleccionado !== 'todos') {
      const anioNum = parseInt(anioSeleccionado, 10);
      const anioConv = c.convocatorias?.anio;
      const matchFecha = c.fecha_inicio && c.fecha_inicio.includes(String(anioNum));
      const matchPeriodo = c.periodo && c.periodo.includes(String(anioNum));
      const matchFolio = c.folio && c.folio.includes(String(anioNum));
      const matchSemana = c.semana && c.semana.includes(String(anioNum));
      if (anioConv !== anioNum && !matchFecha && !matchPeriodo && !matchFolio && !matchSemana) {
        return false;
      }
    }

    if (mesSeleccionado !== 'todos') {
      if (!coincidePeriodoCurso(c, mesSeleccionado)) {
        return false;
      }
    }

    if (busqueda.trim() !== '') {
      const q = busqueda.toLowerCase().trim();
      const matchNombre = c.nombre?.toLowerCase().includes(q);
      const matchFolio = c.folio?.toLowerCase().includes(q);
      const matchInstructor = c.instructor?.toLowerCase().includes(q);
      if (!matchNombre && !matchFolio && !matchInstructor) {
        return false;
      }
    }

    return true;
  });

  const departamentosEnBD = Array.from(
    new Set(
      cursos
        .map((c) => c.departamento?.trim().toUpperCase())
        .filter((d) => Boolean(d))
    )
  ).sort();

  function abrirFormato(curso: any) {
    setCursoParaLista(curso);
    setMostrarListaAsistencia(true);
  }

  return (
    <div className="space-y-6">
      {/* HEADER DEL MÓDULO */}
      <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-semibold text-itd-navy">
                {esUsuarioDepto ? 'Listas de Asistencia Oficiales' : 'Proyectos de Docencia y Listas de Asistencia'}
              </h2>
              {esUsuarioDepto && (
                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-300">
                  Acceso Departamental
                </span>
              )}
            </div>
            <p className="text-sm text-itd-navyDark/60 mt-1">
              {esUsuarioDepto ? (
                <span>
                  Departamento: <strong className="text-itd-navy font-bold">{deptoAsignado}</strong> · Periodo en curso: <strong className="text-itd-navy font-bold">{periodoActual.nombre}</strong>
                </span>
              ) : (
                'Consulta de cursos, emisión del Formato Oficial ITD-AD-FO-8 Rev. 1 y gestión de personal autorizado.'
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={cargarCursosReales}
              className="rounded-lg bg-itd-sand/60 border border-itd-navy/20 text-itd-navy px-3 py-2 text-xs font-semibold hover:bg-itd-sand transition-colors"
              title="Recargar cursos"
            >
              🔄 Actualizar
            </button>

            {esAdminGlobal && (
              <div className="inline-flex rounded-lg border border-itd-navy/20 p-0.5 bg-itd-sand/30">
                <button
                  onClick={() => setSeccionActiva('cursos')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    seccionActiva === 'cursos'
                      ? 'bg-itd-navy text-white shadow-xs'
                      : 'text-itd-navyDark/70 hover:text-itd-navy'
                  }`}
                >
                  📋 Cursos y Listas
                </button>
                <button
                  onClick={() => setSeccionActiva('permisos_deptos')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    seccionActiva === 'permisos_deptos'
                      ? 'bg-itd-navy text-white shadow-xs'
                      : 'text-itd-navyDark/70 hover:text-itd-navy'
                  }`}
                >
                  👥 Dar de Alta Usuarios
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECCIÓN 1: CURSOS Y LISTAS DE ASISTENCIA */}
      {seccionActiva === 'cursos' && (
        <div className="space-y-4">
          {esUsuarioDepto ? (
            <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-blue-800">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-white/20 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                      🏢 {deptoAsignado}
                    </span>
                    <span className="bg-amber-400 text-blue-950 text-xs font-bold px-2.5 py-0.5 rounded-full">
                      📌 {periodoActual.nombre}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white">
                    Cursos Disponibles para Descargar Lista de Asistencia
                  </h3>
                  <p className="text-xs text-blue-200">
                    Solo se muestran los cursos pertenecientes a su departamento en el periodo actual. Seleccione el curso deseado para descargar su formato oficial en PDF o Excel.
                  </p>
                </div>

                <div className="w-full md:w-72 shrink-0">
                  <div className="relative">
                    <input
                      type="text"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar curso o instructor…"
                      className="w-full rounded-xl bg-white/10 border border-white/20 px-3.5 py-2 text-xs text-white placeholder-blue-200 focus:outline-hidden focus:ring-2 focus:ring-amber-400 focus:bg-white/20"
                    />
                    {busqueda && (
                      <button
                        onClick={() => setBusqueda('')}
                        className="absolute right-2.5 top-2 text-xs text-white/70 hover:text-white"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-itd-navy/10 pb-2">
                <span className="text-xs font-semibold text-itd-navy uppercase tracking-wider">
                  Filtros de Búsqueda de Cursos
                </span>
                <span className="text-xs text-itd-navyDark/60 font-semibold">
                  {cursosFiltrados.length} curso(s) encontrados
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-itd-navyDark/70 mb-1">
                    1. Año
                  </label>
                  <select
                    value={anioSeleccionado}
                    onChange={(e) => setAnioSeleccionado(e.target.value)}
                    className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm bg-white"
                  >
                    <option value="todos">📅 Todos los años (2022 - {aniosDisponibles[0]})</option>
                    {aniosDisponibles.map((anio) => (
                      <option key={anio} value={String(anio)}>
                        Año {anio}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-itd-navyDark/70 mb-1">
                    2. Periodo / Mes
                  </label>
                  <select
                    value={mesSeleccionado}
                    onChange={(e) => setMesSeleccionado(e.target.value)}
                    className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm bg-white"
                  >
                    <option value="todos">📌 Todos los periodos</option>
                    <option value="Enero">❄️ Enero (Trimestre 1)</option>
                    <option value="Junio">☀️ Junio (Trimestre 2)</option>
                    <option value="Agosto">🍂 Agosto (Trimestre 3)</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-itd-navyDark/70 mb-1">
                    3. Departamento
                  </label>
                  <select
                    value={departamentoFiltro}
                    onChange={(e) => setDepartamentoFiltro(e.target.value)}
                    className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm bg-white"
                  >
                    <option value="todos">🏢 Todos los departamentos</option>
                    {DEPARTAMENTOS_ITD.map((depto) => (
                      <option key={depto} value={depto}>
                        {depto}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-itd-navyDark/70 mb-1">
                    Buscar Curso
                  </label>
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Nombre, folio, instructor…"
                    className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* LISTA DE CURSOS */}
          {cargando ? (
            <p className="text-center text-itd-navyDark/50 py-12">Cargando cursos desde la base de datos…</p>
          ) : errorMsg ? (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
              {errorMsg}
            </div>
          ) : cursosFiltrados.length === 0 ? (
            <div className="bg-white rounded-2xl border border-itd-navy/10 p-12 text-center text-itd-navyDark/60 space-y-3">
              <p className="text-3xl">📂</p>
              <p className="text-base font-semibold text-itd-navyDark">
                {esUsuarioDepto
                  ? `No se encontraron cursos activos para el ${deptoAsignado} en el ${periodoActual.nombre}.`
                  : 'No se encontraron cursos con los filtros seleccionados.'}
              </p>
              <p className="text-xs text-itd-navyDark/50 max-w-md mx-auto">
                {esUsuarioDepto
                  ? 'Si requiere que se habilite un curso o lista para este periodo, comuníquese con la Coordinación de Actualización Docente.'
                  : 'Selecciona "Todos los años" o "Todos los periodos" para ver la lista completa.'}
              </p>
              {!esUsuarioDepto && (
                <button
                  onClick={() => {
                    setAnioSeleccionado('todos');
                    setMesSeleccionado('todos');
                    setDepartamentoFiltro('todos');
                    setBusqueda('');
                  }}
                  className="rounded-lg bg-itd-navy text-white px-4 py-2 text-xs font-medium hover:bg-itd-navyDark"
                >
                  Restablecer Filtros
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {cursosFiltrados.map((curso) => (
                <div
                  key={curso.id}
                  onClick={() => abrirFormato(curso)}
                  className="bg-white rounded-2xl border border-itd-navy/10 p-5 shadow-sm hover:border-itd-navy/30 hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-itd-sand text-itd-navy border border-itd-navy/10">
                        {curso.folio || 'SIN FOLIO'}
                      </span>
                      <span className="text-xs font-semibold text-itd-navyDark/60">
                        · {curso.departamento || 'Sin departamento'}
                      </span>
                      {curso.tipo && (
                        <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold rounded-full border border-blue-200">
                          {curso.tipo}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-base text-itd-navy hover:underline">
                      {curso.nombre}
                    </h3>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-itd-navyDark/70">
                      <span>👨‍🏫 <strong>Instructor:</strong> {curso.instructor || 'Sin instructor'}</span>
                      <span>📅 <strong>Periodo:</strong> {curso.periodo || curso.semana || (curso.fecha_inicio && curso.fecha_fin ? `${curso.fecha_inicio} a ${curso.fecha_fin}` : 'Intersemestral')}</span>
                      <span>⏰ <strong>Horario:</strong> {curso.horario || `${curso.horas || 30} hrs`}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirFormato(curso);
                      }}
                      className="rounded-xl bg-itd-navy hover:bg-itd-navyDark text-white px-4 py-2.5 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <span>📄</span>
                      <span>Descargar Lista Oficial (PDF)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECCIÓN 2: CONTROL DE PERMISOS POR DEPARTAMENTO (SOLO ADMIN) */}
      {seccionActiva === 'permisos_deptos' && esAdminGlobal && (
        <div className="space-y-6">
          {mensajeExito && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-xs font-bold flex justify-between">
              <span>{mensajeExito}</span>
              <button onClick={() => setMensajeExito('')}>✕</button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8 space-y-4">
            <h3 className="font-display text-base font-semibold text-itd-navy">
              👤 Dar de Alta a Usuario para Ver Listas de su Departamento
            </h3>
            <p className="text-xs text-itd-navyDark/60">
              Otorga acceso a jefes de departamento o coordinadores para consultar únicamente las listas oficiales del periodo actual de su área sin filtros adicionales.
            </p>

            <form onSubmit={handleGuardarPermiso} className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-itd-navyDark/70 mb-1">
                  Nombre Completo del Jefe / Responsable
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. ING. JUAN PÉREZ LÓPEZ"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-itd-navyDark/70 mb-1">
                  Correo Institucional (@itdurango.edu.mx)
                </label>
                <input
                  type="email"
                  required
                  placeholder="usuario@itdurango.edu.mx"
                  value={nuevoEmail}
                  onChange={(e) => setNuevoEmail(e.target.value)}
                  className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-itd-navyDark/70 mb-1">
                  Departamento Asignado
                </label>
                <select
                  value={nuevoDepto}
                  onChange={(e) => setNuevoDepto(e.target.value)}
                  className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-xs bg-white"
                >
                  {DEPARTAMENTOS_ITD.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={guardandoPermiso}
                  className="bg-itd-navy hover:bg-itd-navyDark text-white px-5 py-2.5 rounded-lg text-xs font-bold transition shadow-sm"
                >
                  {guardandoPermiso ? 'Guardando...' : '➕ Registrar Usuario'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-itd-navy">
              📋 Usuarios con Acceso Registrados ({permisosDeptos.length})
            </h3>

            {permisosDeptos.length === 0 ? (
              <p className="text-xs text-itd-navyDark/50 py-4 text-center">
                No hay usuarios de departamento dados de alta todavía.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-itd-sand/50 text-itd-navy font-bold border-b border-itd-navy/10">
                      <th className="p-3">Nombre</th>
                      <th className="p-3">Correo Institucional</th>
                      <th className="p-3">Departamento</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-itd-navy/5">
                    {permisosDeptos.map((p) => (
                      <tr key={p.id || p.email} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-itd-navy">{p.nombre_completo}</td>
                        <td className="p-3 font-mono text-itd-navyDark/70">{p.email}</td>
                        <td className="p-3 font-semibold text-amber-800">{p.departamento}</td>
                        <td className="p-3">
                          <span className="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded-full text-[10px]">
                            Activo
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleEliminarPermiso(p.id, p.nombre_completo)}
                            className="text-red-600 hover:text-red-800 font-bold text-xs"
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
        </div>
      )}

      {/* MODAL OFICIAL: Formato con PDF y Excel */}
      {mostrarListaAsistencia && cursoParaLista && (
        <GenerarListaAsistencia
          cursoId={cursoParaLista.id}
          cursoProp={cursoParaLista}
          onClose={() => {
            setMostrarListaAsistencia(false);
            setCursoParaLista(null);
            cargarCursosReales();
          }}
        />
      )}
    </div>
  );
}
function abrirFormato(curso: any) {
  console.log("📋 Curso seleccionado:", curso);
  if (!curso || !curso.id) {
    console.error("❌ Error: curso sin ID");
    alert("El curso no tiene un ID válido. Contacta al administrador.");
    return;
  }
  setCursoParaLista(curso);
  setMostrarListaAsistencia(true);
}
// Dentro del render de cada curso
<button
  onClick={() => {
    console.log("🖱️ Click en botón de:", curso.nombre, "ID:", curso.id);
    abrirFormato(curso);
  }}
  className="rounded-xl bg-itd-navy hover:bg-itd-navyDark text-white px-4 py-2.5 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
>
  <span>📄</span>
  <span>Descargar Lista Oficial (PDF)</span>
</button>