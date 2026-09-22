import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import * as XLSX from 'xlsx'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, ImageRun, WidthType, AlignmentType } from 'docx'
import { saveAs } from 'file-saver'
import { dibujarEncabezadoPDF, cargarImagenArrayBuffer, URL_LOGO_TECNM, URL_LOGO_ITD } from '../lib/pdfEncabezado'

const COLOR_HOMBRE = '#3b82f6'
const COLOR_MUJER = '#ec4899'
const COLOR_DOCENTE = '#16a34a'
const COLOR_PROFESIONAL = '#f59e0b'
const COLORES_DEPARTAMENTO = [
  '#1b396a', '#7c3aed', '#16a34a', '#f59e0b', '#ec4899', '#0891b2',
  '#dc2626', '#65a30d', '#9333ea', '#0284c7', '#ca8a04', '#be123c',
]

function TarjetaGrafica({ titulo, children, alto = 260 }) {
  return (
    <div className="rounded-2xl border border-itd-navy/10 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-itd-navyDark/70 mb-2">{titulo}</h3>
      <div style={{ width: '100%', height: alto }}>{children}</div>
    </div>
  )
}

export default function ReporteEncuesta() {
  const [cargando, setCargando] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [respuestas, setRespuestas] = useState([])
  const [preguntas, setPreguntas] = useState([])

  const [filtroAnio, setFiltroAnio] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState('')
  const [filtroCurso, setFiltroCurso] = useState('')
  const [filtroDepartamento, setFiltroDepartamento] = useState('')
  const [filtroGenero, setFiltroGenero] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')

  const [vista, setVista] = useState('preguntas') // 'preguntas' | 'participacion' | 'comentarios'

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setCargando(true)
    setErrorMsg('')
    try {
      // .range(0, 4999) para no toparse con el límite por defecto de 1000
      // filas de PostgREST. Si la encuesta llega a superar ~5000
      // respuestas habrá que paginar o mover la agregación a SQL/RPC.
      const [{ data: base, error: errBase }, { data: preg, error: errPreg }] = await Promise.all([
        supabase.from('vw_encuesta_base').select('*').range(0, 4999),
        supabase.from('encuesta_preguntas').select('*').order('seccion').order('orden'),
      ])
      if (errBase) throw errBase
      if (errPreg) throw errPreg
      setRespuestas(base || [])
      setPreguntas(preg || [])
    } catch (err) {
      console.error(err)
      setErrorMsg('No se pudieron cargar las respuestas: ' + err.message)
    }
    setCargando(false)
  }

  // Opciones de filtro derivadas de los datos ya cargados (sin ir de nuevo a la BD)
  const opciones = useMemo(() => {
    const anios = new Set()
    const periodos = new Map()
    const cursos = new Map()
    const departamentos = new Set()
    const generos = new Set()
    const tipos = new Set()
    for (const r of respuestas) {
      if (r.periodo_anio) anios.add(r.periodo_anio)
      // el selector de Periodo solo muestra los periodos del año elegido
      if (r.convocatoria_id && (!filtroAnio || r.periodo_anio === Number(filtroAnio))) {
        periodos.set(r.convocatoria_id, r.periodo_nombre)
      }
      if (r.curso_id) cursos.set(r.curso_id, r.curso_nombre)
      if (r.departamento) departamentos.add(r.departamento)
      if (r.genero) generos.add(r.genero)
      if (r.tipo_curso) tipos.add(r.tipo_curso)
    }
    return {
      anios: [...anios].sort((a, b) => b - a),
      periodos: [...periodos.entries()],
      cursos: [...cursos.entries()].sort((a, b) => a[1].localeCompare(b[1])),
      departamentos: [...departamentos].sort(),
      generos: [...generos].sort(),
      tipos: [...tipos].sort(),
    }
  }, [respuestas, filtroAnio])

  // Si cambias de año y el periodo seleccionado ya no pertenece a ese año, se limpia
  useEffect(() => {
    if (filtroPeriodo && !opciones.periodos.some(([id]) => id === filtroPeriodo)) {
      setFiltroPeriodo('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroAnio])

  const filtradas = useMemo(() => {
    return respuestas.filter((r) => {
      if (filtroAnio && r.periodo_anio !== Number(filtroAnio)) return false
      if (filtroPeriodo && r.convocatoria_id !== filtroPeriodo) return false
      if (filtroCurso && r.curso_id !== filtroCurso) return false
      if (filtroDepartamento && r.departamento !== filtroDepartamento) return false
      if (filtroGenero && r.genero !== filtroGenero) return false
      if (filtroTipo && r.tipo_curso !== filtroTipo) return false
      return true
    })
  }, [respuestas, filtroAnio, filtroPeriodo, filtroCurso, filtroDepartamento, filtroGenero, filtroTipo])

  // ---- Preguntas: promedio + distribución 1-5 ----
  const resultadoPreguntas = useMemo(() => {
    return preguntas.map((p) => {
      const valores = filtradas.map((r) => r[p.codigo]).filter((v) => v !== null && v !== undefined)
      const total = valores.length
      const suma = valores.reduce((acc, v) => acc + v, 0)
      const promedio = total ? suma / total : 0
      const distribucion = [1, 2, 3, 4, 5].map((n) => valores.filter((v) => v === n).length)
      return { ...p, total, promedio, distribucion }
    })
  }, [preguntas, filtradas])

  const primeraVez = useMemo(() => {
    const si = filtradas.filter((r) => r.primera_vez === true).length
    const no = filtradas.filter((r) => r.primera_vez === false).length
    return { si, no, total: si + no }
  }, [filtradas])

  // ---- Participación ----
  const participacionPorCurso = useMemo(() => {
    const mapa = new Map()
    for (const r of filtradas) {
      if (!mapa.has(r.curso_id)) mapa.set(r.curso_id, { curso: r.curso_nombre, cantidad: 0 })
      mapa.get(r.curso_id).cantidad++
    }
    return [...mapa.values()].sort((a, b) => b.cantidad - a.cantidad)
  }, [filtradas])

  const participacionPorDepartamentoYPeriodo = useMemo(() => {
    const mapa = new Map()
    for (const r of filtradas) {
      const key = `${r.periodo_nombre}||${r.departamento}`
      if (!mapa.has(key)) mapa.set(key, { periodo: r.periodo_nombre, departamento: r.departamento, cantidad: 0 })
      mapa.get(key).cantidad++
    }
    return [...mapa.values()].sort(
      (a, b) => (a.periodo || '').localeCompare(b.periodo || '') || b.cantidad - a.cantidad
    )
  }, [filtradas])

  const departamentoConMasParticipacion = useMemo(() => {
    const mapa = new Map()
    for (const r of filtradas) {
      if (!r.departamento) continue
      mapa.set(r.departamento, (mapa.get(r.departamento) || 0) + 1)
    }
    let mejor = null
    for (const [departamento, cantidad] of mapa) {
      if (!mejor || cantidad > mejor.cantidad) mejor = { departamento, cantidad }
    }
    return mejor
  }, [filtradas])

  // ---- Gráficas de pastel: género, tipo, departamento ----
  const datosGenero = useMemo(() => {
    const mapa = new Map()
    for (const r of filtradas) {
      if (!r.genero) continue
      mapa.set(r.genero, (mapa.get(r.genero) || 0) + 1)
    }
    return [...mapa.entries()].map(([nombre, valor]) => ({ nombre, valor }))
  }, [filtradas])

  const datosTipo = useMemo(() => {
    const mapa = new Map()
    for (const r of filtradas) {
      if (!r.tipo_curso) continue
      mapa.set(r.tipo_curso, (mapa.get(r.tipo_curso) || 0) + 1)
    }
    return [...mapa.entries()].map(([nombre, valor]) => ({ nombre, valor }))
  }, [filtradas])

  const datosDepartamentoPie = useMemo(() => {
    const mapa = new Map()
    for (const r of filtradas) {
      if (!r.departamento) continue
      mapa.set(r.departamento, (mapa.get(r.departamento) || 0) + 1)
    }
    return [...mapa.entries()]
      .map(([nombre, valor]) => ({ nombre, valor }))
      .sort((a, b) => b.valor - a.valor)
  }, [filtradas])

  function colorGenero(nombre) {
    if (nombre === 'Hombre') return COLOR_HOMBRE
    if (nombre === 'Mujer') return COLOR_MUJER
    return '#94a3b8'
  }

  function colorTipo(nombre) {
    if (nombre === 'Docente') return COLOR_DOCENTE
    if (nombre === 'Profesional') return COLOR_PROFESIONAL
    return '#94a3b8'
  }

  // ---- Comentarios / impedimentos ----
  const comentarios = useMemo(() => {
    return filtradas
      .filter((r) => r.comentario_valioso || r.comentario_sugerencias || (r.impedimentos && r.impedimentos.length))
      .map((r) => ({
        fecha: r.respondido_en,
        curso: r.curso_nombre,
        periodo: r.periodo_nombre,
        departamento: r.departamento,
        impedimentos: (r.impedimentos || []).join('; '),
        valioso: r.comentario_valioso || '',
        sugerencias: r.comentario_sugerencias || '',
      }))
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  }, [filtradas])

  function exportarExcel() {
    const wb = XLSX.utils.book_new()

    const wsPreguntas = XLSX.utils.aoa_to_sheet([
      ['Sección', 'Pregunta', 'Promedio', 'Resp. 1', 'Resp. 2', 'Resp. 3', 'Resp. 4', 'Resp. 5', 'Total'],
      ...resultadoPreguntas.map((p) => [p.seccion, p.texto, Number(p.promedio.toFixed(2)), ...p.distribucion, p.total]),
      [],
      ['¿Primera vez que toma un curso sobre el tema?'],
      ['Sí', primeraVez.si],
      ['No', primeraVez.no],
    ])
    wsPreguntas['!cols'] = [{ wch: 10 }, { wch: 60 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }]
    XLSX.utils.book_append_sheet(wb, wsPreguntas, 'Preguntas')

    const wsParticipacion = XLSX.utils.aoa_to_sheet([
      ['Curso', 'Participantes'],
      ...participacionPorCurso.map((p) => [p.curso, p.cantidad]),
      [],
      ['Periodo', 'Departamento', 'Participantes'],
      ...participacionPorDepartamentoYPeriodo.map((p) => [p.periodo, p.departamento, p.cantidad]),
    ])
    wsParticipacion['!cols'] = [{ wch: 50 }, { wch: 40 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, wsParticipacion, 'Participación')

    const wsComentarios = XLSX.utils.aoa_to_sheet([
      ['Fecha', 'Curso', 'Periodo', 'Departamento', 'Impedimentos', 'Lo más valioso', 'Sugerencias'],
      ...comentarios.map((c) => [
        c.fecha ? new Date(c.fecha).toLocaleDateString('es-MX') : '',
        c.curso,
        c.periodo,
        c.departamento,
        c.impedimentos,
        c.valioso,
        c.sugerencias,
      ]),
    ])
    wsComentarios['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 16 }, { wch: 30 }, { wch: 30 }, { wch: 40 }, { wch: 40 }]
    XLSX.utils.book_append_sheet(wb, wsComentarios, 'Comentarios')

    XLSX.writeFile(wb, `Reporte_Encuesta_Opinion_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // Texto de filtros aplicados, reutilizado en el PDF y el Word
  function resumenFiltros() {
    const periodoTexto = filtroPeriodo
      ? opciones.periodos.find(([id]) => id === filtroPeriodo)?.[1]
      : filtroAnio || 'Todos'
    const cursoTexto = filtroCurso ? opciones.cursos.find(([id]) => id === filtroCurso)?.[1] : 'Todos'
    return `Periodo: ${periodoTexto} · Curso: ${cursoTexto} · Departamento: ${filtroDepartamento || 'Todos'} · Género: ${filtroGenero || 'Todos'} · Tipo: ${filtroTipo || 'Todos'}`
  }

  const SECCIONES_PREGUNTAS = [
    ['A', 'Sección A — Seguimiento del periodo anterior'],
    ['B', 'Sección B — Evaluación del curso'],
    ['C', 'Sección C — Pertinencia del curso'],
  ]

  async function exportarPDFInforme() {
    const doc = new jsPDF()
    const titulo = 'Reporte de Encuesta de Opinión — ITD-AD-FO-09'
    const subtitulos = [resumenFiltros()]

    let y = await dibujarEncabezadoPDF(doc, titulo, subtitulos)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Resumen de Participación', 14, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [['Indicador', 'Valor']],
      body: [
        ['Total de respuestas', filtradas.length],
        ['Cursos representados', participacionPorCurso.length],
        [
          'Departamento con más participación',
          departamentoConMasParticipacion
            ? `${departamentoConMasParticipacion.departamento} (${departamentoConMasParticipacion.cantidad})`
            : '—',
        ],
        ['Primera vez sobre el tema (Sí / No)', `${primeraVez.si} / ${primeraVez.no}`],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [27, 57, 106] },
    })
    y = doc.lastAutoTable.finalY + 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Participantes por curso', 14, y)
    y += 3
    autoTable(doc, {
      startY: y,
      head: [['Curso', 'Participantes']],
      body: participacionPorCurso.map((p) => [p.curso, p.cantidad]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [27, 57, 106] },
      columnStyles: { 0: { cellWidth: 150 } },
    })
    y = doc.lastAutoTable.finalY + 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Participación por departamento y periodo', 14, y)
    y += 3
    autoTable(doc, {
      startY: y,
      head: [['Periodo', 'Departamento', 'Participantes']],
      body: participacionPorDepartamentoYPeriodo.map((p) => [p.periodo, p.departamento, p.cantidad]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [27, 57, 106] },
    })

    for (const [codigoSeccion, tituloSeccion] of SECCIONES_PREGUNTAS) {
      doc.addPage()
      let yy = await dibujarEncabezadoPDF(doc, titulo, subtitulos)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(tituloSeccion, 14, yy)
      yy += 4
      const preguntasSeccion = resultadoPreguntas.filter((p) => p.seccion === codigoSeccion)
      autoTable(doc, {
        startY: yy,
        head: [['Pregunta', 'Prom.', '1', '2', '3', '4', '5', 'Total']],
        body: preguntasSeccion.map((p) => [p.texto, p.promedio.toFixed(2), ...p.distribucion, p.total]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [27, 57, 106] },
        columnStyles: { 0: { cellWidth: 95 } },
      })
    }

    doc.save(`Informe_Encuesta_Opinion_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  function filaWord(celdas, { negritas = false } = {}) {
    return new TableRow({
      children: celdas.map(
        (texto) =>
          new TableCell({
            width: { size: 100 / celdas.length, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: String(texto), bold: negritas })] })],
          })
      ),
    })
  }

  function tablaWord(encabezados, filas) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [filaWord(encabezados, { negritas: true }), ...filas.map((f) => filaWord(f))],
    })
  }

  async function exportarWordInforme() {
    let logoTecnmBuffer, logoItdBuffer
    try {
      ;[logoTecnmBuffer, logoItdBuffer] = await Promise.all([
        cargarImagenArrayBuffer(URL_LOGO_TECNM),
        cargarImagenArrayBuffer(URL_LOGO_ITD),
      ])
    } catch (err) {
      console.warn('No se pudieron cargar los logotipos para el Word:', err)
    }

    const encabezadoLogos = new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        ...(logoTecnmBuffer
          ? [new ImageRun({ data: logoTecnmBuffer, type: 'jpg', transformation: { width: 110, height: 48 } })]
          : []),
        new TextRun({ text: '     ' }),
        ...(logoItdBuffer
          ? [new ImageRun({ data: logoItdBuffer, type: 'png', transformation: { width: 50, height: 59 } })]
          : []),
      ],
    })

    const bloquesPreguntas = SECCIONES_PREGUNTAS.flatMap(([codigo, tituloSeccion]) => {
      const preguntasSeccion = resultadoPreguntas.filter((p) => p.seccion === codigo)
      return [
        new Paragraph({ text: tituloSeccion, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } }),
        tablaWord(
          ['Pregunta', 'Prom.', '1', '2', '3', '4', '5', 'Total'],
          preguntasSeccion.map((p) => [p.texto, p.promedio.toFixed(2), ...p.distribucion, p.total])
        ),
      ]
    })

    const doc = new Document({
      sections: [
        {
          children: [
            encabezadoLogos,
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 100 },
              children: [new TextRun({ text: 'Reporte de Encuesta de Opinión — ITD-AD-FO-09', bold: true, size: 28 })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 },
              children: [new TextRun({ text: resumenFiltros(), size: 18, color: '555555' })],
            }),
            new Paragraph({ text: 'Resumen de Participación', heading: HeadingLevel.HEADING_2, spacing: { after: 150 } }),
            tablaWord(
              ['Indicador', 'Valor'],
              [
                ['Total de respuestas', filtradas.length],
                ['Cursos representados', participacionPorCurso.length],
                [
                  'Departamento con más participación',
                  departamentoConMasParticipacion
                    ? `${departamentoConMasParticipacion.departamento} (${departamentoConMasParticipacion.cantidad})`
                    : '—',
                ],
                ['Primera vez sobre el tema (Sí / No)', `${primeraVez.si} / ${primeraVez.no}`],
              ]
            ),
            new Paragraph({ text: 'Participantes por curso', heading: HeadingLevel.HEADING_3, spacing: { before: 300, after: 150 } }),
            tablaWord(['Curso', 'Participantes'], participacionPorCurso.map((p) => [p.curso, p.cantidad])),
            new Paragraph({
              text: 'Participación por departamento y periodo',
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 300, after: 150 },
            }),
            tablaWord(
              ['Periodo', 'Departamento', 'Participantes'],
              participacionPorDepartamentoYPeriodo.map((p) => [p.periodo, p.departamento, p.cantidad])
            ),
            ...bloquesPreguntas,
          ],
        },
      ],
    })

    const blob = await Packer.toBlob(doc)
    saveAs(blob, `Informe_Encuesta_Opinion_${new Date().toISOString().slice(0, 10)}.docx`)
  }

  if (cargando) {
    return <p className="text-sm text-itd-navyDark/60">Cargando respuestas de la encuesta…</p>
  }

  return (
    <div className="space-y-5">
      {errorMsg && <p className="text-sm text-itd-guinda">{errorMsg}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-itd-navyDark/60 mb-1">Año</label>
          <select
            value={filtroAnio}
            onChange={(e) => setFiltroAnio(e.target.value)}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {opciones.anios.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-itd-navyDark/60 mb-1">Periodo</label>
          <select
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(e.target.value)}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm min-w-[160px]"
          >
            <option value="">Todos</option>
            {opciones.periodos.map(([id, nombre]) => (
              <option key={id} value={id}>{nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-itd-navyDark/60 mb-1">Curso</label>
          <select
            value={filtroCurso}
            onChange={(e) => setFiltroCurso(e.target.value)}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm w-56 max-w-full truncate"
          >
            <option value="">Todos</option>
            {opciones.cursos.map(([id, nombre]) => (
              <option key={id} value={id} title={nombre}>{nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-itd-navyDark/60 mb-1">Departamento</label>
          <select
            value={filtroDepartamento}
            onChange={(e) => setFiltroDepartamento(e.target.value)}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm w-56 max-w-full truncate"
          >
            <option value="">Todos</option>
            {opciones.departamentos.map((d) => (
              <option key={d} value={d} title={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-itd-navyDark/60 mb-1">Género</label>
          <select
            value={filtroGenero}
            onChange={(e) => setFiltroGenero(e.target.value)}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {opciones.generos.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-itd-navyDark/60 mb-1">Tipo</label>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {opciones.tipos.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <button
          onClick={exportarExcel}
          className="rounded-lg bg-green-700 text-white px-4 py-2 text-sm font-semibold hover:bg-green-800"
        >
          ⬇ Exportar Excel
        </button>
        <button
          onClick={exportarPDFInforme}
          className="rounded-lg bg-itd-guinda text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
        >
          ⬇ Exportar PDF
        </button>
        <button
          onClick={exportarWordInforme}
          className="rounded-lg bg-blue-800 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-900"
        >
          ⬇ Exportar Word
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-itd-navy/10 p-4">
          <p className="text-2xl font-bold text-itd-navy">{filtradas.length}</p>
          <p className="text-xs text-itd-navyDark/60">Respuestas</p>
        </div>
        <div className="rounded-xl border border-itd-navy/10 p-4">
          <p className="text-2xl font-bold text-green-700">{participacionPorCurso.length}</p>
          <p className="text-xs text-itd-navyDark/60">Cursos representados</p>
        </div>
        <div className="rounded-xl border border-itd-navy/10 p-4">
          <p className="text-lg font-bold text-amber-600 truncate" title={departamentoConMasParticipacion?.departamento}>
            {departamentoConMasParticipacion?.departamento || '—'}
          </p>
          <p className="text-xs text-itd-navyDark/60">
            Depto. con más participación {departamentoConMasParticipacion ? `(${departamentoConMasParticipacion.cantidad})` : ''}
          </p>
        </div>
        <div className="rounded-xl border border-itd-navy/10 p-4">
          <p className="text-2xl font-bold text-itd-guinda">
            {primeraVez.si}/{primeraVez.total}
          </p>
          <p className="text-xs text-itd-navyDark/60">Primera vez sobre el tema (Sí)</p>
        </div>
      </div>

      <div className="flex rounded-lg border border-itd-navy/20 overflow-hidden w-fit">
        <button
          onClick={() => setVista('preguntas')}
          className={`px-4 py-2 text-sm font-medium ${vista === 'preguntas' ? 'bg-itd-navy text-white' : 'bg-white text-itd-navyDark'}`}
        >
          Preguntas
        </button>
        <button
          onClick={() => setVista('participacion')}
          className={`px-4 py-2 text-sm font-medium ${vista === 'participacion' ? 'bg-itd-navy text-white' : 'bg-white text-itd-navyDark'}`}
        >
          Participación
        </button>
        <button
          onClick={() => setVista('comentarios')}
          className={`px-4 py-2 text-sm font-medium ${vista === 'comentarios' ? 'bg-itd-navy text-white' : 'bg-white text-itd-navyDark'}`}
        >
          Comentarios
        </button>
        <button
          onClick={() => setVista('graficas')}
          className={`px-4 py-2 text-sm font-medium ${vista === 'graficas' ? 'bg-itd-navy text-white' : 'bg-white text-itd-navyDark'}`}
        >
          Gráficas
        </button>
      </div>

      {vista === 'preguntas' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-itd-navy/20 text-left text-itd-navyDark/70">
                <th className="py-2 pr-2">Sec.</th>
                <th className="py-2 pr-4">Pregunta</th>
                <th className="py-2 pr-2 text-center">Promedio</th>
                <th className="py-2 pr-2 text-center">1</th>
                <th className="py-2 pr-2 text-center">2</th>
                <th className="py-2 pr-2 text-center">3</th>
                <th className="py-2 pr-2 text-center">4</th>
                <th className="py-2 pr-2 text-center">5</th>
                <th className="py-2 text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {resultadoPreguntas.map((p) => (
                <tr key={p.codigo} className="border-b border-itd-navy/10 align-top">
                  <td className="py-1.5 pr-2 text-itd-navyDark/60">{p.seccion}</td>
                  <td className="py-1.5 pr-4 text-itd-navyDark">{p.texto}</td>
                  <td className="py-1.5 pr-2 text-center font-semibold text-itd-navyDark">{p.promedio.toFixed(2)}</td>
                  {p.distribucion.map((n, i) => (
                    <td key={i} className="py-1.5 pr-2 text-center text-itd-navyDark/70">{n}</td>
                  ))}
                  <td className="py-1.5 text-center text-itd-navyDark/70">{p.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-itd-navyDark/50 mt-3">
            ¿Primera vez que toma un curso sobre el tema? Sí: <strong>{primeraVez.si}</strong> · No: <strong>{primeraVez.no}</strong>
          </p>
        </div>
      )}

      {vista === 'participacion' && (
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-itd-navy mb-2">Participantes por curso</h3>
            <table className="w-full text-sm border-collapse">
              <tbody>
                {participacionPorCurso.map((p) => (
                  <tr key={p.curso} className="border-b border-itd-navy/10">
                    <td className="py-1.5 pr-4 text-itd-navyDark/80">{p.curso}</td>
                    <td className="py-1.5 font-semibold text-itd-navyDark text-right">{p.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-itd-navy mb-2">Participación por departamento y periodo</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-itd-navy/20 text-left text-itd-navyDark/70">
                  <th className="py-1.5 pr-2">Periodo</th>
                  <th className="py-1.5 pr-2">Departamento</th>
                  <th className="py-1.5 text-right">Participantes</th>
                </tr>
              </thead>
              <tbody>
                {participacionPorDepartamentoYPeriodo.map((p, i) => (
                  <tr key={i} className="border-b border-itd-navy/10">
                    <td className="py-1.5 pr-2 text-itd-navyDark/70 whitespace-nowrap">{p.periodo}</td>
                    <td className="py-1.5 pr-2 text-itd-navyDark/80">{p.departamento}</td>
                    <td className="py-1.5 text-right font-semibold text-itd-navyDark">{p.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {vista === 'graficas' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TarjetaGrafica titulo="Distribución por Género">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={datosGenero} dataKey="valor" nameKey="nombre" innerRadius={50} outerRadius={80} paddingAngle={2} label={(d) => `${d.nombre} ${(d.percent * 100).toFixed(0)}%`}>
                  {datosGenero.map((d) => (
                    <Cell key={d.nombre} fill={colorGenero(d.nombre)} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            {datosGenero.length === 0 && (
              <p className="text-xs text-itd-navyDark/40 text-center mt-2">Sin dato de género en las respuestas filtradas.</p>
            )}
          </TarjetaGrafica>

          <TarjetaGrafica titulo="Tipo (Docente / Profesional)">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={datosTipo} dataKey="valor" nameKey="nombre" innerRadius={50} outerRadius={80} paddingAngle={2} label={(d) => `${d.nombre} ${(d.percent * 100).toFixed(0)}%`}>
                  {datosTipo.map((d) => (
                    <Cell key={d.nombre} fill={colorTipo(d.nombre)} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </TarjetaGrafica>

          <TarjetaGrafica titulo="Participación por Departamento">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={datosDepartamentoPie} dataKey="valor" nameKey="nombre" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {datosDepartamentoPie.map((d, i) => (
                    <Cell key={d.nombre} fill={COLORES_DEPARTAMENTO[i % COLORES_DEPARTAMENTO.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </TarjetaGrafica>
        </div>
      )}

      {vista === 'comentarios' && (
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-itd-navy/20 text-left text-itd-navyDark/70">
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Curso</th>
                <th className="py-2 pr-3">Impedimentos</th>
                <th className="py-2 pr-3">Lo más valioso</th>
                <th className="py-2">Sugerencias</th>
              </tr>
            </thead>
            <tbody>
              {comentarios.map((c, i) => (
                <tr key={i} className="border-b border-itd-navy/10 align-top">
                  <td className="py-1.5 pr-3 text-itd-navyDark/60 whitespace-nowrap">
                    {c.fecha ? new Date(c.fecha).toLocaleDateString('es-MX') : ''}
                  </td>
                  <td className="py-1.5 pr-3 text-itd-navyDark/70">{c.curso}</td>
                  <td className="py-1.5 pr-3 text-itd-navyDark/70">{c.impedimentos}</td>
                  <td className="py-1.5 pr-3 text-itd-navyDark">{c.valioso}</td>
                  <td className="py-1.5 text-itd-navyDark">{c.sugerencias}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-itd-navyDark/50 mt-2">
            {comentarios.length} respuestas con comentarios o impedimentos registrados.
          </p>
        </div>
      )}
    </div>
  )
}
