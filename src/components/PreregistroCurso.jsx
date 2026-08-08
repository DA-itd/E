import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const DEPARTAMENTOS = [
  'DEPARTAMENTO INGENIERÍA ELÉCTRICA - ELECTRÓNICA',
  'DEPARTAMENTO CIENCIAS DE LA TIERRA',
  'DEPARTAMENTO CIENCIAS ECONÓMICO ADMINISTRATIVAS',
  'DEPARTAMENTO DESARROLLO ACADÉMICO',
  'DEPARTAMENTO SISTEMAS Y COMPUTACION',
  'DEPARTAMENTO META-MECÁNICA',
  'DEPARTAMENTO DE INGENIERÍA INDUSTRIAL',
  'LABORATORIO DE INGENIERÍAS QUÍMICA-BIOQUÍMICA',
  'DIVISION DE ESTUDIOS DE POSGRADO E INVESTIGACION',
  'DEPARTAMENTO DE CIENCIAS BÁSICAS',
]

const MODALIDADES = ['Presencial', 'Virtual', 'Mixta']

function formVacio() {
  return {
    curso: '',
    objetivo: '',
    periodo: '',
    duracion_horas: '',
    modalidad: '',
    lugar: '',
    dirigido_a: '',
    nombre_jefe: '',
  }
}

const ESTADO_LABEL = {
  pendiente: { texto: 'En revisión', clase: 'bg-amber-100 text-amber-700' },
  aprobado: { texto: 'Aprobado', clase: 'bg-green-100 text-green-700' },
}

function etiquetaPeriodo(p) {
  if (p === 'PERIODO_1') return 'Periodo 1'
  if (p === 'PERIODO_2') return 'Periodo 2'
  return p
}

// Formulario para que el propio docente proponga un curso a impartir
// (nombre, objetivo, periodo, etc.). La Coordinación revisa esto en
// Administración -> Preregistro, y ahí asigna si es tipo Docente o
// Profesional antes de darlo de alta formalmente en Convocatorias.
export default function PreregistroCurso({ docente }) {
  const [misPreregistros, setMisPreregistros] = useState(null)
  const [formAbierto, setFormAbierto] = useState(false)
  const [form, setForm] = useState(formVacio())
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const { data } = await supabase
      .from('preregistro_cursos')
      .select('*')
      .eq('docente_id', docente.id)
      .order('created_at', { ascending: false })
    setMisPreregistros(data || [])
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    setErrorMsg('')
    const { error } = await supabase.from('preregistro_cursos').insert({
      ...form,
      docente_id: docente.id,
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

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h2 className="font-display text-xl font-semibold text-itd-navy">Preregistro de Curso</h2>
          <p className="text-sm text-itd-navyDark/60 mt-1">
            Propón un curso para impartir. La Coordinación de Actualización Docente lo revisa y confirma
            antes de abrir inscripciones.
          </p>
        </div>
        <button
          onClick={() => setFormAbierto((v) => !v)}
          className="shrink-0 rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark"
        >
          {formAbierto ? 'Cancelar' : '+ Proponer curso'}
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
            required
            placeholder="Objetivo del curso"
            value={form.objetivo}
            onChange={(e) => setForm({ ...form, objetivo: e.target.value })}
            rows={3}
            className="sm:col-span-2 rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          />

          <select
            required
            value={form.periodo}
            onChange={(e) => setForm({ ...form, periodo: e.target.value })}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          >
            <option value="">Periodo…</option>
            <option value="PERIODO_1">Periodo 1</option>
            <option value="PERIODO_2">Periodo 2</option>
          </select>

          <input
            placeholder="Duración (horas)"
            type="number"
            value={form.duracion_horas}
            onChange={(e) => setForm({ ...form, duracion_horas: e.target.value })}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          />

          <select
            value={form.modalidad}
            onChange={(e) => setForm({ ...form, modalidad: e.target.value })}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          >
            <option value="">Modalidad…</option>
            {MODALIDADES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <input
            placeholder="Lugar"
            value={form.lugar}
            onChange={(e) => setForm({ ...form, lugar: e.target.value })}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          />

          <select
            value={form.dirigido_a}
            onChange={(e) => setForm({ ...form, dirigido_a: e.target.value })}
            className="sm:col-span-2 rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          >
            <option value="">Departamento…</option>
            {DEPARTAMENTOS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <input
            placeholder="Nombre del jefe(a) de departamento"
            value={form.nombre_jefe}
            onChange={(e) => setForm({ ...form, nombre_jefe: e.target.value })}
            className="sm:col-span-2 rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          />

          <button
            type="submit"
            disabled={guardando}
            className="sm:col-span-2 rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-50"
          >
            {guardando ? 'Enviando…' : 'Enviar propuesta'}
          </button>
        </form>
      )}

      <div className="mt-8">
        <h3 className="text-sm font-semibold text-itd-navyDark/70 mb-3">Mis propuestas</h3>
        {!misPreregistros ? (
          <p className="text-center text-itd-navyDark/50 py-6">Cargando…</p>
        ) : misPreregistros.length === 0 ? (
          <p className="text-sm text-itd-navyDark/40 py-2">Todavía no has propuesto ningún curso.</p>
        ) : (
          <div className="space-y-3">
            {misPreregistros.map((item) => {
              const estado = ESTADO_LABEL[item.estado] || ESTADO_LABEL.pendiente
              return (
                <div key={item.id} className="rounded-xl border border-itd-navy/10 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-itd-navyDark">{item.curso}</p>
                      <p className="text-xs text-itd-navyDark/50 mt-1">{etiquetaPeriodo(item.periodo)}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${estado.clase}`}>
                      {estado.texto}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
