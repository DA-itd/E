import { supabase } from './supabaseClient'

// ---------------------------------------------------------------
// Determina el rango de fechas (mes exacto) según el periodo elegido.
// Los 3 trimestres de capacitación son meses fijos: enero, junio, agosto.
// ---------------------------------------------------------------
const MESES_TRIMESTRE = { 1: 1, 2: 6, 3: 8 }
const NOMBRE_MES = { 1: 'ENERO', 6: 'JUNIO', 8: 'AGOSTO' }
const TOP_CURSOS_DEMANDADOS = 10
const TOP_DEPARTAMENTOS = 15

function rangoDelMes(anio, mes) {
  const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`
  const finDate = new Date(anio, mes, 0)
  const fin = finDate.toISOString().slice(0, 10)
  return { inicio, fin }
}

// "Actual" = el trimestre más reciente cuyo mes ya inició respecto a hoy.
function trimestreActual() {
  const hoy = new Date()
  const anio = hoy.getFullYear()
  const mesHoy = hoy.getMonth() + 1
  const mesesOrden = [8, 6, 1]
  for (const mes of mesesOrden) {
    if (mesHoy >= mes) return { anio, mes }
  }
  return { anio: anio - 1, mes: 8 }
}

/**
 * @param {{ tipo: 'trimestre'|'anio'|'actual', anio: number, trimestre?: 1|2|3 }} periodo
 */
function calcularRango(periodo) {
  if (periodo.tipo === 'anio') {
    return { inicio: `${periodo.anio}-01-01`, fin: `${periodo.anio}-12-31`, anio: periodo.anio, mes: undefined }
  }
  if (periodo.tipo === 'actual') {
    const { anio, mes } = trimestreActual()
    return { ...rangoDelMes(anio, mes), anio, mes }
  }
  const mes = MESES_TRIMESTRE[periodo.trimestre]
  return { ...rangoDelMes(periodo.anio, mes), anio: periodo.anio, mes }
}

function normalizar(texto) {
  return (texto || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// Deriva "Licenciatura" / "Posgrado" / null a partir del código crudo de
// docentes.nivel (L / M / P / "M, Maestría" / NULL / etc.)
function nivelAgrupado(nivelCrudo) {
  const n = normalizar(nivelCrudo).trim()
  if (!n) return null
  if (n.startsWith('L')) return 'Licenciatura'
  if (n.startsWith('M') || n.startsWith('P')) return 'Posgrado'
  return null
}

function nuevoBucketNivel() {
  return {
    total: 0,
    porGenero: { Hombre: 0, Mujer: 0 },
    porTipo: { Docente: 0, Profesional: 0 },
    habilidadesDigitales: 0,
    saludEmocional: 0,
  }
}

function top(mapa, n) {
  return [...mapa.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
}

export async function calcularReporte(periodo) {
  const { inicio, fin, anio, mes } = calcularRango(periodo)

  // Palabras clave por categoría (habilidades_digitales / salud_emocional).
  const { data: palabrasData } = await supabase
    .from('palabras_clave_categorias')
    .select('palabra, categoria')
  const palabrasPorCategoria = { habilidades_digitales: [], salud_emocional: [] }
  for (const p of palabrasData || []) {
    if (!palabrasPorCategoria[p.categoria]) palabrasPorCategoria[p.categoria] = []
    palabrasPorCategoria[p.categoria].push(normalizar(p.palabra))
  }
  function coincideCategoria(nombreCurso, categoria) {
    const n = normalizar(nombreCurso)
    return (palabrasPorCategoria[categoria] || []).some((palabra) => n.includes(palabra))
  }

  // Mapa email -> nivel agrupado (para clasificar también los históricos).
  const { data: docentesData } = await supabase.from('docentes').select('email, nivel, genero, activo')
  const nivelPorEmail = new Map(
    (docentesData || []).map((d) => [(d.email || '').toLowerCase(), nivelAgrupado(d.nivel)])
  )

  // Total de plantilla (activos) por género -- denominador de "sin participar".
  const totalPlantillaPorGenero = { Hombre: 0, Mujer: 0 }
  let totalPlantilla = 0
  for (const d of docentesData || []) {
    if (d.activo === false) continue
    totalPlantilla++
    if (d.genero === 'Hombre' || d.genero === 'Mujer') totalPlantillaPorGenero[d.genero]++
  }

  // --- Fuente 1: inscripciones activas del ciclo actual ---
  const { data: inscripcionesActuales, error: errorActuales } = await supabase
    .from('inscripciones')
    .select(`
      docente_id,
      folio_personal,
      docentes ( email, genero, nivel, departamento, nombre_completo ),
      cursos!inner ( id, nombre, tipo, fecha_inicio, departamento )
    `)
    .eq('estado', 'activo')
    .gte('cursos.fecha_inicio', inicio)
    .lte('cursos.fecha_inicio', fin)

  if (errorActuales) throw errorActuales

  // --- Fuente 2: histórico 2022-2026 (sin fecha real, solo año + texto) ---
  let queryHistorico = supabase
    .from('inscripciones_historial')
    .select('email, genero, curso, tipo, folio_curso, folio_personal, anio, departamento, nombre_completo')
    .eq('anio', anio)
    .ilike('estado', 'activo')

  if (mes) {
    queryHistorico = queryHistorico.ilike('fecha_curso_texto', `%${NOMBRE_MES[mes]}%`)
  }

  const { data: historico, error: errorHistorico } = await queryHistorico
  if (errorHistorico) throw errorHistorico

  // --- Unificar ambas fuentes en un mismo formato ---
  const filas = []

  for (const fila of inscripcionesActuales || []) {
    filas.push({
      emailKey: (fila.docentes?.email || '').toLowerCase(),
      nombre: fila.docentes?.nombre_completo || '',
      folio: fila.folio_personal || '',
      genero: fila.docentes?.genero,
      nivelGrupo: nivelAgrupado(fila.docentes?.nivel),
      tipoCurso: fila.cursos?.tipo,
      cursoNombre: fila.cursos?.nombre,
      cursoClave: `C-${fila.cursos?.id}`,
      departamento: fila.docentes?.departamento || 'Sin especificar',
      departamentoOferente: fila.cursos?.departamento || 'Sin especificar',
    })
  }

  for (const fila of historico || []) {
    const emailKey = (fila.email || '').toLowerCase()
    filas.push({
      emailKey,
      nombre: fila.nombre_completo || '',
      folio: fila.folio_personal || '',
      genero: fila.genero,
      nivelGrupo: nivelPorEmail.get(emailKey) ?? null,
      tipoCurso: fila.tipo,
      cursoNombre: fila.curso,
      cursoClave: `H-${fila.folio_curso || fila.curso}`,
      departamento: fila.departamento || 'Sin especificar',
      // Los históricos no tienen un departamento de curso por separado --
      // se usa el mismo como mejor aproximación disponible.
      departamentoOferente: fila.departamento || 'Sin especificar',
    })
  }

  const reporte = {
    rango: { inicio, fin },
    totalInscripciones: filas.length,
    porGenero: { Hombre: 0, Mujer: 0 },
    porTipo: { Docente: 0, Profesional: 0 },
    licenciatura: nuevoBucketNivel(),
    posgrado: nuevoBucketNivel(),
  }

  const cursosPorDocente = new Map() // emailKey -> Set(cursoClave)
  const infoPorDocente = new Map() // emailKey -> { genero, tipos: Set }
  const conteoPorCurso = new Map() // cursoNombre -> cantidad de inscritos
  const conteoPorDepartamento = new Map() // departamento -> cantidad de inscritos
  const generoPorCurso = new Map() // cursoNombre -> { Hombre, Mujer }
  const cursosDistintosPorTipo = { Docente: new Set(), Profesional: new Set() }
  const generoPorTipo = { Docente: { Hombre: 0, Mujer: 0 }, Profesional: { Hombre: 0, Mujer: 0 } }
  const participantesPorDocente = new Map() // emailKey -> { nombre, departamento, cursos: Set }
  const detalleParticipantes = [] // una fila por cada curso tomado (folio, nombre, curso, departamento)

  for (const fila of filas) {
    const { genero, tipoCurso, nivelGrupo, cursoNombre, emailKey, cursoClave, departamento, departamentoOferente, nombre, folio } = fila
    const esHabilidadDigital = coincideCategoria(cursoNombre, 'habilidades_digitales')
    const esSaludEmocional = coincideCategoria(cursoNombre, 'salud_emocional')

    if (genero === 'Hombre' || genero === 'Mujer') reporte.porGenero[genero]++
    if (tipoCurso === 'Docente' || tipoCurso === 'Profesional') {
      reporte.porTipo[tipoCurso]++
      if (cursoClave) cursosDistintosPorTipo[tipoCurso].add(cursoClave)
      if (genero === 'Hombre' || genero === 'Mujer') generoPorTipo[tipoCurso][genero]++
    }

    if (nivelGrupo) {
      const bucket = nivelGrupo === 'Licenciatura' ? reporte.licenciatura : reporte.posgrado
      bucket.total++
      if (genero === 'Hombre' || genero === 'Mujer') bucket.porGenero[genero]++
      if (tipoCurso === 'Docente' || tipoCurso === 'Profesional') bucket.porTipo[tipoCurso]++
      if (esHabilidadDigital) bucket.habilidadesDigitales++
      if (esSaludEmocional) bucket.saludEmocional++
    }

    if (emailKey) {
      if (!cursosPorDocente.has(emailKey)) cursosPorDocente.set(emailKey, new Set())
      cursosPorDocente.get(emailKey).add(cursoClave)

      if (!infoPorDocente.has(emailKey)) infoPorDocente.set(emailKey, { genero, tipos: new Set() })
      const info = infoPorDocente.get(emailKey)
      if (!info.genero && genero) info.genero = genero
      if (tipoCurso) info.tipos.add(tipoCurso)

      if (!participantesPorDocente.has(emailKey)) {
        participantesPorDocente.set(emailKey, { nombre, departamento, cursos: new Set() })
      }
      if (cursoNombre) participantesPorDocente.get(emailKey).cursos.add(cursoNombre)
    }

    if (cursoNombre) {
      detalleParticipantes.push({ folio, nombre, curso: cursoNombre, departamento, departamentoOferente })
    }

    if (cursoNombre) {
      conteoPorCurso.set(cursoNombre, (conteoPorCurso.get(cursoNombre) || 0) + 1)
      if (!generoPorCurso.has(cursoNombre)) generoPorCurso.set(cursoNombre, { Hombre: 0, Mujer: 0 })
      if (genero === 'Hombre' || genero === 'Mujer') generoPorCurso.get(cursoNombre)[genero]++
    }
    conteoPorDepartamento.set(departamento, (conteoPorDepartamento.get(departamento) || 0) + 1)
  }

  const distribucion = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, '6+': 0 }
  for (const setCursos of cursosPorDocente.values()) {
    const n = setCursos.size
    if (n >= 6) distribucion['6+']++
    else if (n >= 1) distribucion[n]++
  }

  // Desglose de docentes ÚNICOS (cada docente cuenta 1 vez).
  const docentesUnicosPorGenero = { Hombre: 0, Mujer: 0 }
  const docentesUnicosPorTipo = { Docente: 0, Profesional: 0 }
  for (const info of infoPorDocente.values()) {
    if (info.genero === 'Hombre' || info.genero === 'Mujer') docentesUnicosPorGenero[info.genero]++
    if (info.tipos.has('Docente')) docentesUnicosPorTipo.Docente++
    if (info.tipos.has('Profesional')) docentesUnicosPorTipo.Profesional++
  }

  // Docentes de la plantilla que NO participaron en el periodo.
  const sinParticiparPorGenero = {
    Hombre: Math.max(totalPlantillaPorGenero.Hombre - docentesUnicosPorGenero.Hombre, 0),
    Mujer: Math.max(totalPlantillaPorGenero.Mujer - docentesUnicosPorGenero.Mujer, 0),
  }

  reporte.docentesUnicos = cursosPorDocente.size
  reporte.docentesUnicosPorGenero = docentesUnicosPorGenero
  reporte.docentesUnicosPorTipo = docentesUnicosPorTipo
  reporte.totalDocentesInstitucion = totalPlantilla || 417
  reporte.porcentajeParticipacion = Number(((cursosPorDocente.size / (totalPlantilla || 417)) * 100).toFixed(1))
  reporte.sinParticipar = {
    total: sinParticiparPorGenero.Hombre + sinParticiparPorGenero.Mujer,
    porGenero: sinParticiparPorGenero,
  }
  reporte.distribucionPorNumeroCursos = distribucion
  reporte.cursosMasDemandados = top(conteoPorCurso, TOP_CURSOS_DEMANDADOS).map((c) => ({
    ...c,
    Hombre: generoPorCurso.get(c.nombre)?.Hombre || 0,
    Mujer: generoPorCurso.get(c.nombre)?.Mujer || 0,
  }))
  reporte.porDepartamento = top(conteoPorDepartamento, TOP_DEPARTAMENTOS)
  reporte.cursosDistintosPorTipo = {
    Docente: cursosDistintosPorTipo.Docente.size,
    Profesional: cursosDistintosPorTipo.Profesional.size,
  }
  reporte.generoPorTipo = generoPorTipo
  reporte.participantes = [...participantesPorDocente.values()]
    .map((p) => ({ nombre: p.nombre, departamento: p.departamento, cursos: [...p.cursos] }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  reporte.detalleParticipantes = detalleParticipantes.sort(
    (a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.curso.localeCompare(b.curso, 'es')
  )

  return reporte
}