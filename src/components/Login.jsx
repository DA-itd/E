import { useEffect, useState, useMemo } from 'react'
import { supabase, DOMINIO_PERMITIDO } from '../lib/supabaseClient'
import { formatearRangoFechas, formatearHora } from '../lib/formatoFechas'
import {
  DEPARTAMENTOS_ITD,
  coincideDepartamento,
} from './proydoce/AdminProyectosDocencia'
import AvisosBanner from './AvisosBanner'

const BASE = import.meta.env.BASE_URL?.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL || '.'}/`
const LOGO_TECNM_LOCAL = `${BASE}logos/logo-tecnm.jpg`
const LOGO_TECNM_REMOTE = 'https://raw.githubusercontent.com/DA-itd/E/main/public/logos/logo-tecnm.jpg'
const LOGO_ITD_LOCAL = `${BASE}logo_itdurango.png`
const LOGO_ITD_REMOTE = 'https://github.com/DA-itd/E/blob/main/logo_itdurango.png?raw=true'
const FACHADA_ITD_LOCAL = `${BASE}FachadaITD.png`
const FACHADA_ITD_REMOTE = 'https://github.com/DA-itd/E/blob/main/FachadaITD.png?raw=true'

export default function Login({ onIrAValidar }) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  // Oferta pública de cursos registrados (solo si hay convocatoria y cursos activos)
  const [convocatoriaActiva, setConvocatoriaActiva] = useState(null)
  const [cursosPublicos, setCursosPublicos] = useState([])
  const [cargandoCursos, setCargandoCursos] = useState(true)
  const [busquedaCurso, setBusquedaCurso] = useState('')
  const [deptoSeleccionado, setDeptoSeleccionado] = useState('todos')

  useEffect(() => {
    cargarOfertaCursos()
  }, [])

  async function cargarOfertaCursos() {
    setCargandoCursos(true)
    try {
      const { data: convs, error: errConv } = await supabase
        .from('convocatorias')
        .select('*')
        .eq('activo', true)
        .order('fecha_inicio', { ascending: false })

      if (errConv || !convs || convs.length === 0) {
        setConvocatoriaActiva(null)
        setCursosPublicos([])
        return
      }

      setConvocatoriaActiva(convs[0])
      const convIds = convs.map((c) => c.id)

      const { data: cursos, error: errCursos } = await supabase
        .from('cursos')
        .select('id, nombre, folio, instructor, departamento, fecha_inicio, fecha_fin, hora_inicio, hora_fin, horario, tipo, cupo_max, cerrado_manualmente')
        .in('convocatoria_id', convIds)
        .eq('status', 'activo')
        .order('fecha_inicio', { ascending: true })
        .order('nombre', { ascending: true })

      if (!errCursos && cursos) {
        setCursosPublicos(cursos.filter((c) => !c.cerrado_manualmente))
      } else {
        setCursosPublicos([])
      }
    } catch (e) {
      console.error('Error al cargar oferta de cursos:', e)
      setCursosPublicos([])
    } finally {
      setCargandoCursos(false)
    }
  }

  function abrirValidador() {
    window.location.hash = '#validar'
    if (typeof onIrAValidar === 'function') {
      onIrAValidar()
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

  function scrollHaciaLogin() {
    const el = document.getElementById('seccion-login-card')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const cursosFiltrados = useMemo(() => {
    return cursosPublicos.filter((c) => {
      if (deptoSeleccionado !== 'todos') {
        if (!coincideDepartamento(c.departamento, deptoSeleccionado)) return false
      }
      if (busquedaCurso.trim() !== '') {
        const q = busquedaCurso.toLowerCase().trim()
        const matchNombre = c.nombre?.toLowerCase().includes(q)
        const matchFolio = c.folio?.toLowerCase().includes(q)
        const matchInstructor = c.instructor?.toLowerCase().includes(q)
        const matchDepto = c.departamento?.toLowerCase().includes(q)
        if (!matchNombre && !matchFolio && !matchInstructor && !matchDepto) return false
      }
      return true
    })
  }, [cursosPublicos, deptoSeleccionado, busquedaCurso])

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-800 flex flex-col justify-between selection:bg-itd-gold selection:text-itd-navy font-sans">

      {/* ========================================================================= */}
      {/* 1. ENCABEZADO SUPERIOR INSTITUCIONAL (IDÉNTICO A PANTALLA 1)              */}
      {/* ========================================================================= */}
      <header className="w-full bg-white border-b border-slate-200 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          {/* Logo TecNM Izquierda */}
          <div className="flex items-center">
            <img
              src={LOGO_TECNM_LOCAL}
              onError={(e) => {
                if (e.currentTarget.src !== LOGO_TECNM_REMOTE) {
                  e.currentTarget.src = LOGO_TECNM_REMOTE
                }
              }}
              alt="Tecnológico Nacional de México"
              className="h-11 sm:h-14 w-auto object-contain shrink-0"
            />
          </div>

          {/* Título Central */}
          <div className="text-center flex-1 px-2">
            <h1 className="font-serif font-black text-sm sm:text-xl md:text-2xl text-[#1B396A] tracking-tight uppercase leading-tight">
              Instituto Tecnológico<br className="sm:hidden" /> de Durango
            </h1>
            <p className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
              Desarrollo Académico · Actualización Docente
            </p>
          </div>

          {/* Escudo Circular ITD Derecha */}
          <div className="flex items-center">
            <img
              src={LOGO_ITD_REMOTE}
              onError={(e) => {
                if (e.currentTarget.src !== LOGO_ITD_LOCAL) {
                  e.currentTarget.src = LOGO_ITD_LOCAL
                }
              }}
              alt="Instituto Tecnológico de Durango"
              className="h-11 sm:h-14 w-auto object-contain shrink-0"
            />
          </div>
        </div>
      </header>

      {/* Avisos institucionales activos */}
      <AvisosBanner className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-1" />

      {/* ========================================================================= */}
      {/* 2. HERO PRINCIPAL: FACHADA ITD CON GRADIENTE Y TIPOGRAFÍA DESTACADA        */}
      {/* ========================================================================= */}
      <div className="w-full relative overflow-hidden bg-slate-900 border-b border-slate-200">
        {/* Imagen de fondo de la fachada */}
        <div className="absolute inset-0">
          <img
            src={FACHADA_ITD_REMOTE}
            onError={(e) => {
              if (e.currentTarget.src !== FACHADA_ITD_LOCAL) {
                e.currentTarget.src = FACHADA_ITD_LOCAL
              }
            }}
            alt="Fachada del Instituto Tecnológico de Durango"
            className="w-full h-full object-cover object-center"
          />
          {/* Overlay de gradiente azul institucional profundo hacia la izquierda */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0C1E3C]/95 via-[#0C1E3C]/80 sm:via-[#0C1E3C]/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0C1E3C]/90 via-transparent to-black/20" />
        </div>

        {/* Contenido textual del Hero */}
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20 lg:py-24 text-white">
          <div className="max-w-xl space-y-4">
            {/* Pequeña barra bicolor superior (rojo / dorado) */}
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-8 h-1 bg-[#D9383A] rounded-full" />
              <span className="w-6 h-1 bg-[#E5B537] rounded-full" />
            </div>

            {/* Categoría */}
            <p className="text-xs sm:text-sm font-black tracking-widest text-slate-200 uppercase">
              Actualización Docente
            </p>

            {/* Titular Principal */}
            <h2 className="font-serif font-black text-2xl sm:text-4xl md:text-5xl leading-tight tracking-tight drop-shadow-sm">
              Formación hoy,<br />
              <span className="text-[#FF6584]">mejores docentes</span><br />
              mañana.
            </h2>

            {/* Subtítulo de 3 conceptos */}
            <p className="text-xs sm:text-sm text-slate-200 font-medium tracking-wide pt-1 opacity-90">
              Capacitación &nbsp;·&nbsp; Formación &nbsp;·&nbsp; Desarrollo profesional
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SECCIÓN INFERIOR: TARJETA DE ACCESO + 3 PILARES INSTITUCIONALES        */}
      {/* ========================================================================= */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* COLUMNA IZQUIERDA: TARJETA DE ACCESO DOCENTE */}
          <div id="seccion-login-card" className="lg:col-span-6 w-full">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">

              {/* Cabecera de la tarjeta: Avatar e Introducción */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[#781834] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-serif text-lg sm:text-xl font-bold text-[#1B396A]">
                    Acceso docente
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
                    Ingresa con tu cuenta institucional para acceder a los servicios de Actualización Docente.
                  </p>
                </div>
              </div>

              {/* Mensaje de error si falla la autenticación */}
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Botón Principal: Continuar con Google (Color Guinda Institucional #781834) */}
              <div className="space-y-2">
                <button
                  id="btn-login-google"
                  onClick={entrarConGoogle}
                  disabled={cargando}
                  className="w-full flex items-center justify-center gap-3 rounded-xl bg-[#781834] hover:bg-[#60132a] active:bg-[#4d0f22] text-white py-3 px-5 text-sm font-bold shadow-xs hover:shadow-md transition-all disabled:opacity-60 cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0">
                    <svg width="15" height="15" viewBox="0 0 18 18">
                      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z"/>
                      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/>
                      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"/>
                      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"/>
                    </svg>
                  </div>
                  <span>{cargando ? 'Iniciando sesión…' : 'Continuar con Google'}</span>
                </button>

                <p className="text-center text-xs text-slate-500 font-medium">
                  Solo cuentas <strong className="text-slate-700">@{DOMINIO_PERMITIDO}</strong>
                </p>
              </div>

              {/* Separador sutil con "o" */}
              <div className="relative flex items-center justify-center my-3">
                <div className="w-full border-t border-slate-200" />
                <span className="bg-white px-3 text-xs text-slate-400 font-medium uppercase absolute">
                  o
                </span>
              </div>

              {/* Módulo Interior de Validación de Documentos */}
              <div className="rounded-xl bg-[#F0F5FA] border border-[#D5E3F0] p-4 sm:p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-white text-[#1B396A] border border-[#CBDCE9] flex items-center justify-center shrink-0 shadow-2xs">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-[#1B396A]">
                      ¿Necesitas verificar un documento?
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 leading-snug">
                      Consulta la autenticidad de constancias o reconocimientos por folio o QR.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={abrirValidador}
                  className="w-full flex items-center justify-between rounded-lg border border-[#B8D2E8] bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-[#1B396A] shadow-2xs transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span>🔲</span>
                    <span>Verificar folio o QR</span>
                  </div>
                  <span className="text-[#1B396A] font-bold">›</span>
                </button>
              </div>

            </div>
          </div>

          {/* COLUMNA DERECHA: LOS 3 PILARES INSTITUCIONALES */}
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6 pt-2 lg:pt-4">

            {/* Pilar 1: Formación de calidad */}
            <div className="flex items-start gap-4 group">
              <div className="w-13 h-13 rounded-full bg-[#E5EEF9] border border-[#CCE0F5] text-[#1B396A] flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                🎓
              </div>
              <div className="pt-0.5">
                <h4 className="font-bold text-sm sm:text-base text-[#1B396A]">
                  Formación de calidad
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-0.5">
                  Fortalecemos tus competencias docentes y profesionales.
                </p>
              </div>
            </div>

            {/* Pilar 2: Innovación educativa */}
            <div className="flex items-start gap-4 group">
              <div className="w-13 h-13 rounded-full bg-[#FFF7E6] border border-[#FFE7B3] text-[#B88710] flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                💡
              </div>
              <div className="pt-0.5">
                <h4 className="font-bold text-sm sm:text-base text-[#1B396A]">
                  Innovación educativa
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-0.5">
                  Impulsamos la mejora continua en la docencia.
                </p>
              </div>
            </div>

            {/* Pilar 3: Compromiso institucional */}
            <div className="flex items-start gap-4 group">
              <div className="w-13 h-13 rounded-full bg-[#E9F7EF] border border-[#CEEFE0] text-[#1D7D4D] flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                👥
              </div>
              <div className="pt-0.5">
                <h4 className="font-bold text-sm sm:text-base text-[#1B396A]">
                  Compromiso institucional
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mt-0.5">
                  La educación tecnológica al servicio de la patria.
                </p>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* ========================================================================= */}
      {/* 4. CARTELERA PÚBLICA (SOLO SI HAY CURSOS ACTIVOS REGISTRADOS)             */}
      {/* ========================================================================= */}
      {!cargandoCursos && cursosPublicos.length > 0 && (
        <section id="oferta-cursos" className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 border-t border-slate-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#1B396A]">
                  Oferta de Cursos de Actualización Docente
                </h3>
                <p className="text-xs text-slate-500">
                  {convocatoriaActiva ? `Convocatoria Abierta: ${convocatoriaActiva.nombre}` : 'Cursos abiertos para este ciclo'}
                </p>
              </div>
              <button
                onClick={cargarOfertaCursos}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition cursor-pointer"
              >
                🔄 Actualizar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div className="sm:col-span-5">
                <label className="block font-semibold text-slate-600 mb-1">Departamento</label>
                <select
                  value={deptoSeleccionado}
                  onChange={(e) => setDeptoSeleccionado(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="todos">🏢 Todos los departamentos</option>
                  {DEPARTAMENTOS_ITD.map((depto) => (
                    <option key={depto} value={depto}>{depto}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-7">
                <label className="block font-semibold text-slate-600 mb-1">Buscar curso</label>
                <input
                  type="text"
                  value={busquedaCurso}
                  onChange={(e) => setBusquedaCurso(e.target.value)}
                  placeholder="Nombre o instructor..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cursosFiltrados.map((curso) => (
                <div key={curso.id} className="rounded-xl border border-slate-200 p-4 bg-white flex flex-col justify-between hover:border-blue-400 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-700">{curso.folio || 'CURSO'}</span>
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Activo</span>
                    </div>
                    <h4 className="font-bold text-sm text-[#1B396A] leading-snug">{curso.nombre}</h4>
                    {curso.departamento && (
                      <p className="text-[11px] text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{curso.departamento}</p>
                    )}
                    <div className="text-[11px] text-slate-500 space-y-0.5 pt-1">
                      {curso.instructor && <p>👨‍🏫 <strong>{curso.instructor}</strong></p>}
                      {curso.fecha_inicio && <p>📅 {formatearRangoFechas(curso.fecha_inicio, curso.fecha_fin)}</p>}
                      {curso.horario && <p>⏰ {curso.horario}</p>}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100">
                    <button
                      onClick={scrollHaciaLogin}
                      className="w-full py-1.5 px-3 rounded-lg bg-[#1B396A] hover:bg-[#122748] text-white text-xs font-bold transition cursor-pointer"
                    >
                      Inscribirme a este curso →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 5. CINTILLO / LEMAS OFICIALES TECNM (IDÉNTICO A PANTALLA 1)               */}
      {/* ========================================================================= */}
      <div className="w-full py-4 bg-white border-t border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 flex flex-col items-center justify-center gap-1 text-center">
          {/* Cintas estilizadas en rojo, dorado y azul marino */}
          <div className="w-48 h-1 bg-gradient-to-r from-[#781834] via-[#D6A01D] to-[#1B396A] rounded-full mb-2" />
          <p className="font-serif italic font-bold text-base sm:text-lg text-[#781834] tracking-wider">
            TecNM
          </p>
          <p className="font-serif italic text-xs sm:text-sm text-[#1B396A] tracking-wide">
            «La Técnica al Servicio de la Patria®»
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. PIE DE PÁGINA INSTITUCIONAL GUINDA (IDÉNTICO A PANTALLA 1)             */}
      {/* ========================================================================= */}
      <footer className="w-full bg-[#781834] text-white py-3.5 px-4 sm:px-6 lg:px-8 border-t border-black/10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          {/* Columna Izquierda: Derechos y Nombre */}
          <div className="flex items-center gap-2 text-white/90">
            <span className="text-base">🏛️</span>
            <span>D.R. © Alejandro Calderón Rentería. 2026 · Instituto Tecnológico de Durango</span>
          </div>

          {/* Columna Derecha: Departamento de Desarrollo Académico */}
          <div className="flex items-center gap-2 text-white/90 font-medium">
            <span className="text-base">🛡️</span>
            <span>Departamento de Desarrollo Académico</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
