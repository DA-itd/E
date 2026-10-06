// src/components/AdminReporteRH.jsx
import { useEffect, useState } from 'react'
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

export default function AdminReporteRH() {
  const [filas, setFilas] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [generandoZip, setGenerandoZip] = useState(false)
  const [progresoZip, setProgresoZip] = useState({ actual: 0, total: 0, texto: '' })
  const [descargandoId, setDescargandoId] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  const anioActual = new Date().getFullYear()
  const [periodo, setPeriodo] = useState('todos') // 'todos' | '1' | '2' | '3' | 'rango'
  const [anio, setAnio] = useState(anioActual)
  const [rangoDesde, setRangoDesde] = useState('')
  const [rangoHasta, setRangoHasta] = useState('')

  const RANGOS_CUATRIMESTRE = {
    1: ['-01-01', '-04-30'],
    2: ['-05-01', '-08-31'],
    3: ['-09-01', '-12-31'],
  }

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    try {
      // 1. Cargar catálogos de apoyo para mapeo seguro sin fallas de joins
      const [
        { data: docentesData },
        { data: cursosData },
        { data: inscripcionesActivas, error: errActivas },
        { data: inscripcionesHistorial, error: errHistorial },
      ] = await Promise.all([
        supabase.from('docentes').select('id, nombre_completo, email, departamento'),
        supabase.from('cursos').select('id, folio, nombre, horas, fecha_inicio, fecha_fin, departamento, tipo'),
        supabase
          .from('inscripciones')
          .select('id, folio_personal, docente_id, curso_id, asistencia_aprobada, estado'),
        supabase
          .from('inscripciones_historial')
          .select('id, folio_personal, folio_curso, curso_id, docente_id, email, nombre, asistencia_aprobada, horas, fecha_inicio, fecha_fin, curso'),
      ])

      const mapaDocentesId = new Map((docentesData || []).map((d) => [d.id, d]))
      const mapaDocentesEmail = new Map((docentesData || []).map((d) => [(d.email || '').toLowerCase().trim(), d]))
      const mapaCursosId = new Map((cursosData || []).map((c) => [c.id, c]))
      const mapaCursosFolio = new Map((cursosData || []).map((c) => [(c.folio || '').trim(), c]))

      function esAsistenciaAprobada(val) {
        if (val === true || val === 1 || val === '1') return true
        const s = String(val || '').toLowerCase().trim()
        return s === 'true' || s === 'si' || s === 'sí' || s === 'aprobada' || s === 'acreditada'
      }

      const listaUnificada = []
      const llavesVistas = new Set()

      // A. Procesar inscripciones activas del periodo actual
      for (const i of inscripcionesActivas || []) {
        if (!esAsistenciaAprobada(i.asistencia_aprobada)) continue
        if (i.estado === 'cancelado') continue

        const docente = mapaDocentesId.get(i.docente_id)
        const curso = mapaCursosId.get(i.curso_id)

        const clave = `${i.folio_personal || ''}_${i.docente_id}_${i.curso_id}`
        if (llavesVistas.has(clave)) continue
        llavesVistas.add(clave)

        listaUnificada.push({
          docenteId: i.docente_id,
          cursoId: i.curso_id,
          nombre: docente?.nombre_completo || 'Docente no especificado',
          email: docente?.email || 'Sin correo',
          codigo: i.folio_personal || 'SIN_FOLIO',
          curso: curso?.nombre || 'Curso no especificado',
          horas: curso?.horas || 30,
          fechaInicio: curso?.fecha_inicio || null,
          fechaFin: curso?.fecha_fin || null,
          departamento: curso?.departamento || docente?.departamento || 'Instituto Tecnológico de Durango',
          tipo: curso?.tipo || 'Docente',
          origen: 'activa',
        })
      }

      // B. Procesar inscripciones del historial (periodos archivados como hasta Agosto 2026)
      for (const h of inscripcionesHistorial || []) {
        if (!esAsistenciaAprobada(h.asistencia_aprobada)) continue

        const emailNorm = (h.email || '').toLowerCase().trim()
        const docente = (emailNorm && mapaDocentesEmail.get(emailNorm)) || (h.docente_id && mapaDocentesId.get(h.docente_id))
        const curso = (h.curso_id && mapaCursosId.get(h.curso_id)) || (h.folio_curso && mapaCursosFolio.get(h.folio_curso.trim()))

        const folioPersonal = h.folio_personal || ''
        const clave = folioPersonal ? `folio_${folioPersonal}` : `hist_${h.id}`
        if (llavesVistas.has(clave)) continue
        llavesVistas.add(clave)

        listaUnificada.push({
          docenteId: docente?.id || h.docente_id || `hist_${h.id}`,
          cursoId: curso?.id || h.curso_id || `hist_c_${h.id}`,
          nombre: h.nombre || docente?.nombre_completo || 'Docente',
          email: h.email || docente?.email || 'Sin correo',
          codigo: folioPersonal || 'SIN_FOLIO',
          curso: curso?.nombre || h.curso || h.folio_curso || 'Curso',
          horas: curso?.horas || h.horas || 30,
          fechaInicio: curso?.fecha_inicio || h.fecha_inicio || null,
          fechaFin: curso?.fecha_fin || h.fecha_fin || null,
          departamento: curso?.departamento || docente?.departamento || 'Instituto Tecnológico de Durango',
          tipo: curso?.tipo || 'Docente',
          origen: 'historial',
        })
      }

      // Ordenar alfabéticamente por nombre de docente
      listaUnificada.sort((a, b) => a.nombre.localeCompare(b.nombre))

      setFilas(listaUnificada)
    } catch (err) {
      console.error('Error al cargar datos para RH:', err)
      alert('Error al cargar la lista: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  function dentroDelFiltro(fila) {
    if (periodo === 'todos') return true
    if (periodo === 'rango') {
      if (!fila.fechaInicio) return false
      if (rangoDesde && fila.fechaInicio < rangoDesde) return false
      if (rangoHasta && fila.fechaInicio > rangoHasta) return false
      return true
    }
    if (!fila.fechaInicio) return false
    const [desde, hasta] = RANGOS_CUATRIMESTRE[periodo]
    return fila.fechaInicio >= `${anio}${desde}` && fila.fechaInicio <= `${anio}${hasta}`
  }

  const filasFiltradas = filas
    ? filas.filter((f) => {
        const cumplePeriodo = dentroDelFiltro(f)
        if (!cumplePeriodo) return false
        if (!busqueda.trim()) return true
        const q = busqueda.toLowerCase().trim()
        return (
          f.nombre.toLowerCase().includes(q) ||
          f.email.toLowerCase().includes(q) ||
          f.codigo.toLowerCase().includes(q) ||
          f.curso.toLowerCase().includes(q)
        )
      })
    : null

  // 1. Exportar únicamente la hoja de Excel oficial para RH
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
      { wch: 36 }, // Nombre
      { wch: 32 }, // Email
      { wch: 22 }, // Folio
      { wch: 14 }, // Tipo
      { wch: 55 }, // Curso
      { wch: 8 },  // Horas
      { wch: 35 }, // Depto
      { wch: 45 }, // Archivo PDF
    ]

    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Constancias RH')
    const sufijoPeriodo = periodo === 'todos' ? 'TODOS' : `Periodo_${periodo}_${anio}`
    XLSX.writeFile(libro, `Constancias_RH_${sufijoPeriodo}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // 2. Generar el Paquete Masivo .ZIP (Excel + Todos los PDFs al vuelo)
  async function generarPaqueteZip() {
    if (!filasFiltradas || filasFiltradas.length === 0) {
      alert('No hay registros en el periodo seleccionado para generar el paquete.')
      return
    }

    const confirmar = window.confirm(
      `¿Deseas generar el paquete ZIP con ${filasFiltradas.length} constancias oficiales?\n\n` +
      `• Se generarán los PDFs con folio oficial y logos institucionales.\n` +
      `• Se incluirá el archivo de Excel oficial con los datos de Recursos Humanos.\n` +
      `• Cero consumo de cuota de Supabase (se genera en tu equipo listo para subir a Drive).`
    )
    if (!confirmar) return

    setGenerandoZip(true)
    setProgresoZip({ actual: 0, total: filasFiltradas.length, texto: 'Iniciando generación de paquete...' })

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
          texto: `Generando constancia ${numActual} de ${filasFiltradas.length}: ${fila.nombre}...`,
        })

        const nombrePdf = `${fila.codigo}_${limpiarNombre(fila.nombre)}.pdf`

        try {
          // Genera los bytes del PDF en memoria sin forzar descargas en el navegador
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
        } catch (errorPdf) {
          console.error(`Error al generar constancia de ${fila.nombre}:`, errorPdf)
        }

        // Fila para el Excel que acompaña al ZIP
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

      // Crear el archivo Excel e incluirlo en la raíz del ZIP
      setProgresoZip({
        actual: filasFiltradas.length,
        total: filasFiltradas.length,
        texto: 'Creando hoja de Excel para Recursos Humanos...',
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
      const excelBuffer = XLSX.write(libro, { bookType: 'xlsx', type: 'array' })
      zip.file(`Listado_Constancias_RH_${new Date().toISOString().slice(0, 10)}.xlsx`, excelBuffer)

      // Comprimir todo el ZIP
      setProgresoZip({
        actual: filasFiltradas.length,
        total: filasFiltradas.length,
        texto: 'Comprimiendo archivo .ZIP. Por favor espera unos segundos...',
      })

      const contenidoZip = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      })

      const sufijoPeriodo = periodo === 'todos' ? 'TODOS' : `Periodo_${periodo}_${anio}`
      const nombreZip = `Paquete_Constancias_RH_${sufijoPeriodo}_${new Date().toISOString().slice(0, 10)}.zip`

      guardarBlob(contenidoZip, nombreZip)

      alert(
        `¡Paquete ZIP generado exitosamente!\n\n` +
        `• Constancias generadas: ${exitosos} de ${filasFiltradas.length}\n` +
        `• Archivo: ${nombreZip}\n\n` +
        `Ya puedes abrir tu carpeta de Google Drive y arrastrar este archivo o descomprimirlo.`
      )
    } catch (errGeneral) {
      console.error('Error al generar paquete ZIP:', errGeneral)
      alert('Hubo un error al generar el paquete: ' + errGeneral.message)
    } finally {
      setGenerandoZip(false)
      setProgresoZip({ actual: 0, total: 0, texto: '' })
    }
  }

  // 3. Descargar una constancia individual en PDF
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
          Genera el archivo de Excel oficial con los datos que solicita Recursos Humanos y descarga el paquete completo en <strong>.ZIP con todos los PDFs</strong> de los docentes con asistencia aprobada, listo para respaldar en Google Drive sin agotar la cuota del servidor.
        </p>
      </div>

      {/* Barra de progreso de generación ZIP */}
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
          <p className="text-[11px] text-amber-800/80">
            Por favor mantén abierta esta pestaña mientras se compila el archivo comprimido.
          </p>
        </div>
      )}

      {/* Filtros de periodo y búsqueda */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 border border-slate-200 p-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">Periodo:</label>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white font-medium"
          >
            <option value="todos">Todos los periodos</option>
            <option value="1">1er cuatrimestre (Ene - Abr)</option>
            <option value="2">2do cuatrimestre (May - Ago)</option>
            <option value="3">3er cuatrimestre (Sep - Dic)</option>
            <option value="rango">Rango de fechas…</option>
          </select>
        </div>

        {(periodo === '1' || periodo === '2' || periodo === '3') && (
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Año:</label>
            <input
              type="number"
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            />
          </div>
        )}

        {periodo === 'rango' && (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Desde:</label>
              <input
                type="date"
                value={rangoDesde}
                onChange={(e) => setRangoDesde(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Hasta:</label>
              <input
                type="date"
                value={rangoHasta}
                onChange={(e) => setRangoHasta(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              />
            </div>
          </>
        )}

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-slate-600 mb-1">Buscar docente o curso:</label>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Filtrar por nombre, folio, email…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          />
        </div>

        {filasFiltradas && (
          <div className="pb-2 text-xs font-bold text-slate-600 whitespace-nowrap">
            {filasFiltradas.length} con asistencia aprobada
          </div>
        )}
      </div>

      {/* Botones de acción principales */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={generarPaqueteZip}
          disabled={cargando || generandoZip || !filasFiltradas || filasFiltradas.length === 0}
          className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white px-5 py-3 text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>📦</span>
          <span>1. Generar Paquete Completo RH (.ZIP)</span>
        </button>

        <button
          onClick={exportarExcel}
          disabled={cargando || generandoZip || !filasFiltradas || filasFiltradas.length === 0}
          className="rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-5 py-3 text-sm font-bold shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>📊</span>
          <span>2. Descargar Solo Excel</span>
        </button>
      </div>

      {/* Tabla con listado */}
      {cargando ? (
        <p className="text-center text-slate-400 py-12 text-sm">Cargando registros con asistencia aprobada…</p>
      ) : !filasFiltradas || filasFiltradas.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-sm bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          Sin registros con asistencia aprobada en este periodo.
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
                <th className="py-3 px-3 text-center">Horas</th>
                <th className="py-3 px-3 text-right">Constancia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filasFiltradas.map((f) => {
                const key = f.docenteId + f.cursoId
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
