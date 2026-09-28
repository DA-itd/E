import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import * as XLSX from 'xlsx'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
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

const PREGUNTAS_POR_DEFECTO = [
  { codigo: 'a1', seccion: 'A', orden: 1, texto: 'Los cursos me ayudaron a mejorar mi desempeño como docente (función, conceptos y herramientas aplicables).' },
  { codigo: 'a2', seccion: 'A', orden: 2, texto: 'Los cursos contribuyeron a mi desarrollo personal y/o profesional.' },
  { codigo: 'a3', seccion: 'A', orden: 3, texto: 'He podido aplicar en mi práctica docente cotidiana lo aprendido en los cursos.' },
  { codigo: 'a4', seccion: 'A', orden: 4, texto: 'Los cursos fortalecieron mi integración y colaboración con compañeros de trabajo.' },
  { codigo: 'a5', seccion: 'A', orden: 5, texto: 'Los cursos me ayudaron a comprender mejor los procesos del Instituto en mi rol como docente.' },
  { codigo: 'b1', seccion: 'B', orden: 1, texto: 'Se expuso el objetivo y temario del curso; mostró dominio del contenido abordado.' },
  { codigo: 'b2', seccion: 'B', orden: 2, texto: 'Fomentó la participación, aclaró dudas y dio retroalimentación a los ejercicios realizados.' },
  { codigo: 'b3', seccion: 'B', orden: 3, texto: 'Inició y concluyó puntualmente las sesiones.' },
  { codigo: 'b4', seccion: 'B', orden: 4, texto: 'El material didáctico fue útil y legible a lo largo del curso.' },
  { codigo: 'b5', seccion: 'B', orden: 5, texto: 'La variedad del material didáctico fue suficiente para apoyar su aprendizaje.' },
  { codigo: 'b6', seccion: 'B', orden: 6, texto: 'La distribución del tiempo fue adecuada para cubrir el contenido del curso.' },
  { codigo: 'b7', seccion: 'B', orden: 7, texto: 'Los temas fueron suficientes para alcanzar el objetivo del curso.' },
  { codigo: 'b8', seccion: 'B', orden: 8, texto: 'El curso comprendió ejercicios de práctica relacionados con el contenido.' },
  { codigo: 'b9', seccion: 'B', orden: 9, texto: 'El curso cubrió sus expectativas.' },
  { codigo: 'b10', seccion: 'B', orden: 10, texto: 'Las condiciones del aula (iluminación, ventilación y aseo) fueron adecuadas.' },
  { codigo: 'b11', seccion: 'B', orden: 11, texto: 'Los servicios de apoyo (sanitarios, café y coordinación del curso) fueron adecuados.' },
  { codigo: 'c1', seccion: 'C', orden: 1, texto: 'El tema del curso respondía a una necesidad real de mi práctica docente.' },
  { codigo: 'c2', seccion: 'C', orden: 2, texto: 'Recomendaría este curso a otros colegas del Instituto.' },
]

function TarjetaGrafica({ titulo, children, alto = 260 }) {
  return (
    <div className="rounded-2xl border border-itd-navy/10 bg-white p-4 shadow-sm min-w-0">
      <h3 className="text-sm font-semibold text-itd-navyDark/70 mb-2 truncate">{titulo}</h3>
      <div style={{ width: '100%', height: alto, minHeight: alto }} className="relative min-w-0">
        {children}
      </div>
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
  // filtroGenero removido
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
      setPreguntas(preg && preg.length > 0 ? preg : PREGUNTAS_POR_DEFECTO)
    } catch (err) {
      console.error(err)
      setErrorMsg('No se pudieron cargar las respuestas: ' + err.message)
      setPreguntas(PREGUNTAS_POR_DEFECTO)
    }
    setCargando(false)
  }

  // Opciones de filtro derivadas de los datos ya cargados (sin ir de nuevo a la BD)
  const opciones = useMemo(() => {
    const anios = new Set()
    const periodos = new Map()
    const cursos = new Map()
    const departamentos = new Set()
    const tipos = new Set()
    for (const r of respuestas) {
      if (r.periodo_anio) anios.add(r.periodo_anio)
      // el selector de Periodo solo muestra los periodos del año elegido
      if (r.convocatoria_id && (!filtroAnio || r.periodo_anio === Number(filtroAnio))) {
        periodos.set(r.convocatoria_id, r.periodo_nombre)
      }
      if (r.curso_id) cursos.set(r.curso_id, r.curso_nombre)
      if (r.departamento) departamentos.add(r.departamento)
      if (r.tipo_curso) tipos.add(r.tipo_curso)
    }
    return {
      anios: [...anios].sort((a, b) => b - a),
      periodos: [...periodos.entries()],
      cursos: [...cursos.entries()].sort((a, b) => a[1].localeCompare(b[1])),
      departamentos: [...departamentos].sort(),
      generos: [],
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
      if (filtroGenero) {
        if (filtroGenero === 'Sin especificar') {
          if (r.genero) return false
        } else if (r.genero !== filtroGenero) {
          return false
        }
      }
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

  // Promedios de preguntas ordenadas para la gráfica de barras
  const datosPromediosSeccionB = useMemo(() => {
    return resultadoPreguntas
      .filter((p) => p.seccion === 'B')
      .map((p) => ({
        pregunta: p.codigo.toUpperCase(),
        textoCorto: p.texto.length > 40 ? p.texto.slice(0, 40) + '…' : p.texto,
        promedio: Number(p.promedio.toFixed(2)),
      }))
  }, [resultadoPreguntas])

  // Semáforo por Departamento
  const departamentosSemaforo = useMemo(() => {
    const mapa = new Map()
    for (const r of filtradas) {
      const depto = r.departamento || 'Sin Departamento'
      if (!mapa.has(depto)) {
        mapa.set(depto, {
          nombre: depto,
          total: 0,
          valores: [],
          cursos: new Set(),
        })
      }
      const d = mapa.get(depto)
      d.total++
      if (r.curso_id) d.cursos.add(r.curso_id)
      for (const p of preguntas) {
        const v = r[p.codigo]
        if (typeof v === 'number' && v >= 1 && v <= 5) d.valores.push(v)
      }
    }
    return [...mapa.values()].map((d) => {
      const promedio = d.valores.length > 0 ? d.valores.reduce((a, b) => a + b, 0) / d.valores.length : 0
      let semaforo = 'verde'
      let textoSemaforo = '>= 4.5 (Excelente)'
      let colorClass = 'bg-emerald-50 text-emerald-800 border-emerald-300'
      let badgeClass = 'bg-emerald-500'
      if (promedio < 4.0) {
        semaforo = 'rojo'
        textoSemaforo = '< 4.0 (Atención prioritaria)'
        colorClass = 'bg-rose-50 text-rose-800 border-rose-300'
        badgeClass = 'bg-rose-500'
      } else if (promedio < 4.5) {
        semaforo = 'amarillo'
        textoSemaforo = '4.0 - 4.49 (Seguimiento)'
        colorClass = 'bg-amber-50 text-amber-800 border-amber-300'
        badgeClass = 'bg-amber-500'
      }
      return {
        nombre: d.nombre,
        total: d.total,
        totalCursos: d.cursos.size,
        promedio: Number(promedio.toFixed(2)),
        semaforo,
        textoSemaforo,
        colorClass,
        badgeClass,
      }
    }).sort((a, b) => b.promedio - a.promedio)
  }, [filtradas, preguntas])

  // Indicador de Impacto por Curso (Satisfacción vs Aplicación práctica)
  const cursosImpacto = useMemo(() => {
    const mapa = new Map()
    for (const r of filtradas) {
      const cid = r.curso_id || 'sin-id'
      if (!mapa.has(cid)) {
        mapa.set(cid, {
          id: cid,
          nombre: r.curso_nombre || 'Sin nombre',
          total: 0,
          valoresSat: [],
          valoresImp: [],
        })
      }
      const c = mapa.get(cid)
      c.total++
      // Satisfacción B1..B9
      for (let i = 1; i <= 9; i++) {
        if (typeof r[`b${i}`] === 'number') c.valoresSat.push(r[`b${i}`])
      }
      // Aplicación práctica A3 y C1
      if (typeof r.a3 === 'number') c.valoresImp.push(r.a3)
      if (typeof r.c1 === 'number') c.valoresImp.push(r.c1)
    }
    return [...mapa.values()].map((c) => {
      const promSat = c.valoresSat.length > 0 ? c.valoresSat.reduce((a, b) => a + b, 0) / c.valoresSat.length : 0
      const promImp = c.valoresImp.length > 0 ? c.valoresImp.reduce((a, b) => a + b, 0) / c.valoresImp.length : 0
      return {
        ...c,
        promedioSatisfaccion: Number(promSat.toFixed(2)),
        promedioImpacto: Number(promImp.toFixed(2)),
        repetir: promSat >= 4.5 && promImp >= 4.3,
      }
    }).sort((a, b) => b.promedioSatisfaccion - a.promedioSatisfaccion)
  }, [filtradas])

  // Distribución de impedimentos
  const datosImpedimentos = useMemo(() => {
    const mapa = new Map()
    for (const r of filtradas) {
      if (!r.impedimentos || !Array.isArray(r.impedimentos)) continue
      for (const imp of r.impedimentos) {
        const limp = (imp || '').trim()
        if (!limp) continue
        const cat = limp.startsWith('Otro:') ? 'Otro impedimento' : limp
        mapa.set(cat, (mapa.get(cat) || 0) + 1)
      }
    }
    return [...mapa.entries()]
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
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

  // Texto de filtros aplicados, reutilizado en el PDF y el Word (en 2 líneas para evitar traslape con logos)
  function resumenFiltros() {
    const periodoTexto = filtroPeriodo
      ? opciones.periodos.find(([id]) => id === filtroPeriodo)?.[1]
      : filtroAnio || 'Todos'
    const cursoTexto = filtroCurso ? opciones.cursos.find(([id]) => id === filtroCurso)?.[1] : 'Todos'
    return [
      `Periodo: ${periodoTexto}  |  Curso: ${cursoTexto}`,
      `Departamento: ${filtroDepartamento || 'Todos'}  |  Género: ${filtroGenero || 'Todos'}  |  Tipo: ${filtroTipo || 'Todos'}`,
    ]
  }

  const SECCIONES_PREGUNTAS = [
    ['A', 'Sección A — Seguimiento del periodo anterior'],
    ['B', 'Sección B — Evaluación del curso'],
    ['C', 'Sección C — Pertinencia del curso'],
  ]

  async function exportarPDFInforme() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
    const titulo = 'Reporte de Encuesta de Opinión — ITD-AD-FO-09'
    const subtitulos = resumenFiltros()

    let y = await dibujarEncabezadoPDF(doc, titulo, subtitulos)

    doc.setFontSize(10.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(27, 57, 106)
    doc.text('Resumen de Participación', 14, y)
    y += 4

    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
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
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [27, 57, 106], halign: 'center' },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 68, halign: 'center' },
      },
    })
    y = doc.lastAutoTable.finalY + 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(27, 57, 106)
    doc.text('Participantes por curso', 14, y)
    y += 3
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Curso', 'Participantes']],
      body: participacionPorCurso.map((p) => [p.curso, p.cantidad]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [27, 57, 106], halign: 'center' },
      columnStyles: {
        0: { cellWidth: 154 },
        1: { cellWidth: 34, halign: 'center' },
      },
    })
    y = doc.lastAutoTable.finalY + 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(27, 57, 106)
    doc.text('Participación por departamento y periodo', 14, y)
    y += 3
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Periodo', 'Departamento', 'Participantes']],
      body: participacionPorDepartamentoYPeriodo.map((p) => [p.periodo, p.departamento, p.cantidad]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [27, 57, 106], halign: 'center' },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 110 },
        2: { cellWidth: 33, halign: 'center' },
      },
    })

    for (const [codigoSeccion, tituloSeccion] of SECCIONES_PREGUNTAS) {
      doc.addPage()
      let yy = await dibujarEncabezadoPDF(doc, titulo, subtitulos)
      doc.setFontSize(10.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(27, 57, 106)
      doc.text(tituloSeccion, 14, yy)
      yy += 4
      const preguntasSeccion = resultadoPreguntas.filter((p) => p.seccion === codigoSeccion)
      autoTable(doc, {
        startY: yy,
        margin: { left: 14, right: 14 },
        head: [['Pregunta', 'Prom.', '1', '2', '3', '4', '5', 'Total']],
        body: preguntasSeccion.map((p) => [p.texto, p.promedio.toFixed(2), ...p.distribucion, p.total]),
        styles: { fontSize: 7.5 },
        headStyles: { fillColor: [27, 57, 106], halign: 'center' },
        columnStyles: {
          0: { cellWidth: 104 },
          1: { cellWidth: 14, halign: 'center' },
          2: { cellWidth: 11, halign: 'center' },
          3: { cellWidth: 11, halign: 'center' },
          4: { cellWidth: 11, halign: 'center' },
          5: { cellWidth: 11, halign: 'center' },
          6: { cellWidth: 11, halign: 'center' },
          7: { cellWidth: 15, halign: 'center' },
        },
      })
    }

    doc.save(`Informe_Encuesta_Opinion_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  // Generación del Formato Oficial para Diagnóstico y Concentrado de Necesidades (ITD-AC-PO-10-01) en PDF
  // Con 2 páginas exactas, cajetines ISO oficiales y 4 renglones vacíos para completar
  async function exportarFormatoNecesidadesPDF() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
    const nombreDepto = filtroDepartamento || 'DEPARTAMENTO DE SISTEMAS Y COMPUTACIÓN'

    // ======================== PÁGINA 1 ========================
    doc.setDrawColor(27, 57, 106)
    doc.setLineWidth(0.5)
    doc.rect(10, 8, 196, 262)

    // Cabecera en 3 casillas según formato oficial ISO
    doc.rect(10, 8, 36, 26)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(27, 57, 106)
    doc.text('TECNM / ITD', 28, 22, { align: 'center' })

    doc.rect(46, 8, 122, 26)
    doc.setFontSize(9.5)
    doc.text('INSTITUTO TECNOLÓGICO DE DURANGO', 107, 14, { align: 'center' })
    doc.setFontSize(8)
    doc.setTextColor(30, 41, 59)
    doc.text('Formato para Diagnóstico y Concentrado de Necesidades de Formación', 107, 19, { align: 'center' })
    doc.text('y Actualización Docente y Profesional', 107, 23, { align: 'center' })
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    doc.text('Referencia a las Normas ISO 9001:2015 7.2, 7.3, ISO 14001:2015 7.2, 7.3, ISO 45001:2018 4.4.2 e ISO 50001:2018 4.5.2', 107, 30, { align: 'center' })

    doc.rect(168, 8, 38, 26)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(27, 57, 106)
    doc.text('Código: ITD-AC-PO-10-01', 187, 15, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(51, 65, 85)
    doc.text('Revisión: 0', 187, 21, { align: 'center' })
    doc.text('Página 1 de 2', 187, 27, { align: 'center' })

    // Metadatos
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(27, 57, 106)
    doc.text('Subdirección Académica', 14, 38)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    doc.text(`Departamento Académico: ${nombreDepto}`, 14, 43)
    doc.text(`Fecha de realización del diagnóstico: ${new Date().toLocaleDateString('es-MX')}`, 14, 48)

    // Sección a)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(27, 57, 106)
    doc.text('a) PRIORIZAR LAS ASIGNATURAS EN LAS QUE SE REQUIERA FORMACIÓN O ACTUALIZACIÓN (CARRERA GENÉRICA)', 14, 54)

    const filasBodyA = [
      [
        'Asignaturas Básicas / Eje Docente 1',
        'Estrategias y Metodologías de Aprendizaje Activo en el Aula',
        '15',
        'Enero-Junio / Ago-Dic',
        'Propuesto por Desarrollo Académico (Encuesta)',
      ],
      [
        'Asignaturas Básicas / Eje Docente 2',
        'Herramientas Digitales e Inteligencia Artificial en la Docencia',
        '12',
        'Enero-Junio / Ago-Dic',
        'Desarrollo Académico ITD',
      ],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
    ]

    autoTable(doc, {
      startY: 56,
      margin: { left: 12, right: 12 },
      head: [['Asignaturas requeridas', 'Contenidos temáticos requeridos', 'No. Prof.', 'Periodo', 'Facilitadores propuestos']],
      body: filasBodyA,
      theme: 'grid',
      headStyles: { fillColor: [27, 57, 106], fontSize: 7, halign: 'center' },
      styles: { fontSize: 6.5, minCellHeight: 7 },
      columnStyles: {
        0: { cellWidth: 46 },
        1: { cellWidth: 64 },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 26, halign: 'center' },
        4: { cellWidth: 40 },
      },
    })

    // Sección b)
    let currentY = doc.lastAutoTable.finalY + 5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(27, 57, 106)
    doc.text('b) PRIORIZAR LAS ASIGNATURAS EN LOS MÓDULOS DE ESPECIALIDAD (AVALADOS POR LA ACADEMIA)', 14, currentY)

    const filasBodyB = [
      [
        'Módulo de Especialidad 1',
        'Python y Análisis de Datos Orientados a la Especialidad',
        '10',
        'Enero-Junio',
        'Instructor Especialista en el Área',
      ],
      [
        'Módulo de Especialidad 2',
        'Automatización, Control y Sistemas Aplicados',
        '8',
        'Agosto-Diciembre',
        'Instructor Especialista en el Área',
      ],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
    ]

    autoTable(doc, {
      startY: currentY + 2,
      margin: { left: 12, right: 12 },
      head: [['Asignaturas especialidad', 'Contenidos temáticos requeridos', 'No. Prof.', 'Periodo', 'Facilitadores propuestos']],
      body: filasBodyB,
      theme: 'grid',
      headStyles: { fillColor: [27, 57, 106], fontSize: 7, halign: 'center' },
      styles: { fontSize: 6.5, minCellHeight: 7 },
      columnStyles: {
        0: { cellWidth: 46 },
        1: { cellWidth: 64 },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 26, halign: 'center' },
        4: { cellWidth: 40 },
      },
    })

    // Firmas Página 1
    currentY = doc.lastAutoTable.finalY + 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(30, 41, 59)
    doc.text('Jefe del Departamento Académico: _______________________      Firma: ____________________', 14, currentY + 4)
    doc.text('Presidente(s) de Academia: ___________________________      Firma: ____________________', 14, currentY + 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    doc.text('c.c.p. Subdirección Académica', 14, currentY + 15)

    // ======================== PÁGINA 2 ========================
    doc.addPage()
    doc.rect(10, 8, 196, 262)

    doc.rect(10, 8, 36, 26)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(27, 57, 106)
    doc.text('TECNM / ITD', 28, 22, { align: 'center' })

    doc.rect(46, 8, 122, 26)
    doc.setFontSize(9.5)
    doc.text('INSTITUTO TECNOLÓGICO DE DURANGO', 107, 14, { align: 'center' })
    doc.setFontSize(8)
    doc.setTextColor(30, 41, 59)
    doc.text('CONCENTRADO DEL DIAGNÓSTICO DE NECESIDADES DE FORMACIÓN', 107, 19, { align: 'center' })
    doc.text('Y ACTUALIZACIÓN DOCENTE Y PROFESIONAL', 107, 23, { align: 'center' })
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    doc.text('Referencia a las Normas ISO 9001:2015 7.2, 7.3, ISO 14001:2015 7.2, 7.3, ISO 45001:2018 4.4.2 e ISO 50001:2018 4.5.2', 107, 30, { align: 'center' })

    doc.rect(168, 8, 38, 26)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(27, 57, 106)
    doc.text('Código: ITD-AC-PO-10-01', 187, 15, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(51, 65, 85)
    doc.text('Revisión: 0', 187, 21, { align: 'center' })
    doc.text('Página 2 de 2', 187, 27, { align: 'center' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(27, 57, 106)
    doc.text('Subdirección Académica', 14, 38)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    doc.text(`Departamento Académico: ${nombreDepto}`, 14, 43)
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, 14, 48)

    // Sección a) Página 2
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(27, 57, 106)
    doc.text('a) ACTIVIDADES O EVENTOS PARA LA FORMACIÓN Y ACTUALIZACIÓN DOCENTE', 14, 54)

    const filasP2Docente = [
      [
        'Curso-Taller: Estrategias y Metodologías de Aprendizaje Activo en el Aula',
        `${nombreDepto} (15 a 25 profesores)`,
        'Próximo Periodo Intersemestral',
      ],
      [
        'Curso-Taller: Herramientas Digitales e Inteligencia Artificial en la Docencia',
        `${nombreDepto} (15 a 25 profesores)`,
        'Próximo Periodo Intersemestral',
      ],
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ]

    autoTable(doc, {
      startY: 56,
      margin: { left: 12, right: 12 },
      head: [['Actividad o Evento (Cursos, talleres, conferencias)', 'Carrera(s) atendidas / No. profesores', 'Fecha de realización']],
      body: filasP2Docente,
      theme: 'grid',
      headStyles: { fillColor: [27, 57, 106], fontSize: 7, halign: 'center' },
      styles: { fontSize: 7, minCellHeight: 8 },
      columnStyles: {
        0: { cellWidth: 92 },
        1: { cellWidth: 60 },
        2: { cellWidth: 40, halign: 'center' },
      },
    })

    // Sección b) Página 2
    currentY = doc.lastAutoTable.finalY + 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(27, 57, 106)
    doc.text('b) ACTIVIDADES O EVENTOS PARA LA FORMACIÓN Y ACTUALIZACIÓN PROFESIONAL (ESPECIALIDAD)', 14, currentY)

    const filasP2Especialidad = [
      [
        'Taller Especializado: Python y Análisis de Datos Aplicados a la Especialidad',
        `${nombreDepto} (Especialidad)`,
        'Próximo Periodo Intersemestral',
      ],
      [
        'Taller Especializado: Automatización, Control y Sistemas Aplicados',
        `${nombreDepto} (Especialidad)`,
        'Próximo Periodo Intersemestral',
      ],
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ]

    autoTable(doc, {
      startY: currentY + 2,
      margin: { left: 12, right: 12 },
      head: [['Actividad o Evento (Cursos, talleres, conferencias)', 'Carrera(s) atendidas / No. profesores', 'Fecha de realización']],
      body: filasP2Especialidad,
      theme: 'grid',
      headStyles: { fillColor: [27, 57, 106], fontSize: 7, halign: 'center' },
      styles: { fontSize: 7, minCellHeight: 8 },
      columnStyles: {
        0: { cellWidth: 92 },
        1: { cellWidth: 60 },
        2: { cellWidth: 40, halign: 'center' },
      },
    })

    // Firmas Página 2
    currentY = doc.lastAutoTable.finalY + 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(30, 41, 59)
    doc.text('Subdirección Académica: _______________________________      Firma: ____________________', 14, currentY + 4)
    doc.text('Jefe de Departamento Académico: _______________________      Firma: ____________________', 14, currentY + 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)
    doc.text('c.c.p. Archivo', 14, currentY + 15)

    doc.save(`Formato_Necesidades_ITD_AC_PO_10_01_${nombreDepto.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`)
  }

  // Generación del Formato Oficial para Diagnóstico y Concentrado de Necesidades (ITD-AC-PO-10-01) en Word
  async function exportarFormatoNecesidadesWord() {
    const nombreDepto = filtroDepartamento || 'DEPARTAMENTO DE SISTEMAS Y COMPUTACIÓN'

    const filasAGenericas = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Formación Genérica / Asignaturas Básicas 1')] }),
          new TableCell({ children: [new Paragraph('Estrategias y Metodologías de Aprendizaje Activo en el Aula')] }),
          new TableCell({ children: [new Paragraph('15')] }),
          new TableCell({ children: [new Paragraph('Enero - Junio / Agosto - Diciembre')] }),
          new TableCell({ children: [new Paragraph('Propuesto por Desarrollo Académico según Encuesta ITD-AD-FO-09')] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Formación Genérica / Asignaturas Básicas 2')] }),
          new TableCell({ children: [new Paragraph('Herramientas Digitales e Inteligencia Artificial en la Docencia')] }),
          new TableCell({ children: [new Paragraph('12')] }),
          new TableCell({ children: [new Paragraph('Enero - Junio / Agosto - Diciembre')] }),
          new TableCell({ children: [new Paragraph('Desarrollo Académico ITD')] }),
        ],
      }),
      ...Array.from({ length: 4 }).map(() => {
        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
          ],
        })
      }),
    ]

    const tablaAGenerica = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ children: [new Paragraph({ text: 'Asignaturas en la que se requiere formación o actualización', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Contenidos temáticos en que se requiere la formación o actualización', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'No. profesores', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Periodo (enero-junio / agosto-diciembre)', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Facilitadores propuestos (nombre y datos)', bold: true })] }),
          ],
        }),
        ...filasAGenericas,
      ],
    })

    const filasBEspecialidad = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Módulos de Especialidad 1')] }),
          new TableCell({ children: [new Paragraph('Python y Análisis de Datos Orientados a la Especialidad')] }),
          new TableCell({ children: [new Paragraph('10')] }),
          new TableCell({ children: [new Paragraph('Enero - Junio / Agosto - Diciembre')] }),
          new TableCell({ children: [new Paragraph('Instructor Especialista Externo / Academia')] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('Módulos de Especialidad 2')] }),
          new TableCell({ children: [new Paragraph('Automatización, Control y Sistemas Aplicados')] }),
          new TableCell({ children: [new Paragraph('8')] }),
          new TableCell({ children: [new Paragraph('Enero - Junio / Agosto - Diciembre')] }),
          new TableCell({ children: [new Paragraph('Instructor Especialista Externo / Academia')] }),
        ],
      }),
      ...Array.from({ length: 4 }).map(() => {
        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
            new TableCell({ children: [new Paragraph(' ')] }),
          ],
        })
      }),
    ]

    const tablaBEspecialidad = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ children: [new Paragraph({ text: 'Asignaturas de Especialidad', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Contenidos temáticos requeridos', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'No. profesores', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Periodo', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Facilitadores propuestos', bold: true })] }),
          ],
        }),
        ...filasBEspecialidad,
      ],
    })

    const tablaP2Docente = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ children: [new Paragraph({ text: 'Actividad o Evento (Cursos, talleres, conferencias, etc.)', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Carrera(s) a la que se orienta / No. profesores', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Periodo de realización', bold: true })] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('Curso-Taller: Estrategias y Metodologías de Aprendizaje Activo')] }),
            new TableCell({ children: [new Paragraph(`${nombreDepto} (15 a 25 profesores)`)] }),
            new TableCell({ children: [new Paragraph('Próximo Periodo Intersemestral')] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('Curso-Taller: Herramientas Digitales e Inteligencia Artificial')] }),
            new TableCell({ children: [new Paragraph(`${nombreDepto} (15 a 25 profesores)`)] }),
            new TableCell({ children: [new Paragraph('Próximo Periodo Intersemestral')] }),
          ],
        }),
        ...Array.from({ length: 4 }).map(() => {
          return new TableRow({
            children: [
              new TableCell({ children: [new Paragraph(' ')] }),
              new TableCell({ children: [new Paragraph(' ')] }),
              new TableCell({ children: [new Paragraph(' ')] }),
            ],
          })
        }),
      ],
    })

    const tablaP2Profesional = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ children: [new Paragraph({ text: 'Actividad o Evento (Cursos, talleres, conferencias, etc.)', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Carrera(s) a la que se orienta / No. profesores', bold: true })] }),
            new TableCell({ children: [new Paragraph({ text: 'Periodo de realización', bold: true })] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('Taller Especializado: Python y Análisis de Datos')] }),
            new TableCell({ children: [new Paragraph(`${nombreDepto} (Especialidad)`)] }),
            new TableCell({ children: [new Paragraph('Próximo Periodo Intersemestral')] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph('Taller Especializado: Automatización y Control Aplicado')] }),
            new TableCell({ children: [new Paragraph(`${nombreDepto} (Especialidad)`)] }),
            new TableCell({ children: [new Paragraph('Próximo Periodo Intersemestral')] }),
          ],
        }),
        ...Array.from({ length: 4 }).map(() => {
          return new TableRow({
            children: [
              new TableCell({ children: [new Paragraph(' ')] }),
              new TableCell({ children: [new Paragraph(' ')] }),
              new TableCell({ children: [new Paragraph(' ')] }),
            ],
          })
        }),
      ],
    })

    const docWord = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: 'INSTITUTO TECNOLÓGICO DE DURANGO',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: 'Formato para Diagnóstico y Concentrado de Necesidades de Formación y Actualización Docente y Profesional',
              alignment: AlignmentType.CENTER,
              bold: true,
            }),
            new Paragraph({
              text: 'Código: ITD-AC-PO-10-01   |   Revisión: 0   |   Página 1 de 2',
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: 'Referencia a las Normas ISO 9001:2015 7.2, 7.3, ISO 14001:2015 7.2, 7.3, ISO 45001:2018 4.4.2 e ISO 50001:2018 4.5.2',
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Subdirección Académica\n', bold: true }),
                new TextRun({ text: `Departamento Académico: ${nombreDepto}\n`, bold: true }),
                new TextRun({ text: `Fecha de realización del diagnóstico: ${new Date().toLocaleDateString('es-MX')}\n` }),
              ],
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'a) PRIORIZAR LAS ASIGNATURAS EN LAS QUE SE REQUIERA LA FORMACIÓN O ACTUALIZACIÓN DEL PROFESOR EN LA CARRERA GENÉRICA, AVALADOS POR LA ACADEMIA.',
              bold: true,
            }),
            tablaAGenerica,
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'b) PRIORIZAR LAS ASIGNATURAS EN LAS QUE SE REQUIERA LA FORMACIÓN O ACTUALIZACIÓN DEL PROFESOR EN LOS MÓDULOS DE ESPECIALIDAD, AVALADOS POR LA ACADEMIA.',
              bold: true,
            }),
            tablaBEspecialidad,
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'Firmas de Validación:',
              bold: true,
            }),
            new Paragraph({
              children: [
                new TextRun('Jefe del Departamento Académico: _______________________      Firma: _______________\n\n'),
                new TextRun('Presidente(s) de Academia: ___________________________      Firma: _______________\n\n'),
                new TextRun('c.c.p. Subdirección Académica'),
              ],
            }),
          ],
        },
        {
          properties: {},
          children: [
            new Paragraph({
              text: 'INSTITUTO TECNOLÓGICO DE DURANGO',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: 'CONCENTRADO DEL DIAGNÓSTICO DE NECESIDADES DE FORMACIÓN Y ACTUALIZACIÓN DOCENTE Y PROFESIONAL',
              alignment: AlignmentType.CENTER,
              bold: true,
            }),
            new Paragraph({
              text: 'Código: ITD-AC-PO-10-01   |   Revisión: 0   |   Página 2 de 2',
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: 'Referencia a las Normas ISO 9001:2015 7.2, 7.3, ISO 14001:2015 7.2, 7.3, ISO 45001:2018 4.4.2 e ISO 50001:2018 4.5.2',
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Subdirección Académica\n', bold: true }),
                new TextRun({ text: `Departamento Académico: ${nombreDepto}\n`, bold: true }),
                new TextRun({ text: `Fecha: ${new Date().toLocaleDateString('es-MX')}\n` }),
              ],
            }),
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'a) ACTIVIDADES O EVENTOS PARA LA FORMACIÓN Y ACTUALIZACIÓN DOCENTE',
              bold: true,
            }),
            tablaP2Docente,
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'b) ACTIVIDADES O EVENTOS PARA LA FORMACIÓN Y ACTUALIZACIÓN PROFESIONAL (ESPECIALIDAD)',
              bold: true,
            }),
            tablaP2Profesional,
            new Paragraph({ text: '' }),
            new Paragraph({
              text: 'Firmas de Validación:',
              bold: true,
            }),
            new Paragraph({
              children: [
                new TextRun('Subdirección Académica: _______________________________      Firma: _______________\n\n'),
                new TextRun('Jefe del Departamento Académico: _______________________      Firma: _______________\n\n'),
                new TextRun('c.c.p. Archivo'),
              ],
            }),
          ],
        },
      ],
    })

    const blob = await Packer.toBlob(docWord)
    saveAs(blob, `Formato_Necesidades_ITD_AC_PO_10_01_${nombreDepto.replace(/[^a-zA-Z0-9]/g, '_')}.docx`)
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
        <button
          onClick={exportarFormatoNecesidadesPDF}
          title="Descargar Formato para Diagnóstico y Concentrado de Necesidades ITD-AC-PO-10-01 (con renglones para completar)"
          className="rounded-lg bg-slate-800 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-900 cursor-pointer shadow-xs"
        >
          📄 Necesidades (PDF)
        </button>
        <button
          onClick={exportarFormatoNecesidadesWord}
          title="Descargar Formato para Diagnóstico y Concentrado de Necesidades en Word editable (con renglones para completar)"
          className="rounded-lg bg-indigo-900 text-white px-4 py-2 text-sm font-semibold hover:bg-indigo-950 cursor-pointer shadow-xs"
        >
          📝 Necesidades (Word)
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

      <div className="flex flex-wrap rounded-lg border border-itd-navy/20 overflow-hidden w-fit">
        <button
          onClick={() => setVista('semaforo')}
          className={`px-4 py-2 text-sm font-medium ${vista === 'semaforo' ? 'bg-itd-navy text-white' : 'bg-white text-itd-navyDark'}`}
        >
          🚦 Semáforo Departamentos
        </button>
        <button
          onClick={() => setVista('impacto')}
          className={`px-4 py-2 text-sm font-medium ${vista === 'impacto' ? 'bg-itd-navy text-white' : 'bg-white text-itd-navyDark'}`}
        >
          🎯 Impacto por Curso
        </button>
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

      {vista === 'semaforo' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <span className="font-bold text-slate-700">Criterios del Semáforo Institucional:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-600" /> Verde: Mayor o igual a 4.5
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-600" /> Amarillo: Entre 4.0 y 4.49
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-300">
              <span className="w-2 h-2 rounded-full bg-rose-600" /> Rojo: Menor a 4.0
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-itd-navy/20 text-left text-itd-navyDark/70">
                  <th className="py-2.5 pr-4">Departamento</th>
                  <th className="py-2.5 pr-3 text-center">Encuestas</th>
                  <th className="py-2.5 pr-3 text-center">Cursos</th>
                  <th className="py-2.5 pr-3 text-center">Nivel de Satisfacción</th>
                  <th className="py-2.5 text-center">Semáforo</th>
                </tr>
              </thead>
              <tbody>
                {departamentosSemaforo.map((d) => (
                  <tr key={d.nombre} className="border-b border-itd-navy/10 hover:bg-slate-50/70">
                    <td className="py-2.5 pr-4 font-medium text-itd-navyDark">{d.nombre}</td>
                    <td className="py-2.5 pr-3 text-center text-slate-700">{d.total}</td>
                    <td className="py-2.5 pr-3 text-center text-slate-700">{d.totalCursos}</td>
                    <td className="py-2.5 pr-3 text-center font-bold text-slate-900">{d.promedio.toFixed(2)}</td>
                    <td className="py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${d.colorClass}`}>
                        <span className={`w-2 h-2 rounded-full ${d.badgeClass}`} />
                        {d.textoSemaforo}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {vista === 'impacto' && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
            <strong>Indicador de Impacto por Curso:</strong> No solo mide la satisfacción del instructor, sino la transferencia real a la práctica docente (A3 y C1). Ayuda a Desarrollo Académico a justificar qué cursos repetir el siguiente semestre.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-itd-navy/20 text-left text-itd-navyDark/70">
                  <th className="py-2.5 pr-4">Curso</th>
                  <th className="py-2.5 pr-3 text-center">Encuestas</th>
                  <th className="py-2.5 pr-3 text-center">Satisfacción</th>
                  <th className="py-2.5 pr-3 text-center">Aplicación Práctica (Aula)</th>
                  <th className="py-2.5 text-center">Decisión Próximo Semestre</th>
                </tr>
              </thead>
              <tbody>
                {cursosImpacto.map((c) => (
                  <tr key={c.id} className="border-b border-itd-navy/10 hover:bg-slate-50/70">
                    <td className="py-2.5 pr-4 font-medium text-itd-navyDark">{c.nombre}</td>
                    <td className="py-2.5 pr-3 text-center text-slate-700">{c.total}</td>
                    <td className="py-2.5 pr-3 text-center font-bold text-slate-800">{c.promedioSatisfaccion.toFixed(2)}</td>
                    <td className="py-2.5 pr-3 text-center font-bold text-slate-800">{c.promedioImpacto.toFixed(2)}</td>
                    <td className="py-2.5 text-center">
                      {c.repetir ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          ✓ Repetir Curso
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300">
                          Revisar temario
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
        <div className="space-y-5">
          {/* Criterios de Evaluación B1 a B11 */}
          <TarjetaGrafica titulo="Promedio de Evaluación del Curso e Instructor (Escala 1 a 5)" alto={320}>
            <ResponsiveContainer>
              <BarChart data={datosPromediosSeccionB} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="pregunta" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
                <Tooltip
                  formatter={(val) => [`${val} / 5.00`, 'Promedio']}
                  labelFormatter={(codigo) => {
                    const item = datosPromediosSeccionB.find((d) => d.pregunta === codigo)
                    return item ? `${codigo}: ${item.textoCorto}` : codigo
                  }}
                />
                <Bar dataKey="promedio" fill="#1b396a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </TarjetaGrafica>

          {/* Gráficas secundarias en grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            

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

          {/* Impedimentos detectados si hay datos */}
          {datosImpedimentos.length > 0 && (
            <TarjetaGrafica titulo="Impedimentos Detectados para la Aplicación de lo Aprendido" alto={Math.max(180, datosImpedimentos.length * 36)}>
              <ResponsiveContainer>
                <BarChart data={datosImpedimentos} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="nombre" width={220} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill="#dc2626" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </TarjetaGrafica>
          )}
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
