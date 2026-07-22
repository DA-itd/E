import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatearRangoFechas } from '../lib/formatoFechas'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const LOGO_ITD = 'https://raw.githubusercontent.com/DA-itd/E/main/logo%20itd%20original.jpg'

async function imagenABase64(url) {
  try {
    const resp = await fetch(url)
    const blob = await resp.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export default function HistorialCursos({ docente }) {
  const [cargando, setCargando] = useState(true)
  const [cursos, setCursos] = useState([])
  const [generando, setGenerando] = useState(false)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)

    const [{ data: actuales }, { data: historicos }] = await Promise.all([
      supabase
        .from('inscripciones')
        .select('folio_personal, cursos(nombre, fecha_inicio, fecha_fin, horas, tipo, departamento)')
        .eq('docente_id', docente.id),
      supabase
        .from('inscripciones_historial')
        .select('folio_personal, curso, fecha_curso_texto, horas, tipo, departamento, anio')
        .ilike('email', docente.email),
    ])

    const filasActuales = (actuales || []).map((i) => ({
      anio: i.cursos?.fecha_inicio ? Number(i.cursos.fecha_inicio.slice(0, 4)) : '',
      folio: i.folio_personal || '',
      curso: i.cursos?.nombre || '',
      fechas:
        i.cursos?.fecha_inicio && i.cursos?.fecha_fin
          ? formatearRangoFechas(i.cursos.fecha_inicio, i.cursos.fecha_fin)
          : '',
      horas: i.cursos?.horas || '',
      tipo: i.cursos?.tipo || '',
      departamento: i.cursos?.departamento || '',
    }))

    const filasHistoricas = (historicos || []).map((h) => ({
      anio: h.anio,
      folio: h.folio_personal || '',
      curso: h.curso || '',
      fechas: h.fecha_curso_texto || '',
      horas: h.horas || '',
      tipo: h.tipo || '',
      departamento: h.departamento || '',
    }))

    const todas = [...filasActuales, ...filasHistoricas].sort((a, b) => (b.anio || 0) - (a.anio || 0))
    setCursos(todas)
    setCargando(false)
  }

  async function descargarPDF() {
    setGenerando(true)
    try {
      const doc = new jsPDF('p', 'mm', 'letter')
      const pageWidth = doc.internal.pageSize.getWidth()

      const logo = await imagenABase64(LOGO_ITD)
      if (logo) {
        try {
          doc.addImage(logo, 'JPEG', pageWidth - 35, 10, 25, 25)
        } catch {
          // si el formato de imagen no coincide, se omite el logo sin romper el PDF
        }
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(27, 57, 106)
      doc.text('INSTITUTO TECNOLÓGICO DE DURANGO', pageWidth / 2, 18, { align: 'center' })
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text('Coordinación de Actualización Docente', pageWidth / 2, 23, { align: 'center' })
      doc.setFontSize(13)
      doc.setTextColor(128, 0, 0)
      doc.text('HISTORIAL DE CURSOS', pageWidth / 2, 32, { align: 'center' })

      doc.setTextColor(0)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('Docente:', 14, 41)
      doc.setFont('helvetica', 'normal')
      doc.text(docente.nombre_completo || 'No especificado', 33, 41)

      const hoy = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
      doc.setFont('helvetica', 'bold')
      doc.text('Fecha de emisión:', 14, 46)
      doc.setFont('helvetica', 'normal')
      doc.text(hoy, 48, 46)

      const tableBody =
        cursos.length > 0
          ? cursos.map((c) => [c.anio || 'N/A', c.folio || 'N/A', c.curso || 'N/A', c.fechas || 'N/A', c.horas || 'N/A', c.tipo || 'N/A', c.departamento || 'N/A'])
          : [['N/A', 'N/A', 'Sin cursos registrados', 'N/A', 'N/A', 'N/A', 'N/A']]

      autoTable(doc, {
        head: [['Año', 'Folio', 'Curso', 'Fechas', 'Hrs', 'Tipo', 'Depto. Origen']],
        body: tableBody,
        startY: 51,
        theme: 'striped',
        headStyles: { fillColor: [27, 57, 106], textColor: 255, fontSize: 8, halign: 'center' },
        styles: { fontSize: 7, cellPadding: 1.8, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 25, fontStyle: 'bold' },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 25 },
          4: { cellWidth: 10, halign: 'center' },
          5: { cellWidth: 20, halign: 'center' },
          6: { cellWidth: 30, halign: 'left' },
        },
      })

      const pageCount = doc.internal.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(`Página 1 de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' })

      doc.save(`Kardex_${(docente.nombre_completo || 'docente').replace(/\s+/g, '_')}.pdf`)
    } catch (err) {
      console.error(err)
      alert('No se pudo generar el PDF: ' + err.message)
    }
    setGenerando(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-itd-navy">Historial de Cursos</h2>
          <p className="text-sm text-itd-navyDark/60">
            Todos los cursos que has tomado, actuales e históricos.
          </p>
        </div>
        <button
          onClick={descargarPDF}
          disabled={generando || cargando}
          className="rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-50 whitespace-nowrap"
        >
          {generando ? 'Generando…' : '⬇ Descargar Kardex (PDF)'}
        </button>
      </div>

      {cargando ? (
        <p className="text-center text-itd-navyDark/50 py-8">Cargando…</p>
      ) : cursos.length === 0 ? (
        <p className="text-center text-itd-navyDark/50 py-8">No tienes cursos registrados todavía.</p>
      ) : (
        <div className="overflow-x-auto -mx-6 sm:mx-0">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-itd-navy text-white text-xs uppercase">
                <th className="px-3 py-2 text-center">Año</th>
                <th className="px-3 py-2 text-left">Folio</th>
                <th className="px-3 py-2 text-left">Curso</th>
                <th className="px-3 py-2 text-left">Fechas</th>
                <th className="px-3 py-2 text-center">Hrs</th>
                <th className="px-3 py-2 text-center">Tipo</th>
                <th className="px-3 py-2 text-left">Depto. Origen</th>
              </tr>
            </thead>
            <tbody>
              {cursos.map((c, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-itd-sand/50'}>
                  <td className="px-3 py-2 text-center font-semibold">{c.anio}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.folio}</td>
                  <td className="px-3 py-2">{c.curso}</td>
                  <td className="px-3 py-2 text-xs">{c.fechas}</td>
                  <td className="px-3 py-2 text-center">{c.horas}</td>
                  <td className="px-3 py-2 text-center">{c.tipo}</td>
                  <td className="px-3 py-2 text-xs">{c.departamento}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
