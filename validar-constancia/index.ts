// Supabase Edge Function: validar-constancia
//
// Función PÚBLICA (no requiere sesión de docente) que se usa al escanear
// el código QR de una constancia o reconocimiento, para confirmar que es
// auténtica. Solo regresa los datos mínimos necesarios para validar
// (nombre, curso, fechas, tipo) -- nunca el correo ni otros datos
// sensibles del docente.
//
// No requiere secrets nuevos: usa las mismas SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY que ya vienen incluidas por default.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { folio, tipo } = await req.json()

    if (!folio) {
      return new Response(JSON.stringify({ valido: false, mensaje: 'Falta el folio a validar.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: inscripcion } = await supabaseAdmin
      .from('inscripciones')
      .select(
        'folio_personal, estado, asistencia_aprobada, docentes(nombre_completo), cursos(nombre, fecha_inicio, fecha_fin, horas)'
      )
      .eq('folio_personal', folio)
      .maybeSingle()

    if (!inscripcion || inscripcion.estado === 'cancelado' || !inscripcion.asistencia_aprobada) {
      return new Response(JSON.stringify({ valido: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        valido: true,
        tipo: tipo === 'reconocimiento' ? 'Reconocimiento' : 'Constancia',
        nombre: inscripcion.docentes?.nombre_completo,
        curso: inscripcion.cursos?.nombre,
        fechaInicio: inscripcion.cursos?.fecha_inicio,
        fechaFin: inscripcion.cursos?.fecha_fin,
        horas: inscripcion.cursos?.horas,
        folio: inscripcion.folio_personal,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ valido: false, mensaje: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
