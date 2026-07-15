// Supabase Edge Function: constancia-drive
//
// Dos acciones:
//  - "obtener": ¿ya existe esta constancia? Si sí, regresa el PDF guardado
//    en Drive (para no generar una copia nueva cada vez).
//  - "guardar": sube el PDF recién generado a la carpeta oculta de Drive
//    y deja el registro en la tabla constancias_generadas.
//
// Requiere estos secrets en Supabase (Project Settings -> Edge Functions):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL
//   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY   (con los \n reales, ver README)
//   GOOGLE_DRIVE_FOLDER_ID
//   SUPABASE_SERVICE_ROLE_KEY  (ya viene incluida por default en Supabase)
//   SUPABASE_URL               (ya viene incluida por default en Supabase)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SERVICE_EMAIL = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
const PRIVATE_KEY = (Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY') || '').replace(/\\n/g, '\n')
const FOLDER_ID = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID')

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
)

// ---------------------------------------------------------------
// Autenticación de cuenta de servicio de Google (JWT firmado -> access_token)
// ---------------------------------------------------------------
function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function obtenerAccessToken() {
  const header = { alg: 'RS256', typ: 'JWT' }
  const ahora = Math.floor(Date.now() / 1000)
  const claim = {
    iss: SERVICE_EMAIL,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: ahora + 3600,
    iat: ahora,
  }

  const enc = new TextEncoder()
  const unsigned = `${base64url(enc.encode(JSON.stringify(header)))}.${base64url(enc.encode(JSON.stringify(claim)))}`

  const pemBody = PRIVATE_KEY.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  )
  const firma = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, enc.encode(unsigned))
  const jwt = `${unsigned}.${base64url(firma)}`

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error('No se pudo autenticar con Google: ' + JSON.stringify(data))
  return data.access_token
}

async function subirADrive(accessToken, nombreArchivo, pdfBytes) {
  const metadata = { name: nombreArchivo, parents: [FOLDER_ID] }
  const boundary = 'itd_boundary_' + crypto.randomUUID()
  const enc = new TextEncoder()

  const parte1 = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`
  )
  const parte2 = enc.encode(`\r\n--${boundary}--`)
  const body = new Blob([parte1, pdfBytes, parte2])

  const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error('No se pudo subir a Drive: ' + JSON.stringify(data))
  return data.id
}

async function descargarDeDrive(accessToken, fileId) {
  const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!resp.ok) throw new Error('No se pudo descargar de Drive')
  return new Uint8Array(await resp.arrayBuffer())
}

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

      const accessToken = await obtenerAccessToken()
      const bytes = await descargarDeDrive(accessToken, existente.drive_file_id)
      const base64 = btoa(String.fromCharCode(...bytes))
      return new Response(JSON.stringify({ success: true, existe: true, pdfBase64: base64 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (accion === 'guardar') {
      const { pdfBase64, nombreArchivo } = body
      const pdfBytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0))

      const accessToken = await obtenerAccessToken()
      const fileId = await subirADrive(accessToken, nombreArchivo, pdfBytes)

      await supabaseAdmin.from('constancias_generadas').upsert(
        { tipo, docente_id: docenteId, curso_id: cursoId, drive_file_id: fileId },
        { onConflict: 'tipo,docente_id,curso_id' }
      )

      return new Response(JSON.stringify({ success: true, driveFileId: fileId }), {
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
