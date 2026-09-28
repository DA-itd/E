import { useEffect, useState } from 'react'
import { supabase, DOMINIO_PERMITIDO } from '../lib/supabaseClient'
import EncabezadoInstitucional from './EncabezadoInstitucional'

// Fechas especiales y conmemorativas automáticas
const FECHAS_ESPECIALES = [
  {
    id: 'independencia',
    inicioMD: '09-16',
    finMD: '09-16',
    icono: '🇲🇽',
    texto: '16 de septiembre — Día de la Independencia. ¡Viva México!',
    bg: 'linear-gradient(90deg, #15803d, #ffffff 50%, #b91c1c)',
    color: '#064e3b',
  },
  {
    id: 'mes-patrio',
    inicioMD: '09-01',
    finMD: '09-30',
    icono: '🇲🇽',
    texto: 'Septiembre, Mes de la Patria · Orgullo Mexicano y Guinda',
    bg: 'linear-gradient(135deg, #166534 0%, #15803d 40%, #991b1b 100%)',
    color: '#ffffff',
  },
  {
    id: 'aniversario-itd',
    inicioMD: '08-02',
    finMD: '08-02',
    icono: '🎉',
    texto: '2 de agosto — ¡Aniversario del Instituto Tecnológico de Durango!',
    bg: 'linear-gradient(135deg, #781834 0%, #C9A227 100%)',
    color: '#ffffff',
  },
  {
    id: 'primavera',
    inicioMD: '03-21',
    finMD: '03-21',
    icono: '🌸',
    texto: '21 de marzo — ¡Bienvenida Primavera!',
    bg: 'linear-gradient(135deg, #0284c7 0%, #f472b6 100%)',
    color: '#ffffff',
  },
  {
    id: 'mes-cancer-mama',
    inicioMD: '10-01',
    finMD: '10-31',
    icono: '🎗️',
    texto: 'Octubre — Mes de sensibilización sobre el cáncer de mama',
    bg: 'linear-gradient(90deg, #be185d, #ec4899)',
    color: '#ffffff',
  },
  {
    id: 'dia-maestro',
    inicioMD: '05-15',
    finMD: '05-15',
    icono: '🍎',
    texto: '15 de mayo — ¡Feliz Día del Maestro a toda nuestra comunidad!',
    bg: 'linear-gradient(135deg, #1e3a8a 0%, #9d2449 100%)',
    color: '#ffffff',
  },
]

function obtenerBannerFechaEspecial() {
  const hoy = new Date()
  const mm = String(hoy.getMonth() + 1).padStart(2, '0')
  const dd = String(hoy.getDate()).padStart(2, '0')
  const hoyMD = `${mm}-${dd}`
  return FECHAS_ESPECIALES.find((f) => hoyMD >= f.inicioMD && hoyMD <= f.finMD) || null
}

const ESTILOS_TIPO = {
  info: { bg: 'bg-blue-900/90 text-blue-100 border-blue-500/30', badge: 'bg-blue-600 text-white' },
  exito: { bg: 'bg-emerald-900/90 text-emerald-100 border-emerald-500/30', badge: 'bg-emerald-600 text-white' },
  aviso: { bg: 'bg-amber-900/90 text-amber-100 border-amber-500/30', badge: 'bg-amber-600 text-white' },
  urgente: { bg: 'bg-rose-950/95 text-rose-100 border-rose-500/40', badge: 'bg-rose-600 text-white' },
}

export default function Login() {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [avisos, setAvisos] = useState([])
  const [convocatoriaActiva, setConvocatoriaActiva] = useState(null)
  const [pestanaActiva, setPestanaActiva] = useState('docente') // 'docente' | 'validar'
  const [folioManual, setFolioManual] = useState('')

  const bannerFecha = obtenerBannerFechaEspecial()

  useEffect(() => {
    cargarAvisosYConvocatoria()
  }, [])

  async function cargarAvisosYConvocatoria() {
    try {
      const { data } = await supabase
        .from('avisos')
        .select('id, mensaje, tipo')
        .eq('activo', true)
        .order('creado_en', { ascending: false })
      if (data && data.length > 0) {
        setAvisos(data)
      }
    } catch {
      // Ignorar si la tabla no está disponible
    }

    try {
      const { data } = await supabase
        .from('convocatorias')
        .select('nombre, fecha_fin')
        .eq('activo', true)
        .order('fecha_inicio', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (data) {
        setConvocatoriaActiva(data)
      }
    } catch {
      // Ignorar
    }
  }

  function formatearFecha(fechaISO) {
    try {
      return new Date(fechaISO + 'T00:00:00').toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return fechaISO
    }
  }

  async function entrarConGoogle() {
    setError('')
    setCargando(true)
    const { error: errorAuth } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: { hd: DOMINIO_PERMITIDO },
        redirectTo: window.location.origin + window.location.pathname,
      },
    })
    if (errorAuth) {
      setError('No se pudo iniciar sesión. Por favor intenta de nuevo.')
      setCargando(false)
    }
  }

  function irAValidar(e) {
    e.preventDefault()
    const folioLimpio = folioManual.trim()
    if (!folioLimpio) return
    window.location.href = `?validar=${encodeURIComponent(folioLimpio)}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#4A0D1C] via-[#6B1428] to-[#122A4D] text-white flex flex-col justify-between selection:bg-itd-gold selection:text-itd-navy relative overflow-x-hidden">
      {/* Elementos ambientales de fondo inspirados en la arquitectura ITD y el cielo azul */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Resplandor Azul Cielo Durango (arriba derecha) */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl" />
        {/* Resplandor Guinda Profundo (abajo izquierda) */}
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-rose-700/20 rounded-full blur-3xl" />
        {/* Detalle Azul Marino TecNM (centro) */}
        <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-blue-700/15 rounded-full blur-2xl -translate-y-1/2" />
        {/* Patrón geométrico sutil */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }}
        />
      </div>

      {/* BARRA SUPERIOR INSTITUCIONAL */}
      <header className="relative z-10 border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              TecNM · Instituto Tecnológico de Durango
            </span>
            <span className="hidden md:inline text-white/50">|</span>
            <span className="hidden md:inline text-white/70">Coordinación de Actualización Docente</span>
          </div>

          <div className="flex items-center gap-4 text-white/80">
            <span className="hidden sm:inline font-semibold text-itd-gold tracking-wide">
              ★ Fundado en 1948 · Orgullo Guinda y Blanco
            </span>
            <button
              onClick={() => {
                window.location.hash = '#validar'
              }}
              className="inline-flex items-center gap-1.5 text-xs text-sky-200 hover:text-white font-medium transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-sky-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Validador QR
            </button>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col justify-center">
        {/* BANNERS DINÁMICOS SUPERIORES */}
        <div className="w-full mb-6 sm:mb-8 space-y-3">
          {bannerFecha && (
            <div
              className="rounded-2xl p-3.5 sm:p-4 text-sm font-semibold text-center shadow-lg border border-white/20 backdrop-blur-md flex items-center justify-center gap-2"
              style={{ background: bannerFecha.bg, color: bannerFecha.color }}
            >
              <span className="text-xl">{bannerFecha.icono}</span>
              <span>{bannerFecha.texto}</span>
            </div>
          )}

          {convocatoriaActiva && (
            <div className="rounded-2xl p-4 bg-gradient-to-r from-blue-900/90 via-blue-800/90 to-itd-navy border border-blue-400/30 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-center sm:text-left">
                <span className="text-2xl shrink-0 p-2 bg-blue-500/20 rounded-xl border border-blue-300/30">📢</span>
                <div>
                  <p className="font-bold text-sm sm:text-base text-sky-200">
                    Convocatoria Abierta: "{convocatoriaActiva.nombre}"
                  </p>
                  <p className="text-xs text-white/80">
                    Registro disponible para toda la plantilla docente hasta el{' '}
                    <span className="text-itd-gold font-semibold underline">
                      {formatearFecha(convocatoriaActiva.fecha_fin)}
                    </span>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPestanaActiva('docente')}
                className="shrink-0 px-4 py-2 bg-itd-gold text-itd-navy hover:bg-yellow-400 text-xs font-bold rounded-xl shadow-md transition-all hover:scale-[1.02]"
              >
                Inscribirme ahora →
              </button>
            </div>
          )}

          {avisos.length > 0 && (
            <div className="grid gap-2">
              {avisos.map((a) => {
                const estilo = ESTILOS_TIPO[a.tipo] || ESTILOS_TIPO.info
                return (
                  <div
                    key={a.id}
                    className={`rounded-xl px-4 py-2.5 text-xs sm:text-sm border backdrop-blur-md flex items-center gap-2.5 ${estilo.bg}`}
                  >
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 ${estilo.badge}`}>
                      {a.tipo || 'Aviso'}
                    </span>
                    <span className="font-medium flex-1">{a.mensaje}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ESTRUCTURA SPLIT SCREEN: HERO Y ACCESO */}
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* COLUMNA IZQUIERDA: HERO INSTITUCIONAL INSPIRADO EN LA FACHADA ITD */}
          <div className="lg:col-span-7 space-y-6">
            {/* Medallón arquitectónico y fecha histórica */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-itd-guindaDark to-itd-guinda border border-itd-gold/40 px-3.5 py-1.5 rounded-full shadow-md">
                <span className="text-itd-gold font-bold text-xs tracking-wider">🏛️ 1948 · DESDE HACE 78 AÑOS</span>
              </div>
              <div className="inline-flex items-center gap-1.5 bg-blue-900/60 border border-blue-400/40 px-3 py-1.5 rounded-full text-xs text-blue-200 font-medium">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                Desarrollo Académico
              </div>
            </div>

            {/* Gran Título Display */}
            <div className="space-y-2">
              <p className="text-xs sm:text-sm font-bold tracking-widest text-itd-gold uppercase">
                Tecnológico Nacional de México
              </p>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                Instituto Tecnológico <br className="hidden sm:inline" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-itd-gold via-yellow-200 to-amber-300">
                  de Durango
                </span>
              </h1>
              <p className="font-display text-lg sm:text-xl text-white/90 font-medium italic pt-1">
                "La Técnica al Servicio de la Patria"
              </p>
            </div>

            {/* Descripción institucional */}
            <p className="text-sm sm:text-base text-white/80 max-w-xl leading-relaxed">
              Plataforma oficial de la <strong className="text-white">Coordinación de Actualización Docente</strong>. 
              Inscríbete a los cursos y diplomados intersemestrales, consulta tu historial académico 
              y descarga tus constancias oficiales validadas con código QR y folio institucional.
            </p>

            {/* TARJETA MOTIVO FACHADA: Pendón Guinda con Escudos y 1948 */}
            <div className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-md p-4 sm:p-5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-itd-gold/10 to-transparent pointer-events-none" />
              
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="flex items-start gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-itd-guinda to-rose-900 border border-itd-gold/40 flex items-center justify-center text-lg shrink-0 shadow-md">
                    📝
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-white uppercase tracking-wider">Inscripción</h2>
                    <p className="text-[11px] text-white/70 mt-0.5 leading-snug">
                      Cursos disciplinares, pedagógicos e institucionales.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-900 to-blue-700 border border-blue-400/40 flex items-center justify-center text-lg shrink-0 shadow-md">
                    🔍
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-sky-200 uppercase tracking-wider">Validación QR</h2>
                    <p className="text-[11px] text-white/70 mt-0.5 leading-snug">
                      Verificación en tiempo real para RH y evaluadores.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-700 to-itd-gold border border-itd-gold/50 flex items-center justify-center text-lg shrink-0 shadow-md">
                    📜
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-yellow-200 uppercase tracking-wider">Constancias</h2>
                    <p className="text-[11px] text-white/70 mt-0.5 leading-snug">
                      Emisión digital oficial con valor curricular TecNM.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Badges de acreditación oficial */}
            <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-white/60">
              <span className="flex items-center gap-1">
                <span className="text-itd-gold">✓</span> Validez Oficial TecNM
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="text-sky-300">✓</span> Firma Digital y Criptográfica
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className="text-emerald-300">✓</span> Acceso Seguro Google Workspace
              </span>
            </div>
          </div>

          {/* COLUMNA DERECHA: TARJETA INTERACTIVA DE ACCESO Y SERVICIOS */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-3xl shadow-2xl border-4 border-itd-gold/40 p-6 sm:p-8 text-itd-navyDark relative">
              {/* Adorno superior en la tarjeta */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-itd-navy text-white text-[11px] font-bold uppercase tracking-widest px-4 py-1 rounded-full shadow-md border border-itd-gold/50">
                Portal Docente ITD
              </div>

              {/* Encabezado Institucional con logos */}
              <div className="mt-2">
                <EncabezadoInstitucional tema="claro" />
              </div>

              {/* Selector de modo: Acceso Docente vs Validar Documento */}
              <div className="grid grid-cols-2 p-1 bg-itd-sand rounded-xl mb-6 border border-itd-navy/10 text-xs font-bold">
                <button
                  onClick={() => setPestanaActiva('docente')}
                  className={`py-2 px-3 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                    pestanaActiva === 'docente'
                      ? 'bg-itd-guinda text-white shadow-sm'
                      : 'text-itd-navyDark/70 hover:text-itd-navy'
                  }`}
                >
                  <span>🔐</span> Acceso Docente
                </button>
                <button
                  onClick={() => setPestanaActiva('validar')}
                  className={`py-2 px-3 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                    pestanaActiva === 'validar'
                      ? 'bg-itd-navy text-white shadow-sm'
                      : 'text-itd-navyDark/70 hover:text-itd-navy'
                  }`}
                >
                  <span>🔍</span> Validar Folio
                </button>
              </div>

              {/* PESTAÑA 1: ACCESO DOCENTE */}
              {pestanaActiva === 'docente' && (
                <div className="space-y-4">
                  <div className="text-center">
                    <h2 className="font-display text-lg font-bold text-itd-navy">
                      Bienvenido, Colega Docente
                    </h2>
                    <p className="text-xs text-itd-navyDark/60 mt-1">
                      Inicia sesión con tu cuenta de correo institucional para entrar a tu panel de cursos y constancias.
                    </p>
                  </div>

                  <button
                    onClick={entrarConGoogle}
                    disabled={cargando}
                    className="w-full flex items-center justify-center gap-3 rounded-xl border-2 border-itd-navy/20 bg-white hover:bg-slate-50 active:bg-slate-100 px-5 py-3.5 text-sm font-bold text-itd-navyDark shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer group"
                  >
                    <svg width="20" height="20" viewBox="0 0 18 18" className="shrink-0 transition-transform group-hover:scale-110">
                      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z"/>
                      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/>
                      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"/>
                      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"/>
                    </svg>
                    {cargando ? 'Conectando…' : 'Entrar con correo institucional'}
                  </button>

                  <div className="flex items-center justify-center gap-1.5 text-xs text-itd-navyDark/60 bg-blue-50/60 p-2.5 rounded-lg border border-blue-100">
                    <span className="text-blue-600 font-bold">ℹ</span>
                    <span>Acceso exclusivo con cuentas <strong>@{DOMINIO_PERMITIDO}</strong></span>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium text-center">
                      {error}
                    </div>
                  )}

                  <div className="pt-4 border-t border-itd-navy/10 text-center space-y-2">
                    <p className="text-[11px] text-itd-navyDark/60">
                      ¿Necesitas verificar una constancia emitida por el ITD?
                    </p>
                    <button
                      type="button"
                      onClick={() => setPestanaActiva('validar')}
                      className="text-xs font-semibold text-itd-navy hover:text-itd-guinda hover:underline inline-flex items-center gap-1"
                    >
                      Ir a verificación de folios y QR →
                    </button>
                  </div>
                </div>
              )}

              {/* PESTAÑA 2: VALIDACIÓN DE CONSTANCIAS */}
              {pestanaActiva === 'validar' && (
                <div className="space-y-4">
                  <div className="text-center">
                    <h2 className="font-display text-lg font-bold text-itd-navy">
                      Validación Pública de Constancias
                    </h2>
                    <p className="text-xs text-itd-navyDark/60 mt-1">
                      Herramienta para Recursos Humanos, instituciones externas o docentes que desean comprobar la validez de un documento.
                    </p>
                  </div>

                  <form onSubmit={irAValidar} className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-itd-navyDark mb-1">
                        Folio Único del Documento:
                      </label>
                      <input
                        type="text"
                        value={folioManual}
                        onChange={(e) => setFolioManual(e.target.value.toUpperCase())}
                        placeholder="Ej: TNM-054-36-2026-01"
                        className="w-full px-3.5 py-2.5 text-sm border-2 border-itd-navy/20 rounded-xl focus:outline-none focus:border-itd-navy uppercase font-mono tracking-wider"
                        autoFocus
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!folioManual.trim()}
                      className="w-full bg-itd-navy hover:bg-itd-navyDark active:scale-[0.99] text-white text-sm font-bold py-3 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Consultar Autenticidad
                    </button>
                  </form>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-gray-200"></div>
                    <span className="flex-shrink mx-3 text-gray-400 text-[11px] uppercase font-semibold">o también</span>
                    <div className="flex-grow border-t border-gray-200"></div>
                  </div>

                  <button
                    onClick={() => {
                      window.location.hash = '#validar'
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-itd-guinda/30 bg-itd-guinda/5 hover:bg-itd-guinda/10 py-2.5 px-4 text-xs font-bold text-itd-guinda transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Escanear Código QR con Cámara
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* PIE DE PÁGINA INSTITUCIONAL RESPONSIVO */}
      <footer className="relative z-10 border-t border-white/10 bg-black/40 backdrop-blur-md py-4 text-center text-xs text-white/70 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            Instituto Tecnológico de Durango · Blvd. Felipe Pescador 1830 Ote., Col. Nueva Vizcaya, Durango, Dgo.
          </p>
          <p className="text-white/50 text-[11px]">
            D.R. © Alejandro Calderón Rentería · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  )
}
