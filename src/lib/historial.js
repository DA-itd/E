import { supabase } from './supabaseClient'
import { formatearRangoFechas } from './formatoFechas'

/**
 * Obtiene el historial combinado (cursos actuales + histórico 2022-2026)
 * de un docente cualquiera -- se usa tanto para "Mi historial" como para
 * la búsqueda de administrador.
 */
export async function obtenerHistorialDocente(docenteId, email) {
  const [{ data: actuales }, { data: historicos }] = await Promise.all([
    supabase
      .from('inscripciones')
      .select('folio_personal, estado, asistencia_aprobada, cursos(id, nombre, fecha_inicio, fecha_fin, horas, tipo, departamento, folio)')
      .eq('docente_id', docenteId),
    supabase
      .from('inscripciones_historial')
      .select('folio_personal, curso, fecha_curso_texto, horas, tipo, departamento, anio')
      .ilike('email', email),
  ])

  const filasActuales = (actuales || []).map((i) => ({
    anio: i.cursos?.fecha_inicio ? Number(i.cursos.fecha_inicio.slice(0, 4)) : '',
    folio: i.folio_personal || '',
    curso: i.cursos?.nombre || '',
    fechas:
      i.cursos?.fecha_inicio && i.cursos?.fecha_fin
        ? formatearRangoFechas(i.cursos.fecha_inicio, i.cursos.fecha_fin)
        : '',
    horas: i.cursos?.horas || '',
    tipo: i.cursos?.tipo || '',
    departamento: i.cursos?.departamento || '',
    estado: i.estado,
    // Datos crudos, solo presentes en registros actuales -- permiten generar
    // constancias directamente desde la búsqueda de administrador.
    cursoId: i.cursos?.id || null,
    fechaInicio: i.cursos?.fecha_inicio || null,
    fechaFin: i.cursos?.fecha_fin || null,
    asistenciaAprobada: i.asistencia_aprobada,
  }))

  const filasHistoricas = (historicos || []).map((h) => ({
    anio: h.anio,
    folio: h.folio_personal || '',
    curso: h.curso || '',
    fechas: h.fecha_curso_texto || '',
    horas: h.horas || '',
    tipo: h.tipo || '',
    departamento: h.departamento || '',
    estado: 'activo', // los registros históricos no distinguen estado
  }))

  return [...filasActuales, ...filasHistoricas].sort((a, b) => (b.anio || 0) - (a.anio || 0))
}
