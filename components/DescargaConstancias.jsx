import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatearRangoFechas } from '../lib/formatoFechas'
import { descargarConstancia } from '../lib/constancias'

function normalizar(texto) {
  return (texto || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export default function DescargaConstancias({ docente }) {
  const [inscripciones, setInscripciones] = useState([])
  const [cursosComoInstructor, setCursosComoInstructor] = useState([])
  const [cargando, setCargando] = useState(true)
  const [generando, setGenerando] = useState(null)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    const hoy = new Date().toISOString().slice(0, 10)

    const [{ data: insData }, { data: cursosData }] = await Promise.all([
      supabase
        .from('inscripciones')
        .select('id, folio_personal, asistencia_aprobada, cursos(id, nombre, fecha_inicio, fecha_fin, horas, folio, tipo, convocatorias(nombre))')
        .eq('docente_id', docente.id)
        .eq('estado', 'activo')
        .order('fecha_inscripcion', { ascending: false }),
      supabase
        .from('cursos')
        .select('id, folio, nombre, instructor, departamento, fecha_inicio, fecha_fin, horas, tipo')
        .not('instructor', 'is', null)
        .lte('fecha_fin', hoy),
    ])

    setInscripciones(insData || [])

    const miNombre = normalizar(docente.nombre_completo)
    const comoInstructor = (cursosData || []).filter((c) => normalizar(c.instructor) === miNombre)
    setCursosComoInstructor(comoInstructor)

    setCargando(false)
  }

  async function descargar(ins) {
    setGenerando(ins.id)
    try {
      await descargarConstancia('constancia', {
        docenteId: docente.id,
        cursoId: ins.cursos?.id,
        nombreCompleto: docente.nombre_completo,
        curso: ins.cursos?.nombre,
        fechaInicio: ins.cursos?.fecha_inicio,
        fechaFin: ins.cursos?.fecha_fin,
        horas: ins.cursos?.horas,
        departamento: docente.departamento,
        folioPersonal: ins.folio_personal,
        tipo: ins.cursos?.tipo,
      })
    } catch (err) {
      console.error(err)
      alert('No se pudo generar la constancia: ' + err.message)
    }
    setGenerando(null)
  }

  async function descargarReconocimiento(curso) {
    setGenerando(curso.id)
    try {
      await descargarConstancia('reconocimiento', {
        docenteId: docente.id,
        cursoId: curso.id,
        nombreCompleto: docente.nombre_completo,
        curso: curso.nombre,
        fechaInicio: curso.fecha_inicio,
        fechaFin: curso.fecha_fin,
        horas: curso.horas,
        departamento: curso.departamento,
        folioPersonal: curso.folio,
        tipo: curso.tipo,
      })
    } catch (err) {
      console.error(err)
      alert('No se pudo generar el reconocimiento: ' + err.message)
    }
    setGenerando(null)
  }

  if (cargando) return <p className="text-center text-itd-navyDark/50 py-12">Cargando…</p>

  const aprobadas = inscripciones.filter((i) => i.asistencia_aprobada === true)
  const pendientes = inscripciones.filter((i) => i.asistencia_aprobada !== true)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
        <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">
          Descarga tus Constancias
        </h2>
        <p className="text-sm text-itd-navyDark/60 mb-6">
          Aquí aparecen los cursos que ya fueron validados con tu asistencia.
        </p>

        {aprobadas.length === 0 ? (
          <p className="text-center text-itd-navyDark/50 py-8">
            Todavía no tienes constancias listas para descargar.
          </p>
        ) : (
          <div className="space-y-3 mb-8">
            {aprobadas.map((ins) => (
              <div
                key={ins.id}
                className="rounded-xl border border-green-200 bg-green-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <p className="font-medium text-sm text-itd-navyDark">{ins.cursos?.nombre}</p>
                  <p className="text-xs text-itd-navyDark/60 mt-1">
                    Folio {ins.folio_personal} · {formatearRangoFechas(ins.cursos?.fecha_inicio, ins.cursos?.fecha_fin)} · {ins.cursos?.horas} hrs
                  </p>
                </div>
                <button
                  onClick={() => descargar(ins)}
                  disabled={generando === ins.id}
                  className="shrink-0 rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-50"
                >
                  {generando === ins.id ? 'Generando…' : '⬇ Descargar constancia'}
                </button>
              </div>
            ))}
          </div>
        )}

        {pendientes.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-itd-navyDark/70 mb-2">
              En espera de validación de asistencia
            </h3>
            <div className="space-y-2">
              {pendientes.map((ins) => (
                <div key={ins.id} className="rounded-lg border border-itd-navy/10 px-4 py-2 text-sm text-itd-navyDark/60">
                  {ins.cursos?.nombre}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {cursosComoInstructor.length > 0 && (
        <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">
            Tus Reconocimientos como Instructor
          </h2>
          <p className="text-sm text-itd-navyDark/60 mb-6">
            Cursos que impartiste y ya concluyeron.
          </p>
          <div className="space-y-3">
            {cursosComoInstructor.map((curso) => (
              <div
                key={curso.id}
                className="rounded-xl border border-purple-200 bg-purple-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <p className="font-medium text-sm text-itd-navyDark">{curso.nombre}</p>
                  <p className="text-xs text-itd-navyDark/60 mt-1">
                    Folio {curso.folio} · {formatearRangoFechas(curso.fecha_inicio, curso.fecha_fin)} · {curso.horas} hrs
                  </p>
                </div>
                <button
                  onClick={() => descargarReconocimiento(curso)}
                  disabled={generando === curso.id}
                  className="shrink-0 rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-50"
                >
                  {generando === curso.id ? 'Generando…' : '⬇ Descargar reconocimiento'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
