import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import jsPDF from 'jspdf'
import QRCode from 'qrcode'
import { generarCodigoVerificacion } from '../lib/codigoVerificacion'

const PREFIJO = 'TNM-054-'

// Convierte una imagen (fetch por URL) a base64, formato que jsPDF necesita
// para doc.addImage().
async function cargarImagenBase64(url) {
  const resp = await fetch(url)
  const buffer = await resp.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binario = ''
  for (let i = 0; i < bytes.byteLength; i++) binario += String.fromCharCode(bytes[i])
  return btoa(binario)
}

// Sonidos generados con Web Audio API (sin depender de archivos .mp3/.wav
// que podrían faltar en el deploy).
function reproducirSonidoExito() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notas = [523.25, 659.25, 783.99] // Do-Mi-Sol, tipo "campanita"
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const inicio = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(0, inicio)
      gain.gain.linearRampToValueAtTime(0.25, inicio + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, inicio + 0.5)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(inicio)
      osc.stop(inicio + 0.5)
    })
  } catch (e) {
    // Si el navegador bloquea audio sin interacción previa, no rompe la app
  }
}

function reproducirSonidoError() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notas = [220, 174.61] // dos tonos graves descendentes, tipo "buzz"
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = freq
      const inicio = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0, inicio)
      gain.gain.linearRampToValueAtTime(0.15, inicio + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, inicio + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(inicio)
      osc.stop(inicio + 0.3)
    })
  } catch (e) {
    // Si el navegador bloquea audio sin interacción previa, no rompe la app
  }
}

export default function ValidadorConstancias({ onVolver }) {
  const [query, setQuery] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [estado, setEstado] = useState('idle') // idle | encontrado | no_encontrado
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    const hash = window.location.hash // ej. "#validar?folio=TNM-054-36-2026-01"
    const partes = hash.split('?')
    if (partes.length > 1) {
      const params = new URLSearchParams(partes[1])
      const folioUrl = params.get('folio')
      if (folioUrl) {
        setQuery(folioUrl.toUpperCase())
        buscar(folioUrl.toUpperCase())
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function buscar(valorForzado) {
    const valor = (valorForzado ?? query).trim().toUpperCase()
    if (!valor) return
    setBuscando(true)
    setEstado('idle')

    const folioCompleto = valor.startsWith('TNM-054-') ? valor : PREFIJO + valor

    const { data, error } = await supabase.rpc('validar_constancia', { p_folio: folioCompleto })

    setBuscando(false)
    if (error || !data || data.length === 0) {
      setResultado(null)
      setEstado('no_encontrado')
      reproducirSonidoError()
      return
    }
    const resultadoEncontrado = data[0]
    const codigoVerificacion = generarCodigoVerificacion(
      resultadoEncontrado.nombre,
      resultadoEncontrado.fecha_texto,
      resultadoEncontrado.folio
    )
    setResultado({ ...resultadoEncontrado, codigoVerificacion })
    setEstado('encontrado')
    reproducirSonidoExito()
  }

  async function descargarComprobante() {
    if (!resultado) return
    const doc = new jsPDF('p', 'mm', 'letter')
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margenIzq = 25
    const margenDer = 25
    const anchoUtil = pageWidth - margenIzq - margenDer

    // Marca de agua diagonal "VÁLIDO"
    doc.saveGraphicsState()
    doc.setTextColor(34, 139, 34)
    doc.setFontSize(70)
    doc.setFont('helvetica', 'bold')
    doc.text('VÁLIDO', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 35 })
    doc.restoreGraphicsState()

    // Logos institucionales: engrane/TecNM a la izquierda, escudo ITD a la
    // derecha. Se cargan desde /public/logos/ (mismo patrón que las
    // plantillas en constancias.js, respetando el "base" de vite.config.js).
    const BASE = import.meta.env.BASE_URL
    try {
      const [logoTecnmB64, logoItdB64] = await Promise.all([
        cargarImagenBase64(`${BASE}logos/logo-tecnm.jpg`),
        cargarImagenBase64(`${BASE}logos/logo-itd.jpg`),
      ])
      // TecNM es rectangular (aprox. 209x96) -- se respeta su proporción
      const anchoTecnm = 24
      const altoTecnm = anchoTecnm * (96 / 209)
      doc.addImage(logoTecnmB64, 'JPEG', margenIzq, 10, anchoTecnm, altoTecnm)
      // ITD es circular/cuadrado
      const tamItd = 18
      doc.addImage(logoItdB64, 'JPEG', pageWidth - margenDer - tamItd, 10, tamItd, tamItd)
    } catch (err) {
      console.error('No se pudieron cargar los logos institucionales:', err)
      // si fallan, el PDF se genera igual, solo sin logos
    }

    doc.setTextColor(27, 57, 106)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('INSTITUTO TECNOLÓGICO DE DURANGO', pageWidth / 2, 25, { align: 'center' })
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text('Coordinación de Actualización Docente', pageWidth / 2, 31, { align: 'center' })

    doc.setTextColor(21, 128, 61)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('COMPROBANTE DE VALIDACIÓN DE DOCUMENTO', pageWidth / 2, 45, { align: 'center' })

    let y = 62
    const campo = (label, valor) => {
      doc.setTextColor(100)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text(label, margenIzq, y)

      doc.setTextColor(0)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      // Ajuste de línea real: si el texto no cabe en el ancho disponible,
      // se parte en varias líneas en vez de desbordarse fuera de la página.
      const lineas = doc.splitTextToSize(String(valor || 'N/A'), anchoUtil)
      doc.text(lineas, margenIzq, y + 6)
      y += 6 + lineas.length * 5.5 + 5
    }

    campo('FOLIO', resultado.folio)
    campo('CÓDIGO DE VERIFICACIÓN', resultado.codigoVerificacion)
    campo('NOMBRE', resultado.nombre)
    campo('CURSO', resultado.curso)
    campo('FECHA', resultado.fecha_texto)
    campo('DEPARTAMENTO', resultado.departamento)
    campo('DURACIÓN', `${resultado.horas} horas`)
    campo('TIPO', resultado.tipo)

    // QR que enlaza de vuelta al validador público con el folio precargado
    try {
      const urlValidacion = `${window.location.origin}${import.meta.env.BASE_URL}#validar?folio=${encodeURIComponent(resultado.folio)}`
      const qrDataUrl = await QRCode.toDataURL(urlValidacion, { margin: 0, width: 256 })
      const tamQr = 28
      doc.addImage(qrDataUrl, 'PNG', pageWidth - margenDer - tamQr, y + 2, tamQr, tamQr)
    } catch (err) {
      console.error('No se pudo generar el QR del comprobante:', err)
    }

    const hoy = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(`Verificado el ${hoy} en el validador oficial del Instituto Tecnológico de Durango.`, pageWidth / 2, pageHeight - 15, { align: 'center' })

    doc.save(`Validacion_${resultado.folio}.pdf`)
  }

  function limpiar() {
    setQuery('')
    setEstado('idle')
    setResultado(null)
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={onVolver}
          className="text-sm text-itd-navy font-medium shrink-0"
        >
          ← Salir
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm font-bold text-slate-800">Validador de Constancias</p>
          <p className="text-xs text-slate-500">Instituto Tecnológico de Durango</p>
        </div>
        <div className="w-10" />
      </header>

      <main className="max-w-lg w-full mx-auto px-4 py-6 flex-1">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Buscar Constancia</h2>
          <p className="text-sm text-slate-500 mb-4">
            Ingresa el folio exacto, con o sin el prefijo <strong>TNM-054-</strong>
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex flex-1 border border-slate-300 rounded-lg overflow-hidden focus-within:border-itd-navy">
              <span className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 border-r border-slate-200 flex items-center whitespace-nowrap">
                TNM-054-
              </span>
              <input
                value={query.replace(/^TNM-054-/, '')}
                onChange={(e) => setQuery(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && buscar()}
                placeholder="36-2026-01"
                className="flex-1 px-3 py-2 text-sm outline-none uppercase min-w-0"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => buscar()}
                disabled={buscando || !query}
                className="rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-semibold hover:bg-itd-navyDark disabled:opacity-50 whitespace-nowrap"
              >
                {buscando ? '...' : 'Verificar'}
              </button>
              <button
                onClick={limpiar}
                disabled={buscando}
                className="rounded-lg bg-slate-100 text-slate-600 px-3 py-2 text-sm font-medium hover:bg-slate-200"
              >
                Borrar
              </button>
            </div>
          </div>
        </div>

        {estado === 'no_encontrado' && (
          <div className="mt-4 rounded-2xl bg-red-50 border-l-4 border-red-500 p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">❌</span>
              <span className="text-lg font-bold text-red-600">Documento no encontrado</span>
            </div>
            <p className="text-sm text-slate-600">
              El folio no fue encontrado o no está vigente. Verifica que esté bien escrito.
            </p>
          </div>
        )}

        {estado === 'encontrado' && resultado && (
          <div className="mt-4 rounded-2xl bg-green-50 border-l-4 border-green-500 p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">✅</span>
              <span className="text-lg font-bold text-green-700">Documento Válido</span>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Folio: <strong className="text-slate-900">{resultado.folio}</strong>
            </p>

            <div className="rounded-lg bg-white/70 border border-green-200 px-3 py-2 mb-4">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Código de Verificación</p>
              <p className="text-sm font-mono font-semibold text-slate-900">{resultado.codigoVerificacion}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-200">
              <Campo label="Nombre" valor={resultado.nombre} />
              <Campo label="Curso" valor={resultado.curso} />
              <Campo label="Fecha" valor={resultado.fecha_texto} />
              <Campo label="Departamento" valor={resultado.departamento} />
              <Campo label="Duración" valor={`${resultado.horas} hrs`} />
              <Campo label="Tipo" valor={resultado.tipo} />
            </div>

            <button
              onClick={descargarComprobante}
              className="mt-4 w-full rounded-lg bg-green-700 text-white px-4 py-2.5 text-sm font-semibold hover:bg-green-800"
            >
              ⬇ Descargar Comprobante de Validación (PDF)
            </button>
          </div>
        )}
      </main>

      <footer className="bg-slate-900 text-slate-400 text-center py-5 px-4 text-xs">
        <p>© {new Date().getFullYear()} <strong className="text-slate-200">Coordinación de Actualización Docente</strong></p>
        <p className="mt-1">Instituto Tecnológico de Durango</p>
      </footer>
    </div>
  )
}

function Campo({ label, valor }) {
  if (!valor) return null
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{String(valor).toUpperCase()}</p>
    </div>
  )
}
