import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { formatearRangoFechas, formatearHora } from '../../lib/formatoFechas'

const MENSAJES_ERROR = {
  CUPO_LLENO: 'Este curso ya alcanzó su cupo máximo justo antes de tu confirmación.',
  LIMITE_CURSOS: 'Ya tienes 2 cursos activos en esta convocatoria.',
  TRASLAPE_FECHAS: 'Las fechas de este curso se empalman con otro curso en el que ya estás inscrito.',
}

function mensajeAmigable(errorMsg) {
  for (const clave in MENSAJES_ERROR) {
    if (errorMsg?.includes(clave)) return MENSAJES_ERROR[clave]
  }
  return 'No se pudo completar la inscripción a este curso.'
}

export default function PasoConfirmar({ docente, cursosSeleccionados, todosCursos, onFinalizado, onRegresar }) {
  const [confirmando, setConfirmando] = useState(false)
  const [erroresPorCurso, setErroresPorCurso] = useState({})

  const detalle = cursosSeleccionados
    .map((id) => todosCursos.find((c) => c.id === id))
    .filter(Boolean)

  async function confirmar() {
    setConfirmando(true)
    setErroresPorCurso({})
    const exitosos = []
    const errores = {}

    // Se insertan uno por uno (no en lote) para poder mostrar exactamente
    // cuál curso falló y por qué -- antes esto fallaba en silencio.
    for (const curso of detalle) {
      const { error } = await supabase.from('inscripciones').insert({
        docente_id: docente.id,
        curso_id: curso.id,
      })
      if (error) {
        errores[curso.id] = mensajeAmigable(error.message)
      } else {
        exitosos.push(curso.id)
      }
    }

    setConfirmando(false)
    setErroresPorCurso(errores)

    if (Object.keys(errores).length === 0) {
      // Enviar correo de confirmación (si falla el envío, no se bloquea la
      // inscripción -- ya quedó guardada, solo no llegaría el correo).
      const cursosParaCorreo = exitosos.map((id) => {
        const c = detalle.find((c) => c.id === id)
        return {
          nombre: c.nombre,
          folio_personal: null, // se completa abajo tras recargar
          fechas: formatearRangoFechas(c.fecha_inicio, c.fecha_fin),
          horario: `${formatearHora(c.hora_inicio)} a ${formatearHora(c.hora_fin)} hrs`,
          lugar: c.lugar,
        }
      })

      const { data: insertadas } = await supabase
        .from('inscripciones')
        .select('curso_id, folio_personal')
        .eq('docente_id', docente.id)
        .in('curso_id', exitosos)

      const cursosConFolio = cursosParaCorreo.map((c) => {
        const original = detalle.find((d) => d.nombre === c.nombre)
        const ins = insertadas?.find((i) => i.curso_id === original?.id)
        return { ...c, folio_personal: ins?.folio_personal }
      })

      supabase.functions
        .invoke('send-email', {
          body: { tipo: 'confirmacion', email: docente.email, nombre: docente.nombre_completo, cursos: cursosConFolio },
        })
        .catch(() => {}) // no bloquear la UI si el correo falla

      onFinalizado({ exitosos, errores: {} })
    }
    // Si hubo errores, se quedan mostrados en pantalla para que el docente
    // decida (los que sí se pudieron inscribir ya quedaron guardados).
  }

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">Confirmar Inscripción</h2>
      <p className="text-sm text-itd-navyDark/60 mb-6">
        Revisa que todo esté correcto antes de confirmar.
      </p>

      <div className="space-y-3">
        {detalle.map((curso) => (
          <div key={curso.id} className="rounded-xl border border-itd-navy/10 p-4">
            <p className="font-medium text-sm text-itd-navyDark">{curso.nombre}</p>
            <p className="text-xs text-itd-navyDark/60 mt-1">
              {curso.semana} · {formatearRangoFechas(curso.fecha_inicio, curso.fecha_fin)} · {formatearHora(curso.hora_inicio)} a {formatearHora(curso.hora_fin)} hrs
            </p>
            <p className="text-xs text-itd-navyDark/60">{curso.lugar}</p>
            {erroresPorCurso[curso.id] && (
              <p className="text-xs mt-2 text-itd-guinda font-medium bg-itd-guinda/5 border border-itd-guinda/20 rounded px-2 py-1">
                {erroresPorCurso[curso.id]}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-itd-navy/5 px-4 py-3 mt-6 text-sm text-itd-navyDark/70">
        <strong>{docente.nombre_completo}</strong> · {docente.email}
      </div>

      <div className="flex justify-between items-center mt-8">
        <button onClick={onRegresar} className="text-sm text-itd-navyDark/60 hover:text-itd-navyDark">
          ← Regresar
        </button>
        <button
          onClick={confirmar}
          disabled={confirmando}
          className="rounded-lg bg-itd-navy text-white px-6 py-2.5 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-50"
        >
          {confirmando ? 'Confirmando…' : 'Confirmar Inscripción'}
        </button>
      </div>
    </div>
  )
}
