// src/components/AdminReporteRH.jsx
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { descargarConstancia } from '../lib/constancias'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

function guardarBlob(blob, nombreArchivo) {
  try {
    saveAs(blob, nombreArchivo)
  } catch {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombreArchivo
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
}

function limpiarNombre(texto) {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 -]/g, '')
    .trim()
    .replace(/\s+/g, '_')
}

// Extrae el año (ej. 2026) buscando primero en fechas, luego en el folio (ej. TNM-054-40-2026-10)
function deducirAnio(fila) {
  if (fila.fechaInicio && fila.fechaInicio.length >= 4) {
    const anio = parseInt(fila.fechaInicio.slice(0, 4), 10)
    if (!isNaN(anio) && anio >= 2000 && anio <= 2050) return anio
  }
  const matchFolio = (fila.codigo || '').match(/-(20\d\d)-/)
  if (matchFolio) return parseInt(matchFolio[1], 10)

  const matchCurso = (fila.curso || '').match(/\b(20\d\d)\b/)
  if (matchCurso) return parseInt(matchCurso[1], 10)

  if (fila.fechaFin && fila.fechaFin.length >= 4) {
    const anio = parseInt(fila.fechaFin.slice(0, 4), 10)
    if (!isNaN(anio)) return anio
  }

  return 2026
}

// Deduce el cuatrimestre / periodo (1: Ene-Abr, 2: May-Ago, 3: Sep-Dic)
function deducirPeriodo(fila) {
  if (fila.fechaInicio && fila.fechaInicio.length >= 7) {
    const mes = parseInt(fila.fechaInicio.slice(5, 7), 10)
    if (mes >= 1 && mes <= 4) return 1
    if (mes >= 5 && mes <= 8) return 2
    if (mes >= 9 && mes <= 12) return 3
  }
  const texto = `${fila.curso || ''} ${fila.codigo || ''}`.toUpperCase()
  if (texto.includes('ENERO') || texto.includes('ENE')) return 1
  if (texto.includes('JUNIO') || texto.includes('JUN') || texto.includes('MAYO')) return 2
  if (texto.includes('AGOSTO') || texto.includes('AGO') || texto.includes('SEPTIEMBRE')) return 3

  return 2 // Por defecto cuatrimestre junio/agosto
}

export default function AdminReporteRH() {
  const [todasLasFilas, setTodasLasFilas] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [generandoZip, setGenerandoZip] = useState(false)
  const [progresoZip, setProgresoZip] = useState({ actual: 0, total: 0, texto: '' })
  const [descargandoId, setDescargandoId] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [errorCarga, setErrorCarga] = useState('')
  const [debugInfo, setDebugInfo] = useState({ activas: 0, historial: 0, colsHistorial: [] })

  // Filtros preparados para este y próximos años
  const anioActual = new Date().getFullYear()
  const [anioSel, setAnioSel] = useState(String(anioActual))
  const [periodoSel, setPeriodoSel] = useState('todos') // 'todos' | '1' | '2' | '3' | 'rango'
  const [rangoDesde, setRangoDesde] = useState('')
  const [rangoHasta, setRangoHasta] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    setErrorCarga('')
    try {
      // 1. Consultar con select('*') para garantizar que ninguna columna falte
      const [
        { data: docentesData, error: errDoc },
        { data: cursosData, error: errCur },
        { data: inscripcionesActivas, error: errAct },
        { data: inscripcionesHistorial, error: errHist },
      ] = await Promise.all([
        supabase.from('docentes').select('*'),
        supabase.from('cursos').select('*'),
        supabase.from('inscripciones').select('*'),
        supabase.from('inscripciones_historial').select('*'),
      ])

      if (errDoc) console.warn('Error docentes:', errDoc)
      if (errCur) console.warn('Error cursos:', errCur)
      if (errAct) console.warn('Error activas:', errAct)
      if (errHist) console.warn('Error historial:', errHist)

      if (errAct && errHist) {
        setErrorCarga(`No se pudieron consultar inscripciones: ${errAct.message} / ${errHist.message}`)
      }

      setDebugInfo({
        activas: (inscripcionesActivas || []).length,
        historial: (inscripcionesHistorial || []).length,
        colsHistorial: inscripcionesHistorial?.[0] ? Object.keys(inscripcionesHistorial[0]) : [],
      })

      const mapaDocentesId = new Map((docentesData || []).map((d) => [d.id, d]))
      const mapaDocentesEmail = new Map(
        (docentesData || []).map((d) => [(d.email || '').toLowerCase().trim(), d])
      )
      const mapaCursosId = new Map((cursosData || []).map((c) => [c.id, c]))
      const mapaCursosFolio = new Map(
        (cursosData || []).map((c) => [(c.folio || '').trim(), c])
      )

      // Regla de aprobación flexible:
      // En historial: si ya está archivado y no dice 'No' ni 'Cancelado', es curso completado.
      // En activas: si dice true, 'Sí', 'si', 'aprobada', 'presente', etc.
      function estaAprobado(obj, esHistorial) {
        const val = obj.asistencia_aprobada ?? obj.asistencia ?? obj.acreditado ?? obj.aprobado
        const str = String(val ?? '').toLowerCase().trim()

        if (str === 'no' || str === 'false' || str === 'cancelado' || str === 'baja' || obj.estado === 'cancelado') {
          return false
        }

        if (val === true || val === 1 || str === 'true' || str === 'si' || str === 'sí' || str === 'aprobada' || str === 'acreditada' || str === 'presente') {
          return true
        }

        // Si es del historial histórico y el campo no es explícitamente negativo, se considera aprobado
        if (esHistorial) {
          return true
        }

        return false
      }

      const lista = []
      const clavesVistas = new Set()

      // A. Procesar inscripciones activas
      for (const i of inscripcionesActivas || []) {
        if (!estaAprobado(i, false)) continue

        const docente = mapaDocentesId.get(i.docente_id) || (i.email && mapaDocentesEmail.get(i.email.toLowerCase().trim()))
        const curso = mapaCursosId.get(i.curso_id) || (i.folio_curso && mapaCursosFolio.get(i.folio_curso.trim()))

        const clave = `act_${i.id}_${i.folio_personal}`
        if (clavesVistas.has(clave)) continue
        clavesVistas.add(clave)

        const item = {
          docenteId: i.docente_id || docente?.id || `d_${i.id}`,
          cursoId: i.curso_id || curso?.id || `c_${i.id}`,
          nombre: docente?.nombre_completo || i.nombre || 'Docente',
          email: docente?.email || i.email || 'Sin correo',
          codigo: i.folio_personal || 'SIN_FOLIO',
          curso: curso?.nombre || i.curso || 'Curso',
          horas: curso?.horas || i.horas || 30,
          fechaInicio: curso?.fecha_inicio || i.fecha_inicio || null,
          fechaFin: curso?.fecha_fin || i.fecha_fin || null,
          departamento: curso?.departamento || docente?.departamento || 'Instituto Tecnológico de Durango',
          tipo: curso?.tipo || 'Docente',
          origen: 'activa',
        }
        item.anio = deducirAnio(item)
        item.cuatrimestre = deducirPeriodo(item)
        lista.push(item)
      }

      // B. Procesar historial archivado (los 1000 registros históricos)
      for (const h of inscripcionesHistorial || []) {
        if (!estaAprobado(h, true)) continue

        const emailNorm = (h.email || '').toLowerCase().trim()
        const docente = (emailNorm && mapaDocentesEmail.get(emailNorm)) || (h.docente_id && mapaDocentesId.get(h.docente_id))
        const folioCurso = (h.folio_curso || '').trim()
        const curso = (h.curso_id && mapaCursosId.get(h.curso_id)) || (folioCurso && mapaCursosFolio.get(folioCurso))

        const folioPersonal = h.folio_personal || ''
        const clave = `hist_${h.id}_${folioPersonal}`
        if (clavesVistas.has(clave)) continue
        clavesVistas.add(clave)

        const item = {
          docenteId: docente?.id || h.docente_id || `hist_${h.id}`,
          cursoId: curso?.id || h.curso_id || `hist_c_${h.id}`,
          nombre: h.nombre || docente?.nombre_completo || 'Docente',
          email: h.email || docente?.email || 'Sin correo',
          codigo: folioPersonal || 'SIN_FOLIO',
          curso: curso?.nombre || h.curso || folioCurso || 'Curso',
          horas: curso?.horas || h.horas || 30,
          fechaInicio: curso?.fecha_inicio || h.fecha_inicio || null,
          fechaFin: curso?.fecha_fin || h.fecha_fin || null,
          departamento: curso?.departamento || docente?.departamento || 'Instituto Tecnológico de Durango',
          tipo: curso?.tipo || 'Docente',
          origen: 'historial',
        }
        item.anio = deducirAnio(item)
        item.cuatrimestre = deducirPeriodo(item)
        lista.push(item)
      }

      lista.sort((a, b) => a.nombre.localeCompare(b.nombre))
      setTodasLasFilas(lista)
    } catch (err) {
      console.error('Error al cargar datos RH:', err)
      setErrorCarga('Error inesperado al cargar datos: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  // Años disponibles calculados dinámicamente según la base de datos
  const aniosDisponibles = useMemo(() => {
    if (!todasLasFilas || todasLasFilas.length === 0) return [anioActual]
    const anios = [...new Set(todasLasFilas.map((f) => f.anio).filter(Boolean))]
    anios.sort((a, b) => b - a)
    return anios
  }, [todasLasFilas, anioActual])

  // Filtrado compuesto: Año -> Periodo -> Búsqueda
  const filasFiltradas = useMemo(() => {
    if (!todasLasFilas) return null

    return todasLasFilas.filter((f) => {
      // 1. Filtro por Año
      if (anioSel !== 'todos') {
        if (String(f.anio) !== String(anioSel)) return false
      }

      // 2. Filtro por Periodo / Cuatrimestre
      if (periodoSel === 'rango') {
        if (!f.fechaInicio) return false
        if (rangoDesde && f.fechaInicio < rangoDesde) return false
        if (rangoHasta && f.fechaInicio > rangoHasta) return false
      } else if (periodoSel !== 'todos') {
        const numPeriodo = parseInt(periodoSel, 10)
        if (f.cuatrimestre !== numPeriodo) return false
      }

      // 3. Filtro por Búsqueda rápida
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim()
        const coincide =
          f.nombre.toLowerCase().includes(q) ||
          f.email.toLowerCase().includes(q) ||
          f.codigo.toLowerCase().includes(q) ||
          f.curso.toLowerCase().includes(q)
        if (!coincide) return false
      }

      return true
    })
  }, [todasLasFilas, anioSel, periodoSel, rangoDesde, rangoHasta, busqueda])

  // 1. Exportar Excel oficial para Recursos Humanos
  function exportarExcel() {
    if (!filasFiltradas || filasFiltradas.length === 0) return

    const datosExcel = filasFiltradas.map((f) => {
      const nombrePdf = `${f.codigo}_${limpiarNombre(f.nombre)}.pdf`
      return {
        'Nombre': f.nombre.toUpperCase(),
        'Email': f.email,
        'Folio': f.codigo,
        'Tipo': 'Constancia',
        'Curso': f.curso.toUpperCase(),
        'Horas': f.horas,
        'Departamento': f.departamento,
        'Archivo PDF': nombrePdf,
      }
    })

    const hoja = XLSX.utils.json_to_sheet(datosExcel)
    hoja['!cols'] = [
      { wch: 36 },
      { wch: 32 },
      { wch: 22 },
      { wch: 14 },
      { wch: 55 },
      { wch: 8 },
      { wch: 35 },
      { wch: 45 },
    ]

    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Constancias RH')
    const sufijo = `Año_${anioSel}_Periodo_${periodoSel}`
    XLSX.writeFile(libro, `Constancias_RH_${sufijo}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // 2. Generar Paquete .ZIP masivo con todos los PDFs y el Excel
  async function generarPaqueteZip() {
    if (!filasFiltradas || filasFiltradas.length === 0) {
      alert('No hay registros disponibles para generar el paquete con estos filtros.')
      return
    }

    const confirmar = window.confirm(
      `¿Deseas compilar el paquete ZIP para Recursos Humanos con ${filasFiltradas.length} constancias?\n\n` +
      `• Se generarán los PDFs con folio oficial y logos institucionales.\n` +
      `• Se incluirá el archivo Excel oficial con los nombres, correos y folios.\n` +
      `• Cero consumo de cuota de Supabase.`
    )
    if (!confirmar) return

    setGenerandoZip(true)
    setProgresoZip({ actual: 0, total: filasFiltradas.length, texto: 'Iniciando generación...' })

    try {
      const zip = new JSZip()
      const carpetaPdf = zip.folder('Constancias_PDF')
      const datosExcel = []
      let exitosos = 0

      for (let i = 0; i < filasFiltradas.length; i++) {
        const fila = filasFiltradas[i]
        const numActual = i + 1
        setProgresoZip({
          actual: numActual,
          total: filasFiltradas.length,
          texto: `Generando ${numActual} de ${filasFiltradas.length}: ${fila.nombre}...`,
        })

        const nombrePdf = `${fila.codigo}_${limpiarNombre(fila.nombre)}.pdf`

        try {
          const pdfBytes = await descargarConstancia('constancia', {
            docenteId: fila.docenteId,
            cursoId: fila.cursoId,
            nombreCompleto: fila.nombre,
            curso: fila.curso,
            fechaInicio: fila.fechaInicio,
            fechaFin: fila.fechaFin,
            horas: fila.horas,
            departamento: fila.departamento,
            folioPersonal: fila.codigo,
            tipo: fila.tipo,
            retornarBytes: true,
          })

          if (pdfBytes) {
            carpetaPdf.file(nombrePdf, pdfBytes)
            exitosos++
          }
        } catch (errPdf) {
          console.error(`Fallo en constancia de ${fila.nombre}:`, errPdf)
        }

        datosExcel.push({
          'Nombre': fila.nombre.toUpperCase(),
          'Email': fila.email,
          'Folio': fila.codigo,
          'Tipo': 'Constancia',
          'Curso': fila.curso.toUpperCase(),
          'Horas': fila.horas,
          'Departamento': fila.departamento,
          'Archivo PDF': nombrePdf,
        })
      }

      setProgresoZip({
        actual: filasFiltradas.length,
        total: filasFiltradas.length,
        texto: 'Creando archivo Excel...',
      })

      const hoja = XLSX.utils.json_to_sheet(datosExcel)
      hoja['!cols'] = [
        { wch: 36 },
        { wch: 32 },
        { wch: 22 },
        { wch: 14 },
        { wch: 55 },
        { wch: 8 },
        { wch: 35 },
        { wch: 45 },
      ]
      const libro = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(libro, hoja, 'Constancias RH')
      const buffer = XLSX.write(libro, { bookType: 'xlsx', type: 'array' })
      zip.file(`Listado_Constancias_RH_${new Date().toISOString().slice(0, 10)}.xlsx`, buffer)

      setProgresoZip({
        actual: filasFiltradas.length,
        total: filasFiltradas.length,
        texto: 'Comprimiendo archivo ZIP...',
      })

      const contenidoZip = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      })

      const nombreZip = `Paquete_Constancias_RH_Año_${anioSel}_Periodo_${periodoSel}.zip`
      guardarBlob(contenidoZip, nombreZip)

      alert(
        `¡Paquete generado con éxito!\n\n` +
        `• Total generado: ${exitosos} de ${filasFiltradas.length} constancias.\n` +
        `• Archivo: ${nombreZip}\n\n` +
        `Ya puedes subir este archivo o su carpeta a Google Drive.`
      )
    } catch (errGen) {
      console.error('Error generando ZIP:', errGen)
      alert('Error al compilar el ZIP: ' + errGen.message)
    } finally {
      setGenerandoZip(false)
      setProgresoZip({ actual: 0, total: 0, texto: '' })
    }
  }

  // 3. Descargar PDF individual
  async function descargarIndividual(fila) {
    const key = fila.docenteId + fila.cursoId
    setDescargandoId(key)
    try {
      await descargarConstancia('constancia', {
        docenteId: fila.docenteId,
        cursoId: fila.cursoId,
        nombreCompleto: fila.nombre,
        curso: fila.curso,
        fechaInicio: fila.fechaInicio,
        fechaFin: fila.fechaFin,
        horas: fila.horas,
        departamento: fila.departamento,
        folioPersonal: fila.codigo,
        tipo: fila.tipo,
      })
    } catch (err) {
      console.error(err)
      alert('Error al descargar constancia: ' + err.message)
    } finally {
      setDescargandoId(null)
    }
  }

  const porcentaje = progresoZip.total > 0 ? Math.round((progresoZip.actual / progresoZip.total) * 100) : 0

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8 space-y-6">
      
      {/* Encabezado */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
          <h2 className="font-display text-xl font-bold text-itd-navy flex items-center gap-2">
            <span>📋</span>
            <span>Reporte para Recursos Humanos</span>
          </h2>
          <a
            href="https://drive.google.com/drive/folders/1VicoRho-geh6_hY6_InRMnB0QiOe3EAi?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors shadow-2xs w-fit"
            title="Abrir carpeta compartida de Google Drive para Recursos Humanos"
          >
            <span>☁️ Carpeta RH en Google Drive</span>
            <span className="text-sm">↗</span>
          </a>
        </div>
        <p className="text-sm text-itd-navyDark/60">
          Genera el archivo de Excel oficial para Recursos Humanos y compila el paquete masivo en <strong>.ZIP con todos los PDFs</strong> de los docentes con asistencia aprobada, preparado para filtrar por año y periodo sin agotar la cuota de almacenamiento.
        </p>
      </div>

      {/* Progreso del ZIP */}
      {generandoZip && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-amber-900">
            <span>⏳ {progresoZip.texto}</span>
            <span>{porcentaje}%</span>
          </div>
          <div className="w-full h-3 bg-amber-200/80 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-amber-600 rounded-full transition-all duration-300"
              style={{ width: `${porcentaje}%` }}
            />
          </div>
        </div>
      )}

      {/* FILTROS: 1. AÑO -> 2. PERIODO / CUATRIMESTRE -> 3. BUSCADOR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl bg-slate-50 border border-slate-200 p-4 items-end">
        
        {/* 1. Año */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">1. Año:</label>
          <select
            value={anioSel}
            onChange={(e) => setAnioSel(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white font-semibold text-slate-800"
          >
            <option value="todos">Todos los años</option>
            {aniosDisponibles.map((a) => (
              <option key={a} value={a}>
                Año {a}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Periodo / Cuatrimestre */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">2. Periodo:</label>
          <select
            value={periodoSel}
            onChange={(e) => setPeriodoSel(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white font-medium text-slate-800"
          >
            <option value="todos">Todo el año (Completo)</option>
            <option value="1">Periodo 1: Enero (Ene - Abr)</option>
            <option value="2">Periodo 2: Junio (May - Ago)</option>
            <option value="3">Periodo 3: Agosto (Sep - Dic)</option>
            <option value="rango">Rango de fechas…</option>
          </select>
        </div>

        {/* 3. Fechas si es rango o Buscador rápido */}
        {periodoSel === 'rango' ? (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Desde:</label>
              <input
                type="date"
                value={rangoDesde}
                onChange={(e) => setRangoDesde(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Hasta:</label>
              <input
                type="date"
                value={rangoHasta}
                onChange={(e) => setRangoHasta(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
              />
            </div>
          </>
        ) : (
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">3. Buscar por nombre o curso:</label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Escribe nombre, correo o folio…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            />
          </div>
        )}
      </div>

      {/* Barra de contador y botones de acción */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#1B396A] bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
            ✓ {filasFiltradas?.length || 0} constancias con asistencia acreditada
          </span>
          <button
            onClick={cargar}
            disabled={cargando}
            className="text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 font-semibold border border-slate-200 cursor-pointer"
            title="Recargar datos"
          >
            🔄
          </button>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={exportarExcel}
            disabled={cargando || generandoZip || !filasFiltradas || filasFiltradas.length === 0}
            className="rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2.5 text-xs font-bold shadow-2xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>📊</span>
            <span>Descargar Excel RH</span>
          </button>

          <button
            onClick={generarPaqueteZip}
            disabled={cargando || generandoZip || !filasFiltradas || filasFiltradas.length === 0}
            className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2.5 text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>📦</span>
            <span>Generar Paquete RH (.ZIP)</span>
          </button>
        </div>
      </div>

      {/* Alerta de error si ocurrió */}
      {errorCarga && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold">
          ⚠️ {errorCarga}
        </div>
      )}

      {/* Tabla de resultados */}
      {cargando ? (
        <p className="text-center text-slate-400 py-12 text-sm">Cargando constancias oficiales…</p>
      ) : !filasFiltradas || filasFiltradas.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200 space-y-1.5">
          <p className="font-semibold text-slate-600">No se encontraron constancias para el año y periodo seleccionados.</p>
          <p className="text-[11px] text-slate-400">
            Prueba cambiando a "Todos los años" o revisa si hay algún filtro en el buscador. (Leídos: {debugInfo.historial} en historial, {debugInfo.activas} en activas).
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-3">Docente</th>
                <th className="py-3 px-3">Email</th>
                <th className="py-3 px-3">Folio</th>
                <th className="py-3 px-3">Curso</th>
                <th className="py-3 px-3 text-center">Año / Periodo</th>
                <th className="py-3 px-3 text-center">Horas</th>
                <th className="py-3 px-3 text-right">Constancia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filasFiltradas.map((f, idx) => {
                const key = `${f.codigo}_${f.docenteId}_${idx}`
                return (
                  <tr key={key} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      {f.nombre}
                      <span className="block text-[10px] text-slate-400 font-normal truncate max-w-xs">
                        {f.departamento}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{f.email}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{f.codigo}</td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium max-w-xs truncate" title={f.curso}>
                      {f.curso}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                        {f.anio} · P{f.cuatrimestre}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-600">{f.horas} hrs</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => descargarIndividual(f)}
                        disabled={descargandoId === key || generandoZip}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold border border-blue-200 transition-colors cursor-pointer text-[11px]"
                      >
                        {descargandoId === key ? '⏳' : '⬇ PDF'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
