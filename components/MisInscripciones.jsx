import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatearRangoFechas, formatearHora } from '../lib/formatoFechas'

export default function MisInscripciones({ docente, onIrAInscribirme }) {
  const [inscripciones, setInscripciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [cancelando, setCancelando] = useState(null)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('inscripciones')
      .select('id, estado, folio_personal, encuesta_completada, asistencia_aprobada, cursos(nombre, fecha_inicio, fecha_fin, hora_inicio, hora_fin, lugar, folio, convocatorias(nombre))')
      .eq('docente_id', docente.id)
      .order('fecha_inscripcion', { ascending: false })
    setInscripciones(data || [])
    setCargando(false)
  }

  async function cancelar(ins) {
    if (!confirm('¿Seguro que quieres cancelar esta inscripción?')) return
    setCancelando(ins.id)
    const { error } = await supabase
      .from('inscripciones')
      .update({ estado: 'cancelado', fecha_cancelacion: new Date().toISOString() })
      .eq('id', ins.id)
    setCancelando(null)

    if (!error) {
      supabase.functions
        .invoke('send-email', {
          body: {
            tipo: 'cancelacion',
            email: docente.email,
            nombre: docente.nombre_completo,
            cursos: [
              {
                nombre: ins.cursos?.nombre,
                folio_personal: ins.folio_personal,
                fechas: formatearRangoFechas(ins.cursos?.fecha_inicio, ins.cursos?.fecha_fin),
                horario: `${formatearHora(ins.cursos?.hora_inicio)} a ${formatearHora(ins.cursos?.hora_fin)} hrs`,
                lugar: ins.cursos?.lugar,
              },
            ],
          },
        })
        .catch(() => {})
      cargar()
    }
  }

  if (cargando) return <p className="text-center text-itd-navyDark/50 py-12">Cargando…</p>

  const encabezado = (
    <div className="flex justify-end mb-4">
      <button
        onClick={onIrAInscribirme}
        className="rounded-lg bg-itd-navy text-white text-sm font-medium px-4 py-2 hover:bg-itd-navyDark transition-colors"
      >
        + Inscribirme a otro curso
      </button>
    </div>
  )

  if (inscripciones.length === 0) {
    return (
      <div>
        {encabezado}
        <div className="text-center py-12 text-itd-navyDark/60">
          Aún no tienes ninguna inscripción registrada.
        </div>
      </div>
    )
  }

  return (
    <div>
      {encabezado}
      <div className="space-y-3">
      {inscripciones.map((ins) => (
        <div
          key={ins.id}
          className="rounded-xl border border-itd-navy/10 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <div>
            <p className="font-medium text-itd-navyDark">{ins.cursos?.nombre}</p>
            <p className="text-xs text-itd-navyDark/60 mt-1">
              {ins.cursos?.convocatorias?.nombre} · Folio {ins.folio_personal || ins.cursos?.folio}
            </p>
            <p className="text-xs text-itd-navyDark/60">
              {formatearRangoFechas(ins.cursos?.fecha_inicio, ins.cursos?.fecha_fin)} · {ins.cursos?.lugar}
            </p>
            <span
              className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                ins.estado === 'activo'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-itd-guinda/10 text-itd-guinda'
              }`}
            >
              {ins.estado === 'activo' ? 'Activo' : 'Cancelado'}
            </span>
          </div>
          {ins.estado === 'activo' && (
            <button
              onClick={() => cancelar(ins)}
              disabled={cancelando === ins.id}
              className="shrink-0 rounded-lg border border-itd-guinda/30 text-itd-guinda px-4 py-2 text-sm font-medium hover:bg-itd-guinda/5 disabled:opacity-50"
            >
              {cancelando === ins.id ? 'Cancelando…' : 'Cancelar'}
            </button>
          )}
        </div>
      ))}
      </div>
    </div>
  )
}
