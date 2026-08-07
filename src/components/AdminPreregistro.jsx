import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

function formVacio() {
  return {
    oficio_no: '',
    curso: '',
    instructor: '',
    duracion_horas: '',
    modalidad: '',
    fecha_inicio: '',
    fecha_fin: '',
    objetivo: '',
    dirigido_a: '',
    lugar: '',
    nombre_jefe: '',
    jefatura_cargo: '',
  }
}

// Pestaña "Preregistro": captura rápida de un curso (nombre, objetivo,
// periodo, oficio, etc.) para revisarlo antes de darlo de alta formalmente.
// Al aprobar un pendiente, sus datos "pasan" prellenados a la pestaña
// Convocatorias y cursos (vía onAprobar) -- ahí se termina de completar
// folio, convocatoria, tipo y cupo antes de guardarlo como curso real.
export default function AdminPreregistro({ onAprobar }) {
  const [lista, setLista] = useState(null) // null = cargando
  const [formAbierto, setFormAbierto] = useState(false)
  const [form, setForm] = useState(formVacio())
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [verAprobados, setVerAprobados] = useState(false)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const { data } = await supabase
      .from('preregistro_cursos')
      .select('*')
      .order('created_at', { ascending: false })
    setLista(data || [])
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    setErrorMsg('')
    const { error } = await supabase.from('preregistro_cursos').insert({
      ...form,
      duracion_horas: form.duracion_horas ? Number(form.duracion_horas) : null,
    })
    setGuardando(false)
    if (error) {
      setErrorMsg(error.message)
      return
    }
    setForm(formVacio())
    setFormAbierto(false)
    cargar()
  }

  async function borrar(item) {
    if (!confirm(`¿Borrar el preregistro de "${item.curso}"?`)) return
    await supabase.from('preregistro_cursos').delete().eq('id', item.id)
    cargar()
  }

  async function aprobar(item) {
    await supabase.from('preregistro_cursos').update({ estado: 'aprobado' }).eq('id', item.id)
    cargar()
    // Manda los datos ya capturados a Convocatorias y cursos, prellenados.
    onAprobar?.({
      nombre: item.curso,
      instructor: item.instructor || '',
      departamento: item.dirigido_a || '',
      fecha_inicio: item.fecha_inicio || '',
      fecha_fin: item.fecha_fin || '',
      horas: item.duracion_horas || '',
    })
  }

  const pendientes = lista ? lista.filter((i) => i.estado !== 'aprobado') : []
  const aprobados = lista ? lista.filter((i) => i.estado === 'aprobado') : []

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h2 className="font-display text-xl font-semibold text-itd-navy">Preregistro de Cursos</h2>
          <p className="text-sm text-itd-navyDark/60 mt-1">
            Captura rápida para revisar nombre, objetivo y periodo antes de dar de alta el curso formalmente.
          </p>
        </div>
        <button
          onClick={() => setFormAbierto((v) => !v)}
          className="shrink-0 rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark"
        >
          {formAbierto ? 'Cancelar' : '+ Nuevo preregistro'}
        </button>
      </div>

      {formAbierto && (
        <form onSubmit={guardar} className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-itd-navy/10 pt-6">
          {errorMsg && <p className="sm:col-span-2 text-sm text-red-600">{errorMsg}</p>}

          <input
            required
            placeholder="Nombre del curso"
            value={form.curso}
            onChange={(e) => setForm({ ...form, curso: e.target.value })}
            className="sm:col-span-2 rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Objetivo"
            value={form.objetivo}
            onChange={(e) => setForm({ ...form, objetivo: e.target.value })}
            rows={3}
            className="sm:col-span-2 rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          />

          <div>
            <label className="block text-xs text-itd-navyDark/50 mb-1">Fecha inicio</label>
            <input
              type="date"
              value={form.fecha_inicio}
              onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
              className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-itd-navyDark/50 mb-1">Fecha fin</label>
            <input
              type="date"
              value={form.fecha_fin}
              onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
              className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
            />
          </div>

          <input
            placeholder="Instructor"
            value={form.instructor}
            onChange={(e) => setForm({ ...form, instructor: e.target.value })}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          />
          <input
            placeholder="Duración (horas)"
            type="number"
            value={form.duracion_horas}
            onChange={(e) => setForm({ ...form, duracion_horas: e.target.value })}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          />
          <input
            placeholder="Modalidad"
            value={form.modalidad}
            onChange={(e) => setForm({ ...form, modalidad: e.target.value })}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          />
          <input
            placeholder="Lugar"
            value={form.lugar}
            onChange={(e) => setForm({ ...form, lugar: e.target.value })}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          />
          <input
            placeholder="Dirigido a (departamento)"
            value={form.dirigido_a}
            onChange={(e) => setForm({ ...form, dirigido_a: e.target.value })}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          />
          <input
            placeholder="No. de oficio"
            value={form.oficio_no}
            onChange={(e) => setForm({ ...form, oficio_no: e.target.value })}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          />
          <input
            placeholder="Nombre del jefe(a) que solicita"
            value={form.nombre_jefe}
            onChange={(e) => setForm({ ...form, nombre_jefe: e.target.value })}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          />
          <input
            placeholder="Cargo del jefe(a)"
            value={form.jefatura_cargo}
            onChange={(e) => setForm({ ...form, jefatura_cargo: e.target.value })}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          />

          <button
            type="submit"
            disabled={guardando}
            className="sm:col-span-2 rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar preregistro'}
          </button>
        </form>
      )}

      <div className="mt-8">
        <h3 className="text-sm font-semibold text-itd-navyDark/70 mb-3">
          Pendientes de revisar {lista && `(${pendientes.length})`}
        </h3>

        {!lista ? (
          <p className="text-center text-itd-navyDark/50 py-6">Cargando…</p>
        ) : pendientes.length === 0 ? (
          <p className="text-sm text-itd-navyDark/40 py-2">No hay preregistros pendientes.</p>
        ) : (
          <div className="space-y-3">
            {pendientes.map((item) => (
              <div key={item.id} className="rounded-xl border border-itd-navy/10 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-itd-navyDark">{item.curso}</p>
                    {item.objetivo && <p className="text-sm text-itd-navyDark/60 mt-1">{item.objetivo}</p>}
                    <p className="text-xs text-itd-navyDark/50 mt-2">
                      {item.fecha_inicio && item.fecha_fin
                        ? `${item.fecha_inicio} al ${item.fecha_fin}`
                        : 'Sin fechas capturadas'}
                      {item.instructor && ` · ${item.instructor}`}
                      {item.dirigido_a && ` · ${item.dirigido_a}`}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => aprobar(item)}
                      className="rounded-lg bg-itd-navy text-white px-3 py-1.5 text-xs font-medium hover:bg-itd-navyDark whitespace-nowrap"
                    >
                      Aprobar y pasar →
                    </button>
                    <button
                      onClick={() => borrar(item)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {aprobados.length > 0 && (
        <div className="mt-8 border-t border-itd-navy/10 pt-4">
          <button
            onClick={() => setVerAprobados((v) => !v)}
            className="text-xs text-itd-navyDark/50 hover:underline"
          >
            {verAprobados ? 'Ocultar' : 'Ver'} ya aprobados ({aprobados.length})
          </button>
          {verAprobados && (
            <div className="mt-3 space-y-1">
              {aprobados.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs text-itd-navyDark/50 py-1">
                  <span>{item.curso}</span>
                  <button onClick={() => borrar(item)} className="text-red-600 hover:underline">Borrar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
