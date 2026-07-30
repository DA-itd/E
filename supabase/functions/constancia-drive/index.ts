// Supabase Edge Function: constancia-drive
//
// (El nombre se quedó igual para no tener que tocar el frontend, pero ya
// NO usa Google Drive -- ahora guarda las constancias en Supabase Storage,
// en el bucket privado "constancias". Se cambió porque las cuentas de
// servicio de Google no tienen cuota de almacenamiento propia fuera de
// una Unidad Compartida, y eso requiere permisos de administrador del
// dominio que no tenemos.)
//
// Dos acciones:
//  - "obtener": ¿ya existe esta constancia? Si sí, regresa el PDF guardado.
//  - "guardar": sube el PDF recién generado al bucket y deja el registro
//    en la tabla constancias_generadas.
//
// Requiere que exista el bucket privado "constancias" en Supabase Storage
// (Storage -> New bucket -> nombre "constancias", Public: OFF).
// No requiere secrets nuevos: usa las mismas SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY que ya vienen incluidas por default.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BUCKET = 'constancias'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
)

function obtenerEmailDelToken(req) {
  try {
    const auth = req.headers.get('Authorization') || ''
    const token = auth.replace('Bearer ', '')
    const payload = JSON.parse(atob(token.split('.')[1]))
    return (payload.email || '').toLowerCase()
  } catch {
    return null
  }
}

async function verificarPropietario(emailSolicitante, docenteId) {
  if (!emailSolicitante) return false
  const { data: admin } = await supabaseAdmin
    .from('administradores').select('email').ilike('email', emailSolicitante).maybeSingle()
  if (admin) return true

  const { data: docente } = await supabaseAdmin
    .from('docentes').select('email').eq('id', docenteId).maybeSingle()
  return docente?.email?.toLowerCase() === emailSolicitante
}

// ---------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { accion, tipo, docenteId, cursoId } = body

    const emailSolicitante = obtenerEmailDelToken(req)
    const autorizado = await verificarPropietario(emailSolicitante, docenteId)
    if (!autorizado) {
      return new Response(JSON.stringify({ success: false, message: 'No autorizado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rutaArchivo = `${tipo}/${docenteId}_${cursoId}.pdf`

    if (accion === 'obtener') {
      const { data: existente } = await supabaseAdmin
        .from('constancias_generadas')
        .select('drive_file_id')
        .eq('tipo', tipo).eq('docente_id', docenteId).eq('curso_id', cursoId)
        .maybeSingle()

      if (!existente?.drive_file_id) {
        return new Response(JSON.stringify({ success: true, existe: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: archivo, error: errorDescarga } = await supabaseAdmin
        .storage.from(BUCKET).download(existente.drive_file_id)

      if (errorDescarga) {
        // Si por alguna razón el archivo ya no está (se borró manualmente,
        // etc.), no truena -- solo se regenera como si no existiera.
        return new Response(JSON.stringify({ success: true, existe: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const bytes = new Uint8Array(await archivo.arrayBuffer())
      const base64 = btoa(String.fromCharCode(...bytes))
      return new Response(JSON.stringify({ success: true, existe: true, pdfBase64: base64 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (accion === 'guardar') {
      const { pdfBase64 } = body
      const pdfBytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0))

      const { error: errorSubida } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(rutaArchivo, pdfBytes, { contentType: 'application/pdf', upsert: true })

      if (errorSubida) throw new Error('No se pudo subir a Storage: ' + errorSubida.message)

      await supabaseAdmin.from('constancias_generadas').upsert(
        { tipo, docente_id: docenteId, curso_id: cursoId, drive_file_id: rutaArchivo },
        { onConflict: 'tipo,docente_id,curso_id' }
      )

      return new Response(JSON.stringify({ success: true, path: rutaArchivo }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    throw new Error('Acción no reconocida')
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
