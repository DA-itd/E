import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import GestionInscritosCurso from './GestionInscritosCurso'

const TIPOS_CURSO = ['Docente', 'Profesional']

function formVacioConvocatoria() {
  return {
    nombre: '', anio: new Date().getFullYear(), mes: 1, fecha_inicio: '', fecha_fin: '',
    periodo1_inicio: '', periodo1_fin: '', periodo2_inicio: '', periodo2_fin: '',
  }
}

function formVacioCurso(convocatoriaId) {
  return {
    convocatoria_id: convocatoriaId,
    folio: '',
    semana: '',
    nombre: '',
    instructor: '',
    departamento: '',
    fecha_inicio: '',
    fecha_fin: '',
    horas: '',
    horario: '',
    tipo: 'Docente',
    cupo_max: 30,
    status: 'borrador', // 'borrador' = aprobado pero no visible para inscripción; 'activo' = publicado
  }
}

const HORARIOS = ['09:00 A 15:00 HRS', '15:00 A 20:00 HRS']

export default function AdminConvocatorias({ prefill, onPrefillConsumido }) {
  const [convocatorias, setConvocatorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [expandidaId, setExpandidaId] = useState(null)
  const [verInactivas, setVerInactivas] = useState(false)
  const [cursosPorConvocatoria, setCursosPorConvocatoria] = useState({})

  const [formConvocatoria, setFormConvocatoria] = useState(null) // null = cerrado; objeto = editando/creando
  const [formCurso, setFormCurso] = useState(null)
  const [gestionInscritosCursoId, setGestionInscritosCursoId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [anioFolio, setAnioFolio] = useState(new Date().getFullYear())
  const [mostrarAnioFolio, setMostrarAnioFolio] = useState(false)
  const [archivandoId, setArchivandoId] = useState(null)
  const [conteoInscripcionesPorConv, setConteoInscripcionesPorConv] = useState({})

  // Octubre a diciembre se lanza la convocatoria de enero del año siguiente,
  // así que en esos meses hay que poder elegir el año del folio. El resto
  // del año se usa el año actual sin preguntar.
  async function folioSugeridoPara(anio) {
    const { data } = await supabase.rpc('siguiente_folio_curso', { anio })
    return data || ''
  }

  async function regenerarFolio(anio) {
    const folio = await folioSugeridoPara(anio)
    setAnioFolio(anio)
    setFormCurso((prev) => (prev ? { ...prev, folio: folio || prev.folio } : prev))
  }

  useEffect(() => {
    cargarConvocatorias()
  }, [])

  async function cargarConvocatorias() {
    setCargando(true)
    const { data } = await supabase
      .from('convocatorias')
      .select('*')
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
    setConvocatorias(data || [])
    setCargando(false)
    cargarConteoInscripciones()
  }

  // Cuántas inscripciones activas le quedan a cada convocatoria, para saber
  // si ya se archivó (0 = ya archivada, o nunca tuvo cursos con inscritos).
  async function cargarConteoInscripciones() {
    const { data } = await supabase
      .from('inscripciones')
      .select('id, cursos!inner(convocatoria_id)')
      .eq('estado', 'activo')
    const conteo = {}
    ;(data || []).forEach((i) => {
      const cid = i.cursos?.convocatoria_id
      if (cid) conteo[cid] = (conteo[cid] || 0) + 1
    })
    setConteoInscripcionesPorConv(conteo)
  }

  async function cargarCursos(convocatoriaId) {
    const { data } = await supabase
      .from('cursos')
      .select('*')
      .eq('convocatoria_id', convocatoriaId)
      .order('nombre')
    setCursosPorConvocatoria((prev) => ({ ...prev, [convocatoriaId]: data || [] }))
  }

  async function alExpandir(convocatoriaId) {
    if (expandidaId === convocatoriaId) {
      setExpandidaId(null)
      return
    }
    setExpandidaId(convocatoriaId)
    if (!cursosPorConvocatoria[convocatoriaId]) await cargarCursos(convocatoriaId)
  }

  async function alternarActivoConvocatoria(conv) {
    setErrorMsg('')
    const { error } = await supabase
      .from('convocatorias')
      .update({ activo: !conv.activo })
      .eq('id', conv.id)
    if (error) {
      setErrorMsg('No se pudo actualizar: ' + error.message)
      return
    }
    cargarConvocatorias()
  }

  async function archivarInscripciones(conv) {
    if (
      !confirm(
        `¿Archivar TODAS las inscripciones activas de "${conv.nombre}" a historial?\n\n` +
        `Esto las mueve de "inscripciones" a "inscripciones_historial" y las borra de la ` +
        `tabla activa (dejan de contar en el reporte del periodo actual, y de aparecer en ` +
        `Descarga de Constancias / Asistencia).\n\n` +
        `Solo funciona si TODAS las inscripciones activas de esta convocatoria ya tienen ` +
        `asistencia revisada (Sí o No, ninguna en blanco). Si falta alguna por revisar, ` +
        `esta acción de archivado se detiene sola y no mueve ni borra nada — ninguna ` +
        `inscripción se cancela ni se modifica.`
      )
    ) return

    setArchivandoId(conv.id)
    setErrorMsg('')
    const { data, error } = await supabase.rpc('archivar_convocatoria_a_historial', {
      p_convocatoria_id: conv.id,
    })
    setArchivandoId(null)

    if (error) {
      setErrorMsg('No se archivó: ' + error.message)
      return
    }

    alert(`Se archivaron ${data} inscripción(es) a historial.`)
    setCursosPorConvocatoria((prev) => ({ ...prev, [conv.id]: undefined }))
    cargarConvocatorias()
  }

  async function guardarCurso(e) {
    e.preventDefault()
    setGuardando(true)
    setErrorMsg('')
    const datos = {
      ...formCurso,
      cupo_max: Number(formCurso.cupo_max),
      horas: Number(formCurso.horas),
    }
    const esNuevo = !datos.id
    const query = esNuevo
      ? supabase.from('cursos').insert(datos)
      : supabase.from('cursos').update(datos).eq('id', datos.id)
      
    const { error } = await query
    setGuardando(false)
    if (error) {
      if (error.code === '23505') {
        setErrorMsg(`El folio "${datos.folio}" ya está en uso. Usa otro folio.`)
      } else {
        setErrorMsg('No se pudo guardar el curso: ' + error.message)
      }
      return
    }
    setFormCurso(null)
    cargarCursos(datos.convocatoria_id)
  }

  async function guardarConvocatoria(e) {
    e.preventDefault()
    setGuardando(true)
    setErrorMsg('')
    const datos = {
      ...formConvocatoria,
      anio: Number(formConvocatoria.anio),
      mes: Number(formConvocatoria.mes),
      periodo1_inicio: formConvocatoria.periodo1_inicio || null,
      periodo1_fin: formConvocatoria.periodo1_fin || null,
      periodo2_inicio: formConvocatoria.periodo2_inicio || null,
      periodo2_fin: formConvocatoria.periodo2_fin || null,
      // La fecha general de la convocatoria ya no se captura a mano --
      // se calcula sola: desde el inicio del Periodo 1 hasta el fin del
      // Periodo 2.
      fecha_inicio: formConvocatoria.periodo1_inicio || formConvocatoria.periodo2_inicio || null,
      fecha_fin: formConvocatoria.periodo2_fin || formConvocatoria.periodo1_fin || null,
    }
    const esNueva = !datos.id

    const query = esNueva
      ? supabase.from('convocatorias').insert({ ...datos, activo: true })
      : supabase.from('convocatorias').update(datos).eq('id', datos.id)

    const { error } = await query
    setGuardando(false)
    if (error) {
      if (error.code === '23505') {
        setErrorMsg(`Ya existe una convocatoria "${datos.nombre}" ${datos.anio} (puede estar dada de baja). Actívala en "Ver también las dadas de baja" y edítala, o usa un nombre distinto.`)
      } else {
        setErrorMsg('No se pudo guardar la convocatoria: ' + error.message)
      }
      return
    }
    setFormConvocatoria(null)
    cargarConvocatorias()
  }

  async function eliminarConvocatoria(conv) {
    if (
      !confirm(
        `¿Eliminar por completo la convocatoria "${conv.nombre}"?\n\n` +
        `Esto SOLO funciona si no tiene ningún curso dado de alta — si ya tiene cursos, ` +
        `la base de datos va a rechazar el borrado y no se perderá nada.\n\n` +
        `Si lo que quieres es retirarla de la vista de inscripción sin perder su información, ` +
        `usa "Dar de baja" en vez de "Eliminar".`
      )
    ) return
    setErrorMsg('')
    
    // First, clear this convocatoria from any docente that has it as their "ultima_convocatoria_confirmada_id"
    const { error: errorDocentes } = await supabase
      .from('docentes')
      .update({ ultima_convocatoria_confirmada_id: null })
      .eq('ultima_convocatoria_confirmada_id', conv.id)
      
    if (errorDocentes) {
      setErrorMsg('No se pudieron desenlazar los docentes que confirmaron datos en esta convocatoria: ' + errorDocentes.message)
      return
    }

    // Now attempt to delete the convocatoria
    const { error } = await supabase.from('convocatorias').delete().eq('id', conv.id)
    if (error) {
      if (error.message.includes('violates foreign key constraint')) {
         setErrorMsg('No se pudo eliminar la convocatoria porque aún hay registros en el sistema que dependen de ella. Refresca la página e inténtalo de nuevo.');
      } else {
         setErrorMsg('No se pudo eliminar: ' + error.message)
      }
      return
    }
    cargarConvocatorias()
  }

  async function eliminarCurso(curso) {
    if (!confirm(`¿Eliminar el curso "${curso.nombre}"? Esto eliminará también TODAS las inscripciones asociadas a este curso de forma irreversible.`)) return
    setErrorMsg('')
    
    // First, delete all enrollments (inscripciones) linked to this course to satisfy foreign key constraints.
    const { error: errorInscripciones } = await supabase.from('inscripciones').delete().eq('curso_id', curso.id)
    if (errorInscripciones) {
      setErrorMsg('No se pudieron limpiar las inscripciones previas: ' + errorInscripciones.message)
      return
    }

    // Now it is safe to delete the course.
    const { error } = await supabase.from('cursos').delete().eq('id', curso.id)
    if (error) {
      setErrorMsg('No se pudo eliminar el curso: ' + error.message)
      return
    }
    cargarCursos(curso.convocatoria_id)
  }

  async function alternarPublicacion(curso) {
    setErrorMsg('')
    const nuevoStatus = curso.status === 'activo' ? 'borrador' : 'activo'
    const { error } = await supabase.from('cursos').update({ status: nuevoStatus }).eq('id', curso.id)
    if (error) {
      setErrorMsg('No se pudo actualizar la publicación: ' + error.message)
      return
    }
    cargarCursos(curso.convocatoria_id)
  }

  async function alternarCierreCurso(curso) {
    setErrorMsg('')
    const { error } = await supabase
      .from('cursos')
      .update({ cerrado_manualmente: !curso.cerrado_manualmente })
      .eq('id', curso.id)
    if (error) {
      setErrorMsg('No se pudo actualizar el cierre: ' + error.message)
      return
    }
    cargarCursos(curso.convocatoria_id)
  }

  if (cargando) return <p className="text-center text-itd-navyDark/50 py-12">Cargando…</p>

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-xl font-semibold text-itd-navy">Convocatorias y Cursos</h2>
          <button
            onClick={() => setFormConvocatoria(formVacioConvocatoria())}
            className="rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark"
          >
            + Nueva convocatoria
          </button>
        </div>
        <p className="text-sm text-itd-navyDark/60 mb-1">
          Da de alta/baja convocatorias, agrega o edita cursos, y cierra inscripciones manualmente.
        </p>
        <label className="flex items-center gap-2 text-xs text-itd-navyDark/50 mb-4 cursor-pointer w-fit">
          <input type="checkbox" checked={verInactivas} onChange={(e) => setVerInactivas(e.target.checked)} />
          Ver también las dadas de baja
          <span className="text-itd-navyDark/35">(un nombre + año dado de baja sigue "ocupado": no puedes crear otra convocatoria igual sin reactivarla o borrarla primero)</span>
        </label>

        {errorMsg && <p className="text-sm text-itd-guinda mb-4">{errorMsg}</p>}

        {prefill && (
          <div className="rounded-xl border border-itd-gold/40 bg-itd-gold/10 p-4 mb-6 text-sm">
            <p className="font-medium text-itd-navyDark">
              Vienes de Preregistro con datos de "<strong>{prefill.nombre}</strong>" listos para usar.
            </p>
            <p className="text-itd-navyDark/60 mt-1">
              Abre (o crea) la convocatoria a la que pertenece y da clic en "+ Agregar curso" — el
              formulario se va a llenar solo con lo que ya capturaste. Solo te va a faltar folio, semana,
              tipo y cupo.
            </p>
          </div>
        )}

        {formConvocatoria && (
          <form onSubmit={guardarConvocatoria} className="rounded-xl border border-itd-navy/20 bg-itd-sand/40 p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              required
              placeholder="Nombre de la convocatoria"
              value={formConvocatoria.nombre}
              onChange={(e) => setFormConvocatoria({ ...formConvocatoria, nombre: e.target.value })}
              className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              required type="number" placeholder="Año"
              value={formConvocatoria.anio}
              onChange={(e) => setFormConvocatoria({ ...formConvocatoria, anio: e.target.value })}
              className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
            />
            <select
              value={formConvocatoria.mes}
              onChange={(e) => setFormConvocatoria({ ...formConvocatoria, mes: Number(e.target.value) })}
              className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
            >
              <option value={1}>Enero</option>
              <option value={2}>Febrero</option>
              <option value={3}>Marzo</option>
              <option value={4}>Abril</option>
              <option value={5}>Mayo</option>
              <option value={6}>Junio</option>
              <option value={7}>Julio</option>
              <option value={8}>Agosto</option>
              <option value={9}>Septiembre</option>
              <option value={10}>Octubre</option>
              <option value={11}>Noviembre</option>
              <option value={12}>Diciembre</option>
            </select>

            <div className="sm:col-span-2 rounded-lg bg-itd-sand/60 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <p className="sm:col-span-2 text-xs font-semibold text-itd-navyDark/70">
                Fechas Generales de la Convocatoria (Estas definen si aparece en el portal)
              </p>
              <label className="text-xs text-itd-navyDark/60">
                Fecha de inicio general
                <input
                  type="date"
                  required
                  value={formConvocatoria.fecha_inicio || ''}
                  onChange={(e) => setFormConvocatoria({ ...formConvocatoria, fecha_inicio: e.target.value })}
                  className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm mt-1 bg-white"
                />
              </label>
              <label className="text-xs text-itd-navyDark/60">
                Fecha de fin general
                <input
                  type="date"
                  required
                  value={formConvocatoria.fecha_fin || ''}
                  onChange={(e) => setFormConvocatoria({ ...formConvocatoria, fecha_fin: e.target.value })}
                  className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm mt-1 bg-white"
                />
              </label>

              <p className="sm:col-span-2 text-xs font-semibold text-itd-navyDark/70 mt-2">
                Fechas de cada periodo (Opcional - para que los cursos se agrupen automáticamente)
              </p>
              <label className="text-xs text-itd-navyDark/60">
                Periodo 1 — inicio
                <input
                  type="date"
                  value={formConvocatoria.periodo1_inicio || ''}
                  onChange={(e) => setFormConvocatoria({ ...formConvocatoria, periodo1_inicio: e.target.value })}
                  className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm mt-1"
                />
              </label>
              <label className="text-xs text-itd-navyDark/60">
                Periodo 1 — fin
                <input
                  type="date"
                  value={formConvocatoria.periodo1_fin || ''}
                  onChange={(e) => setFormConvocatoria({ ...formConvocatoria, periodo1_fin: e.target.value })}
                  className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm mt-1"
                />
              </label>
              <label className="text-xs text-itd-navyDark/60">
                Periodo 2 — inicio
                <input
                  type="date"
                  value={formConvocatoria.periodo2_inicio || ''}
                  onChange={(e) => setFormConvocatoria({ ...formConvocatoria, periodo2_inicio: e.target.value })}
                  className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm mt-1"
                />
              </label>
              <label className="text-xs text-itd-navyDark/60">
                Periodo 2 — fin
                <input
                  type="date"
                  value={formConvocatoria.periodo2_fin || ''}
                  onChange={(e) => setFormConvocatoria({ ...formConvocatoria, periodo2_fin: e.target.value })}
                  className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm mt-1"
                />
              </label>
            </div>

            <div className="sm:col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setFormConvocatoria(null)} className="rounded-lg px-4 py-2 text-sm text-itd-navyDark/60">Cancelar</button>
              <button type="submit" disabled={guardando} className="rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {convocatorias
            .filter((c) => verInactivas || c.activo)
            .map((conv) => (
            <div key={conv.id} className="rounded-xl border border-itd-navy/10 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 bg-white">
                <button onClick={() => alExpandir(conv.id)} className="text-left flex-1 group">
                  <p className="font-semibold text-sm text-itd-navy group-hover:underline">
                    {expandidaId === conv.id ? '▾ Ocultar cursos' : '▸ Ver / editar cursos'}
                    {!conv.activo && <span className="ml-2 text-xs text-itd-guinda">(inactiva)</span>}
                  </p>
                  <p className="text-xs text-itd-navyDark/60 mt-0.5">
                    {conv.nombre} · {conv.fecha_inicio} a {conv.fecha_fin}
                  </p>
                </button>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    onClick={() => setFormConvocatoria({
                      ...conv,
                      periodo1_inicio: conv.periodo1_inicio || '',
                      periodo1_fin: conv.periodo1_fin || '',
                      periodo2_inicio: conv.periodo2_inicio || '',
                      periodo2_fin: conv.periodo2_fin || '',
                    })}
                    className="text-xs text-itd-navyDark/50 underline decoration-dotted hover:text-itd-navy"
                    title="Solo para cambiar el nombre, año o fechas de periodo de la convocatoria (se hace pocas veces al año)"
                  >
                    Editar fechas de convocatoria
                  </button>
                  <button
                    onClick={() => alternarActivoConvocatoria(conv)}
                    className="text-xs rounded-lg border border-itd-navy/20 px-3 py-1.5 hover:bg-itd-sand"
                    title="Reversible: solo la oculta de la vista de inscripción, no borra nada"
                  >
                    {conv.activo ? 'Dar de baja' : 'Dar de alta'}
                  </button>
                  {(conteoInscripcionesPorConv[conv.id] || 0) === 0 ? (
                    <span
                      className="text-xs font-semibold text-green-700 bg-green-100 border border-green-300 px-3 py-1.5 rounded-lg"
                      title="Esta convocatoria ya no tiene inscripciones activas (se archivaron, o nunca tuvo)"
                    >
                      ✓ Archivada
                    </span>
                  ) : (
                    <button
                      onClick={() => archivarInscripciones(conv)}
                      disabled={archivandoId === conv.id}
                      className="text-xs rounded-lg border border-amber-400/50 text-amber-700 px-3 py-1.5 hover:bg-amber-50 disabled:opacity-50"
                      title="Mueve las inscripciones activas de esta convocatoria a historial. Solo funciona si todas ya tienen asistencia revisada."
                    >
                      {archivandoId === conv.id ? 'Archivando…' : 'Archivar a historial'}
                    </button>
                  )}
                  <button
                    onClick={() => eliminarConvocatoria(conv)}
                    className="text-xs rounded-lg border border-itd-guinda/30 text-itd-guinda px-3 py-1.5 hover:bg-itd-guinda/5"
                    title="Solo funciona si la convocatoria no tiene cursos; si ya tiene, no hace nada"
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              {expandidaId === conv.id && (
                <div className="border-t border-itd-navy/10 bg-itd-sand/30 p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-itd-navyDark/70">Cursos de esta convocatoria</h3>
                    <button
                      onClick={async () => {
                        const base = formVacioCurso(conv.id)
                        let datos = prefill ? { ...base, ...prefill, convocatoria_id: conv.id } : base
                        if (prefill?.semana === 'PERIODO_1') {
                          datos = { ...datos, fecha_inicio: conv.periodo1_inicio || '', fecha_fin: conv.periodo1_fin || '' }
                        } else if (prefill?.semana === 'PERIODO_2') {
                          datos = { ...datos, fecha_inicio: conv.periodo2_inicio || '', fecha_fin: conv.periodo2_fin || '' }
                        }

                        const hoy = new Date()
                        const anioActual = hoy.getFullYear()
                        const enZonaAmbigua = hoy.getMonth() + 1 >= 10 // oct, nov, dic
                        const anioSugerido = enZonaAmbigua ? anioActual + 1 : anioActual

                        setMostrarAnioFolio(enZonaAmbigua)
                        setAnioFolio(anioSugerido)
                        // Si ya viene un folio confirmado desde Preregistro, se respeta;
                        // solo se genera uno nuevo si se crea el curso directo desde aquí.
                        const folio = datos.folio || (await folioSugeridoPara(anioSugerido))

                        setFormCurso({ ...datos, folio: folio || datos.folio })
                        if (prefill) onPrefillConsumido?.()
                      }}
                      className="text-xs rounded-lg bg-itd-navy text-white px-3 py-1.5"
                    >
                      + Nuevo curso
                    </button>
                  </div>

                  {formCurso && formCurso.convocatoria_id === conv.id && (
                    <form onSubmit={guardarCurso} className="rounded-xl border border-itd-navy/20 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex gap-2">
                        <input
                          required
                          placeholder="Folio"
                          value={formCurso.folio || ''}
                          onChange={(e) => setFormCurso({ ...formCurso, folio: e.target.value })}
                          className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm flex-1"
                        />
                        {mostrarAnioFolio && (
                          <select
                            value={anioFolio}
                            onChange={(e) => regenerarFolio(Number(e.target.value))}
                            title="Año del folio (oct-dic: confirma si es de este año o el que entra)"
                            className="rounded-lg border border-itd-navy/20 px-2 py-2 text-sm"
                          >
                            <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                            <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
                          </select>
                        )}
                      </div>
                      <input
                        list="opciones-periodo"
                        required
                        placeholder="Periodo o Semana"
                        value={formCurso.semana || ''}
                        onChange={(e) => {
                          const periodo = e.target.value
                          const conv = convocatorias.find((c) => c.id === formCurso.convocatoria_id)
                          const auto =
                            periodo === 'PERIODO_1' || periodo === 'Periodo 1'
                              ? { fecha_inicio: conv?.periodo1_inicio || '', fecha_fin: conv?.periodo1_fin || '' }
                              : periodo === 'PERIODO_2' || periodo === 'Periodo 2'
                              ? { fecha_inicio: conv?.periodo2_inicio || '', fecha_fin: conv?.periodo2_fin || '' }
                              : {}
                          setFormCurso({ ...formCurso, semana: periodo, ...auto })
                        }}
                        className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
                      />
                      <datalist id="opciones-periodo">
                        <option value="Periodo 1" />
                        <option value="Periodo 2" />
                        <option value="Extemporáneo" />
                      </datalist>
                      <input required placeholder="Nombre del curso" value={formCurso.nombre || ''} onChange={(e) => setFormCurso({ ...formCurso, nombre: e.target.value })} className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm sm:col-span-2" />
                      <input placeholder="Instructor" value={formCurso.instructor || ''} onChange={(e) => setFormCurso({ ...formCurso, instructor: e.target.value })} className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm" />
                      <input placeholder="Departamento" value={formCurso.departamento || ''} onChange={(e) => setFormCurso({ ...formCurso, departamento: e.target.value })} className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm" />
                      <textarea
                        placeholder="Objetivo del curso (aparece en el Programa Institucional)"
                        value={formCurso.objetivo || ''}
                        onChange={(e) => setFormCurso({ ...formCurso, objetivo: e.target.value })}
                        rows={2}
                        className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm sm:col-span-2"
                      />
                      <label className="text-xs text-itd-navyDark/60">
                        Fecha inicio
                        <input required type="date" value={formCurso.fecha_inicio || ''} onChange={(e) => setFormCurso({ ...formCurso, fecha_inicio: e.target.value })} className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm mt-1" />
                      </label>
                      <label className="text-xs text-itd-navyDark/60">
                        Fecha fin
                        <input required type="date" value={formCurso.fecha_fin || ''} onChange={(e) => setFormCurso({ ...formCurso, fecha_fin: e.target.value })} className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm mt-1" />
                      </label>
                      <input required type="number" placeholder="Horas" value={formCurso.horas || ''} onChange={(e) => setFormCurso({ ...formCurso, horas: e.target.value })} className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm" />
                      <input required type="number" placeholder="Cupo máximo" value={formCurso.cupo_max || ''} onChange={(e) => setFormCurso({ ...formCurso, cupo_max: e.target.value })} className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm" />
                      <select required value={formCurso.horario || ''} onChange={(e) => setFormCurso({ ...formCurso, horario: e.target.value })} className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm">
                        <option value="">Horario…</option>
                        {HORARIOS.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                      <select value={formCurso.tipo || 'Docente'} onChange={(e) => setFormCurso({ ...formCurso, tipo: e.target.value })} className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm sm:col-span-2">
                        {TIPOS_CURSO.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <div className="sm:col-span-2 flex gap-2 justify-end">
                        <button type="button" onClick={() => setFormCurso(null)} className="rounded-lg px-4 py-2 text-sm text-itd-navyDark/60">Cancelar</button>
                        <button type="submit" disabled={guardando} className="rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
                          {guardando ? 'Guardando…' : 'Guardar'}
                        </button>
                      </div>
                    </form>
                  )}

                  {(cursosPorConvocatoria[conv.id] || []).map((curso) => (
                    <div key={curso.id} className="rounded-lg border border-itd-navy/10 bg-white p-3 flex flex-col gap-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-itd-navyDark">
                            {curso.nombre}
                            {curso.status !== 'activo' && <span className="ml-2 text-xs text-amber-600">(borrador · no visible)</span>}
                            {curso.cerrado_manualmente && <span className="ml-2 text-xs text-itd-guinda">(inscripciones cerradas)</span>}
                          </p>
                          <p className="text-xs text-itd-navyDark/60">
                            Folio {curso.folio} · {curso.tipo} · {curso.horas} hrs · {curso.horario || 'sin horario'} · cupo <strong className="text-itd-navy">{curso.cupo_max}</strong>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          <button 
                            onClick={() => setGestionInscritosCursoId(gestionInscritosCursoId === curso.id ? null : curso.id)} 
                            className={`text-xs rounded-lg px-3 py-1.5 font-medium ${gestionInscritosCursoId === curso.id ? 'bg-itd-sand border border-itd-navy/20' : 'border border-itd-navy/20 hover:bg-itd-sand'}`}
                          >
                            Inscritos
                          </button>
                          <button 
                            onClick={() => setFormCurso({
                              ...curso,
                              semana: curso.semana || '',
                              instructor: curso.instructor || '',
                              departamento: curso.departamento || '',
                              objetivo: curso.objetivo || '',
                              fecha_inicio: curso.fecha_inicio || '',
                              fecha_fin: curso.fecha_fin || '',
                              horas: curso.horas || '',
                              horario: curso.horario || ''
                            })} 
                            className="text-xs rounded-lg border border-itd-navy/20 px-3 py-1.5 hover:bg-itd-sand"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => alternarPublicacion(curso)}
                            className={`text-xs rounded-lg px-3 py-1.5 font-medium ${
                              curso.status === 'activo'
                                ? 'border border-itd-navy/20 hover:bg-itd-sand'
                                : 'bg-itd-navy text-white hover:bg-itd-navyDark'
                            }`}
                          >
                            {curso.status === 'activo' ? 'Ocultar' : 'Publicar →'}
                          </button>
                          <button onClick={() => alternarCierreCurso(curso)} className="text-xs rounded-lg border border-itd-navy/20 px-3 py-1.5 hover:bg-itd-sand">
                            {curso.cerrado_manualmente ? 'Reabrir' : 'Cerrar inscripciones'}
                          </button>
                          <button onClick={() => eliminarCurso(curso)} className="text-xs rounded-lg border border-itd-guinda/30 text-itd-guinda px-3 py-1.5 hover:bg-itd-guinda/5">Eliminar</button>
                        </div>
                      </div>
                      
                      {gestionInscritosCursoId === curso.id && (
                        <GestionInscritosCurso cursoId={curso.id} />
                      )}
                    </div>
                  ))}

                  {(cursosPorConvocatoria[conv.id] || []).length === 0 && (
                    <p className="text-sm text-itd-navyDark/50 text-center py-4">Sin cursos todavía.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
