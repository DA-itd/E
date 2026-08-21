// src/components/AdminProyectosDocencia.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import GenerarListaAsistencia from './GenerarListaAsistencia';

// Helper para obtener el conteo real de inscritos activos de cada curso
async function enriquecerCursosConInscritos(cursos) {
  if (!cursos || cursos.length === 0) return [];
  const cursoIds = cursos.map(c => c.id).filter(Boolean);
  const folios = cursos.map(c => c.folio).filter(Boolean);
  const conteo = {};

  try {
    if (cursoIds.length > 0) {
      const { data: inscripcionesData, error: insError } = await supabase
        .from('inscripciones')
        .select('curso_id, estado')
        .in('curso_id', cursoIds)
        .eq('estado', 'activo');

      if (!insError && Array.isArray(inscripcionesData)) {
        inscripcionesData.forEach(item => {
          if (item.curso_id) {
            conteo[item.curso_id] = (conteo[item.curso_id] || 0) + 1;
          }
        });
      }
    }

    if (folios.length > 0) {
      for (const f of folios) {
        if (!conteo[f]) {
          try {
            const { data: histData } = await supabase
              .from('inscripciones_historial')
              .select('folio_curso')
              .ilike('folio_curso', f);
            if (histData && histData.length > 0) {
              conteo[f] = histData.length;
            }
          } catch {
            // ignorar
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error al obtener conteo de inscripciones:', e);
  }

  return cursos.map(c => {
    const inscritosReales = conteo[c.id] || (c.folio ? conteo[c.folio] : 0) || (c.participantes?.length) || (c.inscripciones?.[0]?.count) || 0;
    return {
      ...c,
      total_inscritos: inscritosReales
    };
  });
}

export default function AdminProyectosDocencia({ userEmail, esAdminGlobal }) {
  const [cursos, setCursos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [cursoSeleccionado, setCursoSeleccionado] = useState(null);
  const [periodoFiltro, setPeriodoFiltro] = useState('TODOS');
  const [anioFiltro, setAnioFiltro] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    cargarCursos();
  }, []);

  async function cargarCursos() {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('cursos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const cursosConInscritos = await enriquecerCursosConInscritos(data || []);
      setCursos(cursosConInscritos);
    } catch (err) {
      console.error('Error al cargar cursos:', err);
    } finally {
      setCargando(false);
    }
  }

  // Si hay un curso seleccionado, mostrar la Lista de Asistencia
  if (cursoSeleccionado) {
    return (
      <GenerarListaAsistencia
        curso={cursoSeleccionado}
        alVolver={() => {
          setCursoSeleccionado(null);
          cargarCursos();
        }}
      />
    );
  }

  const cursosFiltrados = cursos.filter(c => {
    const coincideTexto = 
      (c.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.folio || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.instructor || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.departamento || '').toLowerCase().includes(busqueda.toLowerCase());

    const coincideAnio = anioFiltro === 'TODOS' || (c.folio && c.folio.includes(anioFiltro)) || (c.fecha_inicio && c.fecha_inicio.startsWith(anioFiltro));
    const coincidePeriodo = periodoFiltro === 'TODOS' || (c.semana && c.semana.toUpperCase().includes(periodoFiltro.toUpperCase()));

    return coincideTexto && coincideAnio && coincidePeriodo;
  });

  return (
    <div className="space-y-6">
      {/* Encabezado y Filtros */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Cursos y Proyectos de Docencia</h2>
            <p className="text-sm text-slate-500">Gestiona y genera las listas de asistencia oficiales del ITD</p>
          </div>
          <button
            onClick={cargarCursos}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-sm transition-colors self-start md:self-auto"
          >
            🔄 Actualizar Cursos
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Buscar</label>
            <input
              type="text"
              placeholder="Buscar por nombre, folio, instructor..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Año</label>
            <select
              value={anioFiltro}
              onChange={(e) => setAnioFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="TODOS">Todos los años</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Periodo / Semana</label>
            <select
              value={periodoFiltro}
              onChange={(e) => setPeriodoFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="TODOS">Todos los periodos</option>
              <option value="SEMANA 1">Semana 1</option>
              <option value="SEMANA 2">Semana 2</option>
              <option value="SEMANA 3">Semana 3</option>
              <option value="SEMANA 4">Semana 4</option>
            </select>
          </div>
        </div>
      </div>

      {/* Listado de Tarjetas de Cursos */}
      {cargando ? (
        <div className="bg-white p-12 rounded-xl text-center shadow-sm border border-slate-200">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1b396a] mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Cargando cursos e inscripciones...</p>
        </div>
      ) : cursosFiltrados.length === 0 ? (
        <div className="bg-white p-12 rounded-xl text-center shadow-sm border border-slate-200">
          <p className="text-slate-500 text-lg">No se encontraron cursos con los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cursosFiltrados.map((curso) => (
            <div
              key={curso.id || curso.folio}
              className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-md uppercase tracking-wider">
                    {curso.folio || 'SIN FOLIO'}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {curso.semana || 'Semana 1'}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-800 line-clamp-2 mb-3">
                  {curso.nombre}
                </h3>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <p><span className="font-semibold text-slate-700">Instructor:</span> {curso.instructor || 'Por asignar'}</p>
                  <p><span className="font-semibold text-slate-700">Depto:</span> {curso.departamento || 'Actualización Docente'}</p>
                  <p><span className="font-semibold text-slate-700">Horario:</span> {curso.horario || `${curso.hora_inicio || '08:00'} - ${curso.hora_fin || '14:00'}`}</p>
                  <p><span className="font-semibold text-slate-700">Lugar:</span> {curso.lugar || 'Por definir'}</p>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <span>👥</span>
                  <span>{curso.total_inscritos || 0} inscritos</span>
                </div>

                <button
                  onClick={() => setCursoSeleccionado(curso)}
                  className="px-4 py-2 bg-[#1b396a] hover:bg-[#152c52] text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                >
                  Lista de Asistencia 📋
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}