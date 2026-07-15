// Supabase Edge Function: send-email
// Envía correos de confirmación o cancelación de inscripción, con el mismo
// estilo visual que usaba el sistema anterior (Apps Script + MailApp).
//
// Requiere una variable de entorno (secret) RESEND_API_KEY configurada en
// Supabase -> Project Settings -> Edge Functions -> Secrets.
// Regístrate gratis en https://resend.com (100 correos/día gratis).

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'onboarding@resend.dev'
const LOGO_URL = 'https://raw.githubusercontent.com/DA-itd/web/main/logo_itdurango.png'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function tarjetaCurso(curso, esCancelacion) {
  if (esCancelacion) {
    return `
      <div style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:12px;">
        <h3 style="color:#991b1b;margin-top:0;margin-bottom:8px;font-size:16px;text-transform:uppercase;">${curso.nombre}</h3>
        <div style="margin-bottom:8px;">
          <span style="font-weight:bold;color:#7f1d1d;">Folio Cancelado:</span>
          <span style="background-color:#fee2e2;color:#991b1b;padding:4px 8px;border-radius:4px;font-family:monospace;text-decoration:line-through;border:1px solid #fca5a5;">${curso.folio_personal || ''}</span>
        </div>
        <div style="font-size:12px;font-weight:bold;color:#dc2626;display:inline-block;padding:4px 8px;border-radius:12px;border:1px solid #fecaca;">
          BAJA PROCESADA
        </div>
      </div>`
  }
  return `
    <div style="background-color:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin-bottom:12px;font-family:'Segoe UI',sans-serif;">
      <h3 style="color:#0369a1;margin-top:0;margin-bottom:8px;font-size:16px;text-transform:uppercase;">${curso.nombre}</h3>
      <div style="margin-bottom:8px;">
        <span style="font-weight:bold;color:#0c4a6e;">Folio de Registro:</span>
        <span style="background-color:#e0f2fe;color:#0284c7;padding:4px 8px;border-radius:4px;font-family:monospace;font-weight:bold;font-size:14px;border:1px solid #7dd3fc;">${curso.folio_personal || ''}</span>
      </div>
      <div style="font-size:13px;color:#4b5563;">
        <p style="margin:2px 0;">Fechas: ${curso.fechas}</p>
        <p style="margin:2px 0;">Horario: ${curso.horario}</p>
        <p style="margin:2px 0;">Lugar: ${curso.lugar}</p>
      </div>
    </div>`
}

function construirCorreo({ tipo, nombre, cursos }) {
  const esCancelacion = tipo === 'cancelacion'
  const colorHeader = esCancelacion ? '#9D2449' : '#1B396A'
  const colorTexto = esCancelacion ? '#fecaca' : '#bfdbfe'
  const titulo = esCancelacion ? 'Confirmación de Cancelación' : 'Confirmación de Inscripción'
  const mensaje = esCancelacion
    ? 'Hemos procesado tu solicitud de <strong>baja</strong> para los siguientes cursos.'
    : 'Hemos recibido y procesado exitosamente tu solicitud de inscripción.'
  const tarjetas = cursos.map((c) => tarjetaCurso(c, esCancelacion)).join('')
  const pieMensaje = esCancelacion
    ? '<p style="font-size:14px;color:#6b7280;text-align:center;">Si deseas inscribirte nuevamente, deberás realizar el proceso sujeto a cupo disponible.</p>'
    : '<p style="font-size:16px;font-weight:bold;color:#1B396A;text-align:center;">¡Te esperamos en los cursos!</p>'

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',sans-serif;background-color:#f3f4f6;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:20px;">
        <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);">
          <div style="background-color:${colorHeader};padding:30px 20px;text-align:center;">
            <img src="${LOGO_URL}" alt="ITD" style="height:80px;margin-bottom:15px;background-color:white;border-radius:50%;padding:8px;">
            <h1 style="color:white;margin:0;font-size:24px;font-weight:bold;">${titulo}</h1>
            <p style="color:${colorTexto};margin:5px 0 0;font-size:14px;">Coordinación de Actualización Docente</p>
          </div>
          <div style="padding:40px 30px;">
            <p style="font-size:16px;color:#1f2937;margin-bottom:20px;">Hola <strong>${nombre}</strong>,</p>
            <p style="font-size:15px;color:#4b5563;line-height:1.6;margin-bottom:25px;">${mensaje}</p>
            ${tarjetas}
            <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;">
              ${esCancelacion ? '' : `
              <div style="background-color:#fffbeb;border-left:4px solid #f59e0b;padding:12px;margin-bottom:20px;border-radius:4px;">
                <p style="font-size:13px;color:#92400e;margin:0;"><strong>Importante:</strong> Guarda este correo como comprobante de tu inscripción.</p>
              </div>`}
              ${pieMensaje}
            </div>
          </div>
          <div style="background-color:#f8fafc;padding:20px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="font-size:12px;font-weight:bold;color:#64748b;margin:0;">Coordinación de Actualización Docente</p>
            <p style="font-size:12px;color:#94a3b8;margin:5px 0;">Instituto Tecnológico de Durango</p>
          </div>
        </div>
      </td></tr></table>
    </body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error('Falta configurar el secret RESEND_API_KEY en Supabase.')
    }

    const body = await req.json()
    const { tipo, email, nombre, cursos } = body

    if (!email || !nombre || !Array.isArray(cursos) || cursos.length === 0) {
      throw new Error('Faltan datos (email, nombre o cursos).')
    }

    const asunto =
      tipo === 'cancelacion'
        ? 'Confirmación de Cancelación - Actualización Docente ITD'
        : 'Confirmación de Inscripción - Actualización Docente ITD'

    const html = construirCorreo({ tipo, nombre, cursos })

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Actualización Docente ITD <${FROM_EMAIL}>`,
        to: [email],
        subject: asunto,
        html,
      }),
    })

    const data = await resp.json()
    if (!resp.ok) {
      throw new Error(data?.message || 'Error al enviar el correo con Resend.')
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
