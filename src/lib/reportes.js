import { supabase } from './supabaseClient'

// ---------------------------------------------------------------
// Determina el rango de fechas (mes exacto) según el periodo elegido.
// Los 4 trimestres de capacitación institucional TecNM / ITD
export const MESES_TRIMESTRE = { 1: 1, 2: 6, 3: 8, 4: 10 }
export const NOMBRE_MES = { 1: 'ENERO', 6: 'JUNIO', 8: 'AGOSTO', 10: 'OCTUBRE' }
export const MESES_HASTA_TRIMESTRE = {
  1: [1],
  2: [1, 6],
  3: [1, 6, 8],
  4: [1, 6, 8, 10],
}
const TOP_CURSOS_DEMANDADOS = 10
const TOP_DEPARTAMENTOS = 15

export function rangoDelMes(anio, mes) {
  const anioNum = Number(anio) || new Date().getFullYear()
  const mesNum = Number(mes) || 1
  const inicio = `${anioNum}-${String(mesNum).padStart(2, '0')}-01`

  let fin
  try {
    const finDate = new Date(anioNum, mesNum, 0)
    if (isNaN(finDate.getTime())) {
      fin = `${anioNum}-${String(mesNum).padStart(2, '0')}-28`
    } else {
      fin = finDate.toISOString().slice(0, 10)
    }
  } catch {
    fin = `${anioNum}-${String(mesNum).padStart(2, '0')}-28`
  }

  return { inicio, fin }
}

// "Actual" = el trimestre más reciente cuyo mes ya inició respecto a hoy.
export function trimestreActual() {
  const hoy = new Date()
  const anio = hoy.getFullYear()
  const mesHoy = hoy.getMonth() + 1
  const mesesOrden = [
    { t: 4, mes: 10 },
    { t: 3, mes: 8 },
    { t: 2, mes: 6 },
    { t: 1, mes: 1 },
  ]
  for (const item of mesesOrden) {
    if (mesHoy >= item.mes) return { anio, mes: item.mes, trimestre: item.t }
  }
  return { anio: anio - 1, mes: 10, trimestre: 4 }
}

/**
 * @param {{ tipo: 'trimestre'|'anio'|'actual'|'acumulado'|'acumulado_trimestre', anio?: number, trimestre?: 1|2|3|4 }} periodo
 */
export function calcularRango(periodo = {}) {
  const anioBase = Number(periodo?.anio) || new Date().getFullYear()

  if (periodo?.tipo === 'anio') {
    return {
      inicio: `${anioBase}-01-01`,
      fin: `${anioBase}-12-31`,
      anio: anioBase,
      mes: undefined,
      trimestre: 4,
      esAcumulado: true,
    }
  }

  if (periodo?.tipo === 'acumulado' || periodo?.tipo === 'acumulado_trimestre') {
    const t = Number(periodo?.trimestre) || 4
    if (t >= 4) {
      return {
        inicio: `${anioBase}-01-01`,
        fin: `${anioBase}-12-31`,
        anio: anioBase,
        mes: undefined,
        trimestre: t,
        esAcumulado: true,
        trimestreAcumulado: t,
      }
    }
    const mesFin = MESES_TRIMESTRE[t] || 10
    const { fin } = rangoDelMes(anioBase, mesFin)
    return {
      inicio: `${anioBase}-01-01`,
      fin,
      anio: anioBase,
      trimestre: t,
      mesesAcumulados: MESES_HASTA_TRIMESTRE[t] || [1],
      esAcumulado: true,
      trimestreAcumulado: t,
    }
  }

  if (periodo?.tipo === 'actual') {
    const actual = trimestreActual()
    const anioFinal = periodo?.anio ? Number(periodo.anio) : actual.anio
    const { inicio, fin } = rangoDelMes(anioFinal, actual.mes)
    return {
      inicio,
      fin,
      anio: anioFinal,
      mes: actual.mes,
      trimestre: actual.trimestre,
      esAcumulado: false,
    }
  }

  const t = Number(periodo?.trimestre) || 1
  const mes = MESES_TRIMESTRE[t] || 1
  const { inicio, fin } = rangoDelMes(anioBase, mes)
  return {
    inicio,
    fin,
    anio: anioBase,
    mes,
    trimestre: t,
    esAcumulado: false,
  }
}

function normalizar(texto) {
  return (texto || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// Unifica nombres de departamento para evitar duplicados en conteos y rankings
export function canonizarDepartamento(depto) {
  if (!depto) return 'Sin especificar'
  const limpio = String(depto).trim()
  const norm = limpio
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/^DEPARTAMENTO\s+DE\s+/i, '')
    .replace(/^DEPTO\.?\s+DE\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (norm.includes('ECONOM') && norm.includes('ADMINISTRAT')) {
    return 'DEPARTAMENTO DE CIENCIAS ECONÓMICO ADMINISTRATIVAS'
  }
  if (norm.includes('BASICA') || norm === 'BASICAS') {
    return 'DEPARTAMENTO DE CIENCIAS BÁSICAS'
  }
  if (norm.includes('TIERRA')) {
    return 'DEPARTAMENTO DE CIENCIAS DE LA TIERRA'
  }
  if (norm.includes('INDUSTRIAL')) {
    return 'DEPARTAMENTO DE INGENIERÍA INDUSTRIAL'
  }
  if (norm.includes('QUIMIC') || norm.includes('BIOQUIMIC')) {
    return 'DEPARTAMENTO DE INGENIERÍAS QUÍMICA-BIOQUÍMICA'
  }
  if (norm.includes('ELECTRICA') || norm.includes('ELECTRONICA')) {
    return 'DEPARTAMENTO DE INGENIERÍAS ELÉCTRICA - ELECTRÓNICA'
  }
  if (norm.includes('METAL') || norm.includes('MECANICA')) {
    return 'DEPARTAMENTO DE METAL-MECÁNICA'
  }
  if (norm.includes('SISTEMA') || norm.includes('COMPUTAC')) {
    return 'DEPARTAMENTO DE SISTEMAS Y COMPUTACION'
  }
  if (norm.includes('DESARROLLO ACADEMIC')) {
    return 'DEPARTAMENTO DE DESARROLLO ACADÉMICO'
  }
  if (norm.includes('POSGRADO')) {
    return 'DIVISION DE ESTUDIOS DE POSGRADO E INVESTIGACION'
  }
  return limpio
}

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
  const { inicio, fin, anio, mes, trimestre, esAcumulado, mesesAcumulados, trimestreAcumulado } = calcularRango(periodo)

  // Palabras clave por categoría (habilidades_digitales / salud_emocional).
  let palabrasPorCategoria = { habilidades_digitales: [], salud_emocional: [] }
  try {
    const { data: palabrasData } = await supabase
      .from('palabras_clave_categorias')
      .select('palabra, categoria')
    for (const p of palabrasData || []) {
      if (!palabrasPorCategoria[p.categoria]) palabrasPorCategoria[p.categoria] = []
      palabrasPorCategoria[p.categoria].push(normalizar(p.palabra))
    }
  } catch (e) {
    console.warn('Palabras clave no disponibles desde Supabase, usando predeterminadas:', e)
  }

  function coincideCategoria(nombreCurso, categoria) {
    const n = normalizar(nombreCurso)
    return (palabrasPorCategoria[categoria] || []).some((palabra) => n.includes(palabra))
  }

  // Mapa email -> nivel agrupado (para clasificar también los históricos).
  let docentesData = []
  try {
    const res = await supabase.from('docentes').select('email, nivel, genero, activo')
    docentesData = res.data || []
  } catch (e) {
    console.warn('Docentes no disponibles desde Supabase:', e)
  }

  const nivelPorEmail = new Map(
    docentesData.map((d) => [(d.email || '').toLowerCase(), nivelAgrupado(d.nivel)])
  )

  // Total de plantilla (activos) por género
  const totalPlantillaPorGenero = { Hombre: 0, Mujer: 0 }
  let totalPlantilla = 0
  for (const d of docentesData) {
    if (d.activo === false) continue
    totalPlantilla++
    if (d.genero === 'Hombre' || d.genero === 'Mujer') totalPlantillaPorGenero[d.genero]++
  }

  async function traerTodosLosRegistros(consultaBase) {
    let todos = []
    let desde = 0
    const paso = 1000
    while (true) {
      const { data, error } = await consultaBase.range(desde, desde + paso - 1)
      if (error) {
        console.warn('Aviso consulta Supabase:', error.message)
        break
      }
      if (!data || data.length === 0) break
      todos = todos.concat(data)
      if (data.length < paso) break
      desde += paso
    }
    return todos
  }

  // --- Fuente 1: inscripciones activas del ciclo actual ---
  let inscripcionesActuales = []
  try {
    const queryActuales = supabase
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

    inscripcionesActuales = await traerTodosLosRegistros(queryActuales)
  } catch (err) {
    console.warn('Consulta inscripciones actuales omitida:', err)
  }

  // --- Fuente 2: histórico 2022-2026 ---
  let historico = []
  try {
    let queryHistorico = supabase
      .from('inscripciones_historial')
      .select('email, genero, curso, tipo, folio_curso, folio_personal, anio, departamento, nombre_completo')
      .eq('anio', anio)
      .ilike('estado', 'activo')

    if (mes && NOMBRE_MES[mes]) {
      queryHistorico = queryHistorico.ilike('fecha_curso_texto', `%${NOMBRE_MES[mes]}%`)
    }

    historico = await traerTodosLosRegistros(queryHistorico)
    if (mesesAcumulados && mesesAcumulados.length > 0) {
      const nombresPermitidos = mesesAcumulados.map((m) => NOMBRE_MES[m]).filter(Boolean)
      historico = historico.filter((h) => {
        const txt = normalizar(h.fecha_curso_texto || '')
        return nombresPermitidos.some((nom) => txt.includes(nom))
      })
    }
  } catch (err) {
    console.warn('Consulta histórico omitida:', err)
  }

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
      departamento: canonizarDepartamento(fila.docentes?.departamento || 'Sin especificar'),
      departamentoOferente: canonizarDepartamento(fila.cursos?.departamento || 'Sin especificar'),
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
      departamento: canonizarDepartamento(fila.departamento || 'Sin especificar'),
      departamentoOferente: canonizarDepartamento(fila.departamento || 'Sin especificar'),
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

  const cursosPorDocente = new Map()
  const infoPorDocente = new Map()
  const conteoPorCurso = new Map()
  const conteoPorDepartamento = new Map()
  const generoPorCurso = new Map()
  const cursosDistintosPorTipo = { Docente: new Set(), Profesional: new Set() }
  const generoPorTipo = { Docente: { Hombre: 0, Mujer: 0 }, Profesional: { Hombre: 0, Mujer: 0 } }
  const participantesPorDocente = new Map()
  const detalleParticipantes = []

  // Conjuntos para conteo de DOCENTES ÚNICOS por categoría solicitados en el Oficio Oficial
  const docentesHabDigitales = new Set()
  const docentesSaludMental = new Set()
  const docentesPosgradoHabDigitales = new Set()
  const docentesLicenciaturaHabDigitales = new Set()
  const docentesPosgradoSaludMental = new Set()
  const docentesLicenciaturaSaludMental = new Set()
  const docentesTipoDocente = new Set()
  const docentesTipoProfesional = new Set()
  const docentesMujeres = new Set()
  const docentesHombres = new Set()

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

      // Conteo de docentes únicos para el Oficio Institucional
      if (genero === 'Mujer') docentesMujeres.add(emailKey)
      if (genero === 'Hombre') docentesHombres.add(emailKey)
      if (tipoCurso === 'Docente') docentesTipoDocente.add(emailKey)
      if (tipoCurso === 'Profesional') docentesTipoProfesional.add(emailKey)
      if (esHabilidadDigital) docentesHabDigitales.add(emailKey)
      if (esSaludEmocional) docentesSaludMental.add(emailKey)
      if (nivelGrupo === 'Posgrado' && esHabilidadDigital) docentesPosgradoHabDigitales.add(emailKey)
      if (nivelGrupo === 'Licenciatura' && esHabilidadDigital) docentesLicenciaturaHabDigitales.add(emailKey)
      if (nivelGrupo === 'Posgrado' && esSaludEmocional) docentesPosgradoSaludMental.add(emailKey)
      if (nivelGrupo === 'Licenciatura' && esSaludEmocional) docentesLicenciaturaSaludMental.add(emailKey)
    }

    if (cursoNombre) {
      detalleParticipantes.push({ folio, nombre, curso: cursoNombre, departamento, departamentoOferente })
      conteoPorCurso.set(cursoNombre, (conteoPorCurso.get(cursoNombre) || 0) + 1)
      if (!generoPorCurso.has(cursoNombre)) generoPorCurso.set(cursoNombre, { Hombre: 0, Mujer: 0 })
      if (genero === 'Hombre' || genero === 'Mujer') generoPorCurso.get(cursoNombre)[genero]++
    }

    const deptoFinal = canonizarDepartamento(departamento)
    conteoPorDepartamento.set(deptoFinal, (conteoPorDepartamento.get(deptoFinal) || 0) + 1)
  }

  const distribucion = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, '6+': 0 }
  for (const setCursos of cursosPorDocente.values()) {
    const n = setCursos.size
    if (n >= 6) distribucion['6+']++
    else if (n >= 1) distribucion[n]++
  }

  const docentesUnicosPorGenero = { Hombre: 0, Mujer: 0 }
  const docentesUnicosPorTipo = { Docente: 0, Profesional: 0 }
  for (const info of infoPorDocente.values()) {
    if (info.genero === 'Hombre' || info.genero === 'Mujer') docentesUnicosPorGenero[info.genero]++
    if (info.tipos.has('Docente')) docentesUnicosPorTipo.Docente++
    if (info.tipos.has('Profesional')) docentesUnicosPorTipo.Profesional++
  }

  const plantillaTotalNum = totalPlantilla || 417
  const sinParticiparPorGenero = {
    Hombre: Math.max(totalPlantillaPorGenero.Hombre - docentesUnicosPorGenero.Hombre, 0),
    Mujer: Math.max(totalPlantillaPorGenero.Mujer - docentesUnicosPorGenero.Mujer, 0),
  }

  reporte.docentesUnicos = cursosPorDocente.size
  reporte.docentesUnicosPorGenero = docentesUnicosPorGenero
  reporte.docentesUnicosPorTipo = docentesUnicosPorTipo
  reporte.totalDocentesInstitucion = plantillaTotalNum
  reporte.porcentajeParticipacion = Number(((cursosPorDocente.size / plantillaTotalNum) * 100).toFixed(1))
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

  reporte.esAcumulado = Boolean(esAcumulado)
  reporte.modalidad = esAcumulado ? 'acumulado' : 'trimestre'
  reporte.trimestre = periodo?.trimestre || trimestre || trimestreAcumulado || 4
  reporte.trimestreAcumulado = trimestreAcumulado

  // 14 Indicadores requeridos para el Oficio Oficial Institucional TecNM / ITD
  // Con conteo exacto de DOCENTES ÚNICOS
  const coberturaCalc = Number(((cursosPorDocente.size / plantillaTotalNum) * 100).toFixed(2))
  reporte.indicadoresOficio = {
    totalRegistros: filas.length,
    docentesUnicos: cursosPorDocente.size,
    coberturaPorcentaje: coberturaCalc,
    plantillaTotal: plantillaTotalNum,
    docentesNoParticipan: Math.max(plantillaTotalNum - cursosPorDocente.size, 0),
    tipoDocente: docentesTipoDocente.size,
    tipoProfesional: docentesTipoProfesional.size,
    mujeres: docentesMujeres.size,
    hombres: docentesHombres.size,
    habilidadesDigitales: docentesHabDigitales.size,
    saludMental: docentesSaludMental.size,
    posgradoHabDigitales: docentesPosgradoHabDigitales.size,
    licenciaturaHabDigitales: docentesLicenciaturaHabDigitales.size,
    posgradoSaludMental: docentesPosgradoSaludMental.size,
    licenciaturaSaludMental: docentesLicenciaturaSaludMental.size,
  }

  // Versión alterna por total de registros / inscripciones
  reporte.indicadoresRegistros = {
    totalRegistros: filas.length,
    docentesUnicos: cursosPorDocente.size,
    coberturaPorcentaje: coberturaCalc,
    plantillaTotal: plantillaTotalNum,
    docentesNoParticipan: Math.max(plantillaTotalNum - cursosPorDocente.size, 0),
    tipoDocente: reporte.porTipo?.Docente || 0,
    tipoProfesional: reporte.porTipo?.Profesional || 0,
    mujeres: reporte.porGenero?.Mujer || 0,
    hombres: reporte.porGenero?.Hombre || 0,
    habilidadesDigitales: (reporte.licenciatura?.habilidadesDigitales || 0) + (reporte.posgrado?.habilidadesDigitales || 0),
    saludMental: (reporte.licenciatura?.saludEmocional || 0) + (reporte.posgrado?.saludEmocional || 0),
    posgradoHabDigitales: reporte.posgrado?.habilidadesDigitales || 0,
    licenciaturaHabDigitales: reporte.licenciatura?.habilidadesDigitales || 0,
    posgradoSaludMental: reporte.posgrado?.saludEmocional || 0,
    licenciaturaSaludMental: reporte.licenciatura?.saludEmocional || 0,
  }

  return reporte
}

export async function calcularHistoricoMultianual(anios = [2022, 2023, 2024, 2025, 2026]) {
  const promesas = anios.map(async (anio) => {
    try {
      const rep = await calcularReporte({ tipo: 'anio', anio })
      return {
        anio: String(anio),
        totalInscripciones: rep.totalInscripciones || 0,
        docentesUnicos: rep.docentesUnicos || 0,
        hombres: rep.porGenero?.Hombre || 0,
        mujeres: rep.porGenero?.Mujer || 0,
        tipoDocente: rep.porTipo?.Docente || 0,
        tipoProfesional: rep.porTipo?.Profesional || 0,
        licenciatura: rep.licenciatura?.total || 0,
        posgrado: rep.posgrado?.total || 0,
        sinParticipar: rep.sinParticipar?.total || 0,
        cobertura: rep.porcentajeParticipacion || 0,
      }
    } catch (e) {
      console.warn(`Error al calcular histórico para ${anio}:`, e)
      return {
        anio: String(anio),
        totalInscripciones: 0,
        docentesUnicos: 0,
        hombres: 0,
        mujeres: 0,
        tipoDocente: 0,
        tipoProfesional: 0,
        licenciatura: 0,
        posgrado: 0,
        sinParticipar: 0,
        cobertura: 0,
      }
    }
  })

  const resultados = await Promise.all(promesas)
  resultados.sort((a, b) => Number(a.anio) - Number(b.anio))

  let acumulado = 0
  return resultados.map((r) => {
    acumulado += r.totalInscripciones
    return {
      ...r,
      totalAcumulado: acumulado,
    }
  })
}
