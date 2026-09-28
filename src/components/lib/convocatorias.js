import { supabase } from './supabaseClient'

// Devuelve el id de la convocatoria "vigente" en este momento: la primera
// (por fecha de inicio) que esté marcada como activa y cuya fecha de fin
// todavía no haya pasado. Si no hay ninguna, regresa null.
// Se usa tanto para decidir qué cursos mostrar (PasoCursos) como para saber
// si un docente ya confirmó sus datos personales en el periodo actual
// (PasoDatos / App.jsx).
export async function obtenerConvocatoriaActivaId() {
  const { data } = await supabase
    .from('convocatorias')
    .select('id')
    .eq('activo', true)
    .order('fecha_inicio', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (data?.id) return data.id

  // Si no hay ninguna marcada como activa, fallback a la más reciente registrada
  const { data: ultima } = await supabase
    .from('convocatorias')
    .select('id')
    .order('fecha_inicio', { ascending: false })
    .limit(1)
    .maybeSingle()
  return ultima?.id ?? null
}
