import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { obtenerHistorialDocente } from '../lib/historial'
import { descargarKardexPDF } from '../lib/kardex'
import { descargarConstancia } from '../lib/constancias'

export default function AdminBuscarDocente() {
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [docenteSel, setDocenteSel] = useState(null)
  const [historial, setHistorial] = useState([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [generandoId, setGenerandoId] = useState(null)

  async function buscar() {
    const q = busqueda.trim()
    if (!q) return
    setBuscando(true)
    const { data } = await supabase
      .from('docentes')
      .select('*')
      .or(`nombre_completo.ilike.%${q}%,email.ilike.%${q}%`)
      .order('nombre_completo')
      .limit(20)
    setResultados(data || [])
    setBuscando(false)
  }

  async function seleccionarDocente(doc) {
    setDocenteSel(doc)
    setCargandoHistorial(true)
    const datos = await obtenerHistorialDocente(doc.id, doc.email)
    setHistorial(datos)
    setCargandoHistorial(false)
  }

  async function generarConstancia(fila, tipoDocumento) {
    const key = fila.cursoId + tipoDocumento
    setGenerandoId(key)
    try {
      await descargarConstancia(tipoDocumento, {
        docenteId: docenteSel.id,
        cursoId: fila.cursoId,
        nombreCompleto: docenteSel.nombre_completo,
        curso: fila.curso,
        fechaInicio: fila.fechaInicio,
        fechaFin: fila.fechaFin,
        horas: fila.horas,
        departamento: fila.departamento,
        folioPersonal: fila.folio,
        tipo: fila.tipo,
      })
    } catch (err) {
      console.error(err)
      alert('No se pudo generar el documento: ' + err.message)
    }
    setGenerandoId(null)
  }

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">
        Buscar Docente
      </h2>
      <p className="text-sm text-itd-navyDark/60 mb-6">
        Busca por nombre o correo para ver el historial de cualquier docente, descargar su
        Kardex, o generarle una constancia directamente (por ejemplo, si viene a la oficina y no
        tiene acceso a su correo).
      </p>

      <div className="flex gap-2 mb-6">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          placeholder="Nombre o correo…"
          className="flex-1 rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
        />
        <button
          onClick={buscar}
          disabled={buscando}
          className="rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-50"
        >
          {buscando ? 'Buscando…' : 'Buscar'}
        </button>
      </div>

      {!docenteSel && resultados.length > 0 && (
        <div className="space-y-2 mb-6">
          {resultados.map((doc) => (
            <button
              key={doc.id}
              onClick={() => seleccionarDocente(doc)}
              className="w-full text-left rounded-lg border border-itd-navy/10 px-4 py-3 hover:border-itd-navy/30 transition-colors"
            >
              <p className="text-sm font-medium text-itd-navyDark">{doc.nombre_completo}</p>
              <p className="text-xs text-itd-navyDark/50">{doc.email} · {doc.departamento}</p>
            </button>
          ))}
        </div>
      )}

      {docenteSel && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-4 rounded-lg bg-itd-navy/5 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-itd-navyDark">{docenteSel.nombre_completo}</p>
              <p className="text-xs text-itd-navyDark/50">{docenteSel.email}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => descargarKardexPDF(docenteSel, historial)}
                className="rounded-lg bg-itd-navy text-white px-3 py-2 text-xs font-medium hover:bg-itd-navyDark whitespace-nowrap"
              >
                ⬇ Kardex (PDF)
              </button>
              <button
                onClick={() => { setDocenteSel(null); setHistorial([]); setResultados([]); setBusqueda('') }}
                className="rounded-lg border border-itd-navy/20 text-itd-navyDark/70 px-3 py-2 text-xs font-medium hover:bg-itd-sand whitespace-nowrap"
              >
                Nueva búsqueda
              </button>
            </div>
          </div>

          {cargandoHistorial ? (
            <p className="text-center text-itd-navyDark/50 py-8">Cargando historial…</p>
          ) : historial.length === 0 ? (
            <p className="text-center text-itd-navyDark/50 py-8">Sin cursos registrados.</p>
          ) : (
            <div className="space-y-2">
              {historial.map((fila, i) => (
                <div key={i} className="rounded-lg border border-itd-navy/10 px-4 py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-itd-navyDark">
                        {fila.curso}
                        {fila.estado === 'cancelado' && (
                          <span className="ml-2 text-xs text-itd-guinda font-normal">(cancelado)</span>
                        )}
                      </p>
                      <p className="text-xs text-itd-navyDark/50">
                        {fila.anio} · Folio {fila.folio} · {fila.fechas} · {fila.horas} hrs
                      </p>
                    </div>
                    {fila.cursoId && fila.asistenciaAprobada && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => generarConstancia(fila, 'constancia')}
                          disabled={generandoId === fila.cursoId + 'constancia'}
                          className="rounded-lg border border-itd-navy/20 text-itd-navy px-3 py-1.5 text-xs font-medium hover:bg-itd-sand disabled:opacity-50"
                        >
                          {generandoId === fila.cursoId + 'constancia' ? 'Generando…' : 'Constancia'}
                        </button>
                        <button
                          onClick={() => generarConstancia(fila, 'reconocimiento')}
                          disabled={generandoId === fila.cursoId + 'reconocimiento'}
                          className="rounded-lg border border-purple-300 text-purple-700 px-3 py-1.5 text-xs font-medium hover:bg-purple-50 disabled:opacity-50"
                        >
                          {generandoId === fila.cursoId + 'reconocimiento' ? 'Generando…' : 'Reconocimiento'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
