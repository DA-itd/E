import { useEffect, useState } from 'react'
import { supabase, DOMINIO_PERMITIDO } from '../lib/supabaseClient'

const BASE = import.meta.env.BASE_URL?.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL || '.'}/`
const LOGO_TECNM_LOCAL = `${BASE}logos/logo-tecnm.jpg`
const LOGO_TECNM_REMOTE = 'https://raw.githubusercontent.com/DA-itd/E/main/public/logos/logo-tecnm.jpg'
const LOGO_ITD_LOCAL = `${BASE}logo_itdurango.png`
const LOGO_ITD_REMOTE = 'https://github.com/DA-itd/E/blob/main/logo_itdurango.png?raw=true'
const FACHADA_ITD_LOCAL = `${BASE}FachadaITD.png`
const FACHADA_ITD_REMOTE = 'https://github.com/DA-itd/E/blob/main/FachadaITD.png?raw=true'

// Fechas especiales y conmemorativas automáticas
const FECHAS_ESPECIALES = [
  {
    id: 'independencia',
    inicioMD: '09-16',
    finMD: '09-16',
    icono: '🇲🇽',
    texto: '16 de septiembre — Día de la Independencia',
  },
  {
    id: 'mes-patrio',
    inicioMD: '09-01',
    finMD: '09-30',
    icono: '🇲🇽',
    texto: 'Septiembre, mes de la Patria',
  },
  {
    id: 'aniversario-itd',
    inicioMD: '08-02',
    finMD: '08-02',
    icono: '🎉',
    texto: '2 de agosto — Aniversario del ITD (1948)',
  },
  {
    id: 'dia-maestro',
    inicioMD: '05-15',
    finMD: '05-15',
    icono: '🍎',
    texto: '15 de mayo — Día del Maestro',
  },
]

function obtenerBannerFechaEspecial() {
  const hoy = new Date()
  const mm = String(hoy.getMonth() + 1).padStart(2, '0')
  const dd = String(hoy.getDate()).padStart(2, '0')
  const hoyMD = `${mm}-${dd}`
  return FECHAS_ESPECIALES.find((f) => hoyMD >= f.inicioMD && hoyMD <= f.finMD) || null
}

export default function Login() {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [convocatoriaActiva, setConvocatoriaActiva] = useState(null)

  const bannerFecha = obtenerBannerFechaEspecial()

    function abrirValidador() {
    window.location.hash = '#validar'
    if (typeof onIrAValidar === 'function') {
      onIrAValidar()
    }
  }

  useEffect(() => {
    cargarConvocatoria()
  }, [])

  async function cargarConvocatoria() {
    try {
      const { data } = await supabase
        .from('convocatorias')
        .select('nombre, fecha_fin')
        .eq('activo', true)
        .order('fecha_inicio', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) {
        setConvocatoriaActiva(data)
        return
      }
      // Si ninguna está marcada como activa, tomar la más reciente
      const { data: ultima } = await supabase
        .from('convocatorias')
        .select('nombre, fecha_fin')
        .order('fecha_inicio', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (ultima) {
        setConvocatoriaActiva(ultima)
      }
    } catch {
      // Ignorar si no está disponible la tabla
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

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-slate-800 flex flex-col justify-between selection:bg-itd-gold selection:text-itd-navy relative overflow-x-hidden">
      {/* Elementos decorativos sutiles de fondo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        {/* Marca de agua institucional en la esquina inferior izquierda (engrane) */}
        <div className="absolute -bottom-16 -left-16 w-80 h-80 rounded-full border-[18px] border-slate-200/50 opacity-40 flex items-center justify-center">
          <div className="w-56 h-56 rounded-full border-[12px] border-dashed border-slate-200/60" />
        </div>

        {/* Cintas decorativas diagonales en la esquina inferior derecha */}
        <div className="absolute -bottom-10 -right-10 w-48 h-48 pointer-events-none opacity-80">
          <div className="absolute bottom-0 right-0 w-44 h-10 bg-itd-guinda transform -rotate-45 translate-y-6 translate-x-6" />
          <div className="absolute bottom-0 right-0 w-44 h-4 bg-itd-gold transform -rotate-45 translate-y-2 translate-x-2" />
          <div className="absolute bottom-0 right-0 w-44 h-4 bg-itd-navy transform -rotate-45 -translate-y-2 -translate-x-2" />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. ENCABEZADO SUPERIOR INSTITUCIONAL (Idéntico al bosquejo)              */}
      {/* ========================================================================= */}
      <header className="relative z-10 w-full pt-4 pb-2 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Fila de logos y nombre institucional */}
        <div className="flex items-center justify-between gap-4 py-2 border-b border-slate-200/80">
          {/* Logo TecNM Izquierda */}
          <img
            src={LOGO_TECNM_LOCAL}
            onError={(e) => {
              if (e.currentTarget.src !== LOGO_TECNM_REMOTE) {
                e.currentTarget.src = LOGO_TECNM_REMOTE
              }
            }}
            alt="Tecnológico Nacional de México"
            className="h-10 sm:h-14 w-auto object-contain shrink-0 filter drop-shadow-xs"
          />

          {/* Separador vertical izquierdo en pantallas medianas */}
          <div className="hidden sm:block h-10 w-px bg-slate-200" />

          {/* Título Central */}
          <div className="text-center flex-1">
            <h1 className="font-display text-base sm:text-2xl md:text-3xl font-extrabold text-itd-navy tracking-tight uppercase">
              Instituto Tecnológico de Durango
            </h1>
          </div>

          {/* Separador vertical derecho en pantallas medianas */}
          <div className="hidden sm:block h-10 w-px bg-slate-200" />

          {/* Escudo Circular ITD Derecha */}
          <img
            src={LOGO_ITD_REMOTE}
            onError={(e) => {
              if (e.currentTarget.src !== LOGO_ITD_LOCAL) {
                e.currentTarget.src = LOGO_ITD_LOCAL
              }
            }}
            alt="Instituto Tecnológico de Durango"
            className="h-11 sm:h-16 w-auto object-contain shrink-0 filter drop-shadow-xs"
          />
        </div>

        {/* Subencabezado de Actualización Docente con icono de birrete */}
        <div className="text-center mt-3 mb-1">
          <div className="inline-flex items-center justify-center gap-3">
            <div className="h-0.5 w-8 sm:w-16 bg-gradient-to-r from-transparent to-itd-guinda" />
            <div className="flex items-center gap-2">
              <span className="text-itd-guinda text-lg sm:text-xl">🎓</span>
              <h2 className="font-display text-sm sm:text-lg font-black text-itd-navy tracking-wider uppercase">
                Actualización Docente
              </h2>
            </div>
            <div className="h-0.5 w-8 sm:w-16 bg-gradient-to-l from-transparent to-itd-navy" />
          </div>
          <div className="flex items-center justify-center gap-3 mt-1.5">
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 tracking-widest uppercase">
              Capacitación • Formación • Mejora Continua
            </p>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. CUERPO PRINCIPAL: 3 COLUMNAS SIMÉTRICAS                                */}
      {/* ========================================================================= */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">

          {/* --------------------------------------------------------------------- */}
          {/* COLUMNA IZQUIERDA: FACHADA EMBLEMÁTICA DEL ITD CON LEMA               */}
          {/* --------------------------------------------------------------------- */}
          <div className="lg:col-span-5 flex flex-col items-center lg:items-start order-2 lg:order-1">
            <div className="w-full relative group">
              {/* Resplandor decorativo institucional de fondo */}
              <div className="absolute -inset-2 bg-gradient-to-br from-itd-guinda/15 via-itd-gold/10 to-itd-navy/15 rounded-3xl transform -rotate-1 group-hover:rotate-0 transition-transform duration-500" />

              {/* Contenedor de la fachada con relación de aspecto nativa */}
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-white">
                <img
                  src={FACHADA_ITD_REMOTE}
                  onError={(e) => {
                    if (e.currentTarget.src !== FACHADA_ITD_LOCAL) {
                      e.currentTarget.src = FACHADA_ITD_LOCAL
                    }
                  }}
                  alt="Fachada del Instituto Tecnológico de Durango - Formación Hoy, mejores docentes mañana"
                  className="w-full h-auto object-cover transform group-hover:scale-[1.02] transition-transform duration-700"
                />

                {/* Placa institucional sutil al pie de la imagen */}
                <div className="bg-gradient-to-r from-slate-900 via-itd-guindaDark to-slate-900 px-4 py-2 text-center text-white flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-bold tracking-widest text-itd-gold uppercase">
                    🏛️ Fundado en 1948
                  </span>
                  <span className="text-[10px] sm:text-xs font-medium text-slate-200">
                    Edificio Emblemático · ITD
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* --------------------------------------------------------------------- */}
          {/* COLUMNA CENTRAL: TARJETA FLOTANTE DE INICIO DE SESIÓN                 */}
          {/* --------------------------------------------------------------------- */}
          <div className="lg:col-span-4 w-full flex flex-col items-center order-1 lg:order-2">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 sm:p-7 relative transition-all">

              {/* Convocatoria o Próximos Cursos */}
              <div className="w-full mb-5">
                <div className="w-full flex items-center justify-between py-2.5 px-4 rounded-xl bg-itd-navy text-white text-xs font-bold shadow-xs">
                  <div className="flex items-center gap-2">
                    <span>📅</span>
                    <span>
                      {convocatoriaActiva
                        ? convocatoriaActiva.nombre
                        : 'Próximos cursos Enero 2027'}
                    </span>
                  </div>
                  <span className="text-sky-300 text-sm">›</span>
                </div>
              </div>

              {/* Banner interior con el imagotipo de formación y la fachada */}
              <div className="w-full rounded-2xl bg-gradient-to-r from-slate-50 via-white to-slate-50 border border-slate-200/80 p-4 mb-5 text-center relative overflow-hidden shadow-xs">
                {/* Acento geométrico lateral izquierdo */}
                <div className="absolute top-0 left-0 w-2 h-full bg-itd-navy" />
                {/* Acento geométrico lateral derecho */}
                <div className="absolute top-0 right-0 w-2 h-full bg-itd-guinda" />

                {/* Icono central de libro abierto y desarrollo */}
                <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-itd-guinda/10 border border-itd-guinda/20 flex items-center justify-center text-2xl shadow-xs">
                  📖
                </div>

                <h3 className="font-display text-xs sm:text-sm font-black text-itd-navy tracking-tight uppercase">
                  Instituto Tecnológico de Durango
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                  Desarrollo Académico
                </p>
                <p className="text-[9px] font-semibold text-itd-guinda uppercase tracking-widest">
                  Actualización Docente
                </p>
              </div>

              {/* Contenido Principal: Acceso Docente */}
              <div className="space-y-3 mt-4">
                {/* Mensaje de error si falla auth */}
                {error && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
                    <span>⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                {/* Botón Principal: Entrar con correo institucional */}
                <button
                  id="btn-login-google"
                  onClick={entrarConGoogle}
                  disabled={cargando}
                  className="w-full flex items-center justify-between rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 px-4 sm:px-5 py-3.5 text-sm font-bold text-slate-800 shadow-sm hover:shadow-md transition-all disabled:opacity-60 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    {/* Icono oficial Google 'G' */}
                    <svg width="20" height="20" viewBox="0 0 18 18" className="shrink-0 transition-transform group-hover:scale-110">
                      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z"/>
                      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/>
                      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"/>
                      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"/>
                    </svg>
                    <span className="text-left font-display text-slate-800 group-hover:text-itd-navy">
                      {cargando ? 'Iniciando sesión…' : 'Entrar con tu correo institucional'}
                    </span>
                  </div>
                  <span className="text-slate-400 group-hover:text-itd-guinda text-lg font-bold group-hover:translate-x-0.5 transition-transform">
                    ›
                  </span>
                </button>

                {/* Subtexto del dominio permitido */}
                <p className="text-center text-xs text-slate-500 mt-2 font-medium">
                  Solo cuentas <strong className="text-slate-700">@{DOMINIO_PERMITIDO}</strong>
                </p>

                {/* Separador sutil */}
                <div className="w-full border-t border-slate-100 my-3" />

                {/* Pregunta para Recursos Humanos y Validación */}
                <div className="text-center space-y-2">
                  <p className="text-[11px] sm:text-xs text-slate-500 font-medium flex items-center justify-center gap-1.5">
                    <span>📄</span>
                    <span>¿Necesitas verificar un documento emitido por el ITD?</span>
                  </p>

                  <button
                    id="btn-validar-constancia"
                    type="button"
                     onClick={abrirValidador}
                    className="w-full flex items-center justify-between rounded-xl border border-itd-navy/20 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 text-xs font-bold text-itd-navy transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🔍</span>
                      <span>Ir a verificación de folios y QR</span>
                    </div>
                    <span className="text-itd-navy/60 group-hover:text-itd-navy group-hover:translate-x-0.5 transition-transform">
                      ›
                    </span>
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* --------------------------------------------------------------------- */}
          {/* COLUMNA DERECHA: TRES PILARES FORMATIVOS & "ITD SIEMPRE CONTIGO"      */}
          {/* --------------------------------------------------------------------- */}
          <div className="lg:col-span-3 flex flex-col justify-center space-y-5 order-3">

            {/* Pilar 1: Actualiza tus conocimientos */}
            <div className="flex items-start gap-4 group">
              <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-700 text-xl shrink-0 shadow-xs group-hover:scale-110 transition-transform">
                💡
              </div>
              <div>
                <h4 className="font-display text-sm sm:text-base font-bold text-itd-navy group-hover:text-itd-guinda transition-colors">
                  Actualiza tus conocimientos
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                  Fortalece tu perfil profesional docente con programas de alta calidad.
                </p>
              </div>
            </div>

            {/* Pilar 2: Mejora tu práctica docente */}
            <div className="flex items-start gap-4 group">
              <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-700 text-xl shrink-0 shadow-xs group-hover:scale-110 transition-transform">
                📈
              </div>
              <div>
                <h4 className="font-display text-sm sm:text-base font-bold text-itd-navy group-hover:text-itd-guinda transition-colors">
                  Mejora tu práctica docente
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                  Genera un mayor impacto en el aprendizaje y éxito de tus estudiantes.
                </p>
              </div>
            </div>

            {/* Pilar 3: Construyamos juntos una mejor educación */}
            <div className="flex items-start gap-4 group">
              <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-700 text-xl shrink-0 shadow-xs group-hover:scale-110 transition-transform">
                👥
              </div>
              <div>
                <h4 className="font-display text-sm sm:text-base font-bold text-itd-navy group-hover:text-itd-guinda transition-colors">
                  Construyamos juntos una mejor educación
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                  El desarrollo docente es la base del desarrollo y prestigio institucional.
                </p>
              </div>
            </div>

            {/* Marca de agua caligráfica: "ITD Siempre contigo" */}
            <div className="pt-4 text-center lg:text-right select-none">
              <span className="font-serif italic text-2xl sm:text-3xl text-slate-300 tracking-tight transform -rotate-3 inline-block">
                ITD Siempre contigo
              </span>
            </div>
          </div>

        </div>
      </main>

      {/* ========================================================================= */}
      {/* 3. PIE DE PÁGINA INSTITUCIONAL                                            */}
      {/* ========================================================================= */}
      <footer className="relative z-10 w-full py-3 bg-[#781834] text-white text-center text-xs font-medium tracking-wide">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-2">
          <span>D.R. © Alejandro Calderón Rentería. 2026 · Instituto Tecnológico de Durango</span>
        </div>
      </footer>
    </div>
  )
}
