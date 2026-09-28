import { supabase } from './supabaseClient'

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Regla explícita (no una fórmula genérica) para no arriesgar un caso no
// contemplado: Agosto y Junio miran hacia Enero del mismo año; Enero mira
// hacia Junio del año anterior. Si algún día se agrega un periodo nuevo,
// hay que añadir su caso aquí a propósito.
export function calcularPeriodoAnteriorTexto(mesConvocatoria, anioConvocatoria) {
  if (mesConvocatoria === 8 || mesConvocatoria === 6) {
    return `Enero ${anioConvocatoria}`
  }
  if (mesConvocatoria === 1) {
    return `Junio ${anioConvocatoria - 1}`
  }
  // Respaldo genérico por si se agrega un periodo no contemplado todavía.
  return `${MESES[mesConvocatoria] || ''} ${anioConvocatoria}`.trim()
}

// Devuelve el set de inscripcion_id que YA tienen una respuesta guardada,
// para decidir a quién mostrarle el botón de descarga y a quién la encuesta.
export async function obtenerInscripcionesConEncuestaRespondida(inscripcionIds) {
  if (!inscripcionIds.length) return new Set()
  const { data } = await supabase
    .from('encuesta_respuestas')
    .select('inscripcion_id')
    .in('inscripcion_id', inscripcionIds)
  return new Set((data || []).map((r) => r.inscripcion_id))
}

export async function guardarRespuestaEncuesta(payload) {
  return supabase.from('encuesta_respuestas').insert(payload)
}
