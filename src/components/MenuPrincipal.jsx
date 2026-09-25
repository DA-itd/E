import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AvisosBanner from './AvisosBanner'

const BASE = import.meta.env.BASE_URL?.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL || '.'}/`
const LOGO_TECNM_LOCAL = `${BASE}logos/logo-tecnm.jpg`
const LOGO_TECNM_REMOTE = 'https://raw.githubusercontent.com/DA-itd/E/main/public/logos/logo-tecnm.jpg'
const FACHADA_ITD_LOCAL = `${BASE}FachadaITD.png`
const FACHADA_ITD_REMOTE = 'https://github.com/DA-itd/E/blob/main/FachadaITD.png?raw=true'

export default function MenuPrincipal({ docente, esAdmin, onIr }) {
  const [estadisticas, setEstadisticas] = useState({
    cursosRealizados: 12,
    constanciasDisponibles: 8,
    horasAcumuladas: 120,
    cobertura: 100,
  })
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false)
  const [esNoche, setEsNoche] = useState(() => {
    try {
      return localStorage.getItem('tema_itd') === 'noche'
    } catch {
      return false
    }
  })

  function alternarModoOscuro() {
    setEsNoche((prev) => {
      const nuevo = !prev
      try {
        localStorage.setItem('tema_itd', nuevo ? 'noche' : 'dia')
      } catch {}
      return nuevo
    })
  }

  const primerNombre = docente?.nombre_completo
    ? docente.nombre_completo.split(' ')[0]
    : esAdmin
    ? 'Alejandro'
    : 'Docente'

  const nombreMayusculas = primerNombre.toUpperCase()
  const departamentoDocente = docente?.departamento || 'Sistemas y Computación'

  useEffect(() => {
    cargarEstadisticasDocente()
  }, [docente])

  async function cargarEstadisticasDocente() {
    if (!docente?.id) return
    try {
      // Consultar cursos o inscripciones del docente
      const { data: inscripciones, error } = await supabase
        .from('inscripciones')
        .select('id, estado, cursos(id, horas)')
        .eq('docente_id', docente.id)

      if (!error && inscripciones && inscripciones.length > 0) {
        const acreditados = inscripciones.filter(
          (ins) => ins.estado === 'acreditado' || ins.estado === 'aprobado' || ins.estado === 'concluido'
        )
        const totalHoras = acreditados.reduce((acc, curr) => acc + (curr.cursos?.horas || 30), 0)
        
        setEstadisticas({
          cursosRealizados: inscripciones.length,
          constanciasDisponibles: acreditados.length || inscripciones.length,
          horasAcumuladas: totalHoras || inscripciones.length * 30,
          cobertura: 100,
        })
      }
    } catch (e) {
      console.warn('Usando estadísticas por defecto para el dashboard:', e)
    }
  }

  // Mes actual para el cintillo patrio / institucional
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]
  const mesActual = meses[new Date().getMonth()]

  return (
    <div className={`min-h-screen flex flex-col justify-between selection:bg-itd-gold selection:text-itd-navy font-sans transition-colors duration-200 ${
      esNoche ? 'bg-[#0B132B] text-slate-100' : 'bg-[#F4F6F9] text-slate-800'
    }`}>

      {/* ========================================================================= */}
      {/* 1. ENCABEZADO SUPERIOR (IDÉNTICO A PANTALLA 2)                             */}
      {/* ========================================================================= */}
      <header className={`w-full border-b shadow-2xs sticky top-0 z-30 transition-colors duration-200 ${
        esNoche ? 'bg-[#0F1B36] border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
          
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
              className="h-10 sm:h-12 w-auto object-contain shrink-0"
            />
          </div>

          {/* Título Central */}
          <div className="text-center flex-1 px-2 hidden sm:block">
            <h1 className={`font-serif font-black text-xs sm:text-base tracking-tight uppercase leading-tight ${
              esNoche ? 'text-blue-200' : 'text-[#1B396A]'
            }`}>
              Instituto Tecnológico de Durango
            </h1>
            <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${
              esNoche ? 'text-slate-400' : 'text-slate-500'
            }`}>
              Actualización Docente
            </p>
          </div>

          {/* Acciones Derecha: Día/Noche, Campana de Notificación y Menú de Usuario */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Botón discreto Día / Noche */}
            <button
              type="button"
              onClick={alternarModoOscuro}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-2xs cursor-pointer ${
                esNoche
                  ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-transparent'
              }`}
              title={esNoche ? 'Modo actual: Noche. Clic para cambiar a Día' : 'Modo actual: Día. Clic para cambiar a Noche'}
              aria-label="Alternar modo día y noche"
            >
              {esNoche ? (
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Campana */}
            <button
              type="button"
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow-2xs cursor-pointer ${
                esNoche
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
              title="Notificaciones"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>

            {/* Pastilla de Usuario */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuUsuarioAbierto(!menuUsuarioAbierto)}
                className={`flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full transition-colors text-left cursor-pointer border ${
                  esNoche
                    ? 'hover:bg-slate-800 border-transparent hover:border-slate-700 text-slate-200'
                    : 'hover:bg-slate-100 border-transparent hover:border-slate-200 text-slate-800'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-[#1B396A] text-white flex items-center justify-center shrink-0 text-xs font-bold shadow-2xs">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="hidden sm:block leading-tight">
                  <p className={`text-xs font-bold ${esNoche ? 'text-slate-200' : 'text-slate-800'}`}>
                    Hola, {primerNombre}
                  </p>
                  <p className={`text-[10px] font-medium ${esNoche ? 'text-slate-400' : 'text-slate-500'}`}>
                    {esAdmin ? 'Administrador' : 'Docente'} ▾
                  </p>
                </div>
              </button>

              {/* Menú desplegable */}
              {menuUsuarioAbierto && (
                <div className={`absolute right-0 mt-2 w-48 rounded-xl shadow-lg border py-1.5 z-50 text-xs ${
                  esNoche
                    ? 'bg-[#152347] border-slate-700 text-slate-200 shadow-black/40'
                    : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <div className={`px-3 py-2 border-b ${esNoche ? 'border-slate-700/60' : 'border-slate-100'}`}>
                    <p className={`font-bold ${esNoche ? 'text-slate-100' : 'text-slate-800'}`}>{docente?.nombre_completo || 'Usuario ITD'}</p>
                    <p className={`truncate text-[11px] ${esNoche ? 'text-slate-400' : 'text-slate-500'}`}>{docente?.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setMenuUsuarioAbierto(false)
                      supabase.auth.signOut()
                    }}
                    className="w-full text-left px-3 py-2 text-rose-500 hover:bg-rose-500/10 font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <span>🚪</span>
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. CINTILLO INSTITUCIONAL / CONMEMORATIVO DEL MES                          */}
      {/* ========================================================================= */}
      <div className="w-full bg-[#781834] text-white py-2 px-4 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 text-xs font-medium">
          <div className="flex items-center gap-3">
            {/* Bandera de México */}
            <span className="text-lg leading-none select-none">🇲🇽</span>
            <span className="tracking-wide">
              {mesActual} &nbsp;·&nbsp; <strong className="font-semibold">Mes de la Patria y Orgullo Mexicano</strong>
            </span>
          </div>

          {/* Cintas decorativas tricolores sutiles a la derecha */}
          <div className="hidden sm:flex items-center gap-1 opacity-70">
            <span className="w-4 h-1 bg-green-500 rounded-full" />
            <span className="w-4 h-1 bg-white rounded-full" />
            <span className="w-4 h-1 bg-red-500 rounded-full" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CUERPO PRINCIPAL DEL DASHBOARD                                         */}
      {/* ========================================================================= */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 space-y-6">

        {/* Avisos del sistema / Dirección */}
        <AvisosBanner />

        {/* ======================================================================= */}
        {/* 3.1. TARJETA HERO DE BIENVENIDA (FONDO AZUL MARINO PROFUNDO)           */}
        {/* ======================================================================= */}
        <div className="relative rounded-2xl bg-[#0E2548] text-white overflow-hidden p-6 sm:p-8 shadow-sm">
          {/* Marca de agua de la fachada del ITD en la parte derecha */}
          <div className="absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none overflow-hidden opacity-20">
            <img
              src={FACHADA_ITD_REMOTE}
              onError={(e) => {
                if (e.currentTarget.src !== FACHADA_ITD_LOCAL) {
                  e.currentTarget.src = FACHADA_ITD_LOCAL
                }
              }}
              alt=""
              className="w-full h-full object-cover object-left filter brightness-125"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0E2548] via-[#0E2548]/80 to-transparent" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Textos de bienvenida */}
            <div className="space-y-1.5">
              <h2 className="font-serif font-black text-2xl sm:text-3xl text-white tracking-tight flex items-center gap-2">
                <span>Hola, {nombreMayusculas}</span>
                <span className="text-2xl sm:text-3xl">👋</span>
              </h2>
              <p className="text-sm sm:text-base font-semibold text-slate-200">
                Bienvenido a tu portal de actualización docente.
              </p>
              <p className="text-xs sm:text-sm text-slate-300 opacity-90">
                Aquí podrás gestionar tus cursos, constancias y más.
              </p>
            </div>

            {/* Módulo de Departamento a la derecha */}
            <div className="flex items-center gap-3.5 bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl px-4 py-3 shrink-0 max-w-xs shadow-inner">
              <div className="w-10 h-10 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-xl shrink-0">
                🎓
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                  Departamento
                </p>
                <p className="text-xs sm:text-sm font-bold text-white truncate">
                  {departamentoDocente}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* 3.2. SECCIÓN: TU ACTIVIDAD (4 TARJETAS DE INDICADORES CLAVE)            */}
        {/* ======================================================================= */}
        <div className="space-y-3">
          <h3 className={`font-bold text-xs sm:text-sm uppercase tracking-wider ${
            esNoche ? 'text-blue-300' : 'text-[#1B396A]'
          }`}>
            Tu actividad
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            
            {/* Card 1: Cursos realizados */}
            <div className={`rounded-xl border p-4 transition-all flex items-center gap-3.5 ${
              esNoche
                ? 'bg-[#132247] border-slate-800 shadow-none'
                : 'bg-white border-slate-200 shadow-2xs hover:shadow-xs'
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                esNoche
                  ? 'bg-blue-950/80 border border-blue-800/60 text-blue-300'
                  : 'bg-blue-50 border border-blue-200 text-blue-600'
              }`}>
                📖
              </div>
              <div className="min-w-0">
                <p className={`font-bold text-lg sm:text-xl leading-tight ${esNoche ? 'text-white' : 'text-slate-900'}`}>
                  {estadisticas.cursosRealizados}
                </p>
                <p className={`text-xs font-medium truncate mt-0.5 ${esNoche ? 'text-slate-400' : 'text-slate-500'}`}>
                  Cursos realizados
                </p>
              </div>
            </div>

            {/* Card 2: Constancias disponibles */}
            <div className={`rounded-xl border p-4 transition-all flex items-center gap-3.5 ${
              esNoche
                ? 'bg-[#132247] border-slate-800 shadow-none'
                : 'bg-white border-slate-200 shadow-2xs hover:shadow-xs'
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                esNoche
                  ? 'bg-rose-950/80 border border-rose-800/60 text-rose-300'
                  : 'bg-rose-50 border border-rose-200 text-[#781834]'
              }`}>
                📄
              </div>
              <div className="min-w-0">
                <p className={`font-bold text-lg sm:text-xl leading-tight ${esNoche ? 'text-white' : 'text-slate-900'}`}>
                  {estadisticas.constanciasDisponibles}
                </p>
                <p className={`text-xs font-medium truncate mt-0.5 ${esNoche ? 'text-slate-400' : 'text-slate-500'}`}>
                  Constancias disponibles
                </p>
              </div>
            </div>

            {/* Card 3: Horas acumuladas */}
            <div className={`rounded-xl border p-4 transition-all flex items-center gap-3.5 ${
              esNoche
                ? 'bg-[#132247] border-slate-800 shadow-none'
                : 'bg-white border-slate-200 shadow-2xs hover:shadow-xs'
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                esNoche
                  ? 'bg-emerald-950/80 border border-emerald-800/60 text-emerald-300'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
              }`}>
                🕒
              </div>
              <div className="min-w-0">
                <p className={`font-bold text-lg sm:text-xl leading-tight ${esNoche ? 'text-white' : 'text-slate-900'}`}>
                  {estadisticas.horasAcumuladas} h
                </p>
                <p className={`text-xs font-medium truncate mt-0.5 ${esNoche ? 'text-slate-400' : 'text-slate-500'}`}>
                  Horas acumuladas
                </p>
              </div>
            </div>

            {/* Card 4: Cobertura de cursos */}
            <div className={`rounded-xl border p-4 transition-all flex items-center gap-3.5 ${
              esNoche
                ? 'bg-[#132247] border-slate-800 shadow-none'
                : 'bg-white border-slate-200 shadow-2xs hover:shadow-xs'
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                esNoche
                  ? 'bg-amber-950/80 border border-amber-800/60 text-amber-300'
                  : 'bg-amber-50 border border-amber-200 text-amber-600'
              }`}>
                📊
              </div>
              <div className="min-w-0">
                <p className={`font-bold text-lg sm:text-xl leading-tight ${esNoche ? 'text-white' : 'text-slate-900'}`}>
                  {estadisticas.cobertura}%
                </p>
                <p className={`text-xs font-medium truncate mt-0.5 ${esNoche ? 'text-slate-400' : 'text-slate-500'}`}>
                  Cobertura de cursos
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* ======================================================================= */}
        {/* 3.3. CUADRÍCULA DE 4 TARJETAS PRINCIPALES DE ACCIÓN                    */}
        {/* ======================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">

          {/* TARJETA 1: INSCRIPCIÓN A CURSOS (AZUL) */}
          <div
            onClick={() => onIr('inscripcion')}
            className={`group rounded-2xl border transition-all overflow-hidden flex flex-col justify-between cursor-pointer ${
              esNoche
                ? 'bg-[#132247] border-slate-800 hover:border-blue-500/50 shadow-none hover:shadow-lg hover:shadow-blue-950/40'
                : 'bg-white border-slate-200 hover:border-blue-300 shadow-xs hover:shadow-lg'
            }`}
          >
            {/* Encabezado visual fotográfico ilustrativo */}
            <div className="relative h-28 sm:h-32 bg-gradient-to-r from-blue-700 via-blue-600 to-sky-500 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80"
                alt=""
                className="w-full h-full object-cover mix-blend-overlay opacity-60 group-hover:scale-105 transition-transform duration-500"
              />
              <div className={`absolute inset-0 bg-gradient-to-t via-transparent to-transparent ${
                esNoche ? 'from-[#132247]' : 'from-white'
              }`} />
              
              {/* Badge Circular Flotante */}
              <div className="absolute bottom-2 left-5 w-12 h-12 rounded-xl bg-[#026AA2] text-white flex items-center justify-center text-2xl shadow-md border-2 border-white/80">
                📖
              </div>
            </div>

            {/* Contenido y Botón */}
            <div className="p-5 pt-3 space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <h4 className={`font-serif text-lg font-bold transition-colors ${
                  esNoche ? 'text-white group-hover:text-blue-300' : 'text-[#1B396A] group-hover:text-blue-700'
                }`}>
                  Inscripción a Cursos
                </h4>
                <p className={`text-xs sm:text-sm mt-1 leading-relaxed ${
                  esNoche ? 'text-slate-300' : 'text-slate-600'
                }`}>
                  Inscríbete a los cursos de la convocatoria vigente o revisa tus cursos activos.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#026AA2] hover:bg-[#025684] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <span>Ir a inscripción</span>
                  <span className="text-sm">›</span>
                </button>
                <span className={`text-lg font-bold transition-all group-hover:translate-x-1 ${
                  esNoche ? 'text-slate-500 group-hover:text-blue-300' : 'text-slate-400 group-hover:text-[#026AA2]'
                }`}>
                  →
                </span>
              </div>
            </div>
          </div>

          {/* TARJETA 2: HISTORIAL DE CURSOS (TEAL / VERDE) */}
          <div
            onClick={() => onIr('historial')}
            className={`group rounded-2xl border transition-all overflow-hidden flex flex-col justify-between cursor-pointer ${
              esNoche
                ? 'bg-[#132247] border-slate-800 hover:border-emerald-500/50 shadow-none hover:shadow-lg hover:shadow-emerald-950/40'
                : 'bg-white border-slate-200 hover:border-emerald-300 shadow-xs hover:shadow-lg'
            }`}
          >
            {/* Encabezado visual fotográfico ilustrativo */}
            <div className="relative h-28 sm:h-32 bg-gradient-to-r from-emerald-800 via-teal-700 to-emerald-600 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&auto=format&fit=crop&q=80"
                alt=""
                className="w-full h-full object-cover mix-blend-overlay opacity-60 group-hover:scale-105 transition-transform duration-500"
              />
              <div className={`absolute inset-0 bg-gradient-to-t via-transparent to-transparent ${
                esNoche ? 'from-[#132247]' : 'from-white'
              }`} />
              
              {/* Badge Circular Flotante */}
              <div className="absolute bottom-2 left-5 w-12 h-12 rounded-xl bg-[#0E7A62] text-white flex items-center justify-center text-2xl shadow-md border-2 border-white/80">
                📊
              </div>
            </div>

            {/* Contenido y Botón */}
            <div className="p-5 pt-3 space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <h4 className={`font-serif text-lg font-bold transition-colors ${
                  esNoche ? 'text-white group-hover:text-emerald-300' : 'text-[#1B396A] group-hover:text-[#0E7A62]'
                }`}>
                  Historial de Cursos
                </h4>
                <p className={`text-xs sm:text-sm mt-1 leading-relaxed ${
                  esNoche ? 'text-slate-300' : 'text-slate-600'
                }`}>
                  Consulta y descarga tu kardex con todos los cursos que has acreditado.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0E7A62] hover:bg-[#0a5c4a] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <span>Ver historial</span>
                  <span className="text-sm">›</span>
                </button>
                <span className={`text-lg font-bold transition-all group-hover:translate-x-1 ${
                  esNoche ? 'text-slate-500 group-hover:text-emerald-300' : 'text-slate-400 group-hover:text-[#0E7A62]'
                }`}>
                  →
                </span>
              </div>
            </div>
          </div>

          {/* TARJETA 3: DESCARGA DE CONSTANCIAS (NARANJA / AMBER) */}
          <div
            onClick={() => onIr('constancias')}
            className={`group rounded-2xl border transition-all overflow-hidden flex flex-col justify-between cursor-pointer ${
              esNoche
                ? 'bg-[#132247] border-slate-800 hover:border-amber-500/50 shadow-none hover:shadow-lg hover:shadow-amber-950/40'
                : 'bg-white border-slate-200 hover:border-amber-300 shadow-xs hover:shadow-lg'
            }`}
          >
            {/* Encabezado visual fotográfico ilustrativo */}
            <div className="relative h-28 sm:h-32 bg-gradient-to-r from-amber-700 via-orange-600 to-amber-500 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=600&auto=format&fit=crop&q=80"
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=600&auto=format&fit=crop&q=80'
                }}
                alt="Constancias y diplomas institucionales"
                className="w-full h-full object-cover mix-blend-overlay opacity-85 group-hover:scale-105 transition-transform duration-500"
              />
              <div className={`absolute inset-0 bg-gradient-to-t via-transparent to-transparent ${
                esNoche ? 'from-[#132247]' : 'from-white'
              }`} />
              
              {/* Badge Circular Flotante */}
              <div className="absolute bottom-2 left-5 w-12 h-12 rounded-xl bg-[#C45500] text-white flex items-center justify-center text-2xl shadow-md border-2 border-white/80">
                📜
              </div>
            </div>

            {/* Contenido y Botón */}
            <div className="p-5 pt-3 space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <h4 className={`font-serif text-lg font-bold transition-colors ${
                  esNoche ? 'text-white group-hover:text-amber-300' : 'text-[#1B396A] group-hover:text-[#C45500]'
                }`}>
                  Descarga de Constancias
                </h4>
                <p className={`text-xs sm:text-sm mt-1 leading-relaxed ${
                  esNoche ? 'text-slate-300' : 'text-slate-600'
                }`}>
                  Descarga tus constancias oficiales y reconocimientos ya validados.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C45500] hover:bg-[#a64700] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <span>Ir a constancias</span>
                  <span className="text-sm">›</span>
                </button>
                <span className={`text-lg font-bold transition-all group-hover:translate-x-1 ${
                  esNoche ? 'text-slate-500 group-hover:text-amber-300' : 'text-slate-400 group-hover:text-[#C45500]'
                }`}>
                  →
                </span>
              </div>
            </div>
          </div>

          {/* TARJETA 4: PREREGISTRO DE CURSO (PÚRPURA / MORADO) */}
          <div
            onClick={() => onIr('preregistro')}
            className={`group rounded-2xl border transition-all overflow-hidden flex flex-col justify-between cursor-pointer ${
              esNoche
                ? 'bg-[#132247] border-slate-800 hover:border-purple-500/50 shadow-none hover:shadow-lg hover:shadow-purple-950/40'
                : 'bg-white border-slate-200 hover:border-purple-300 shadow-xs hover:shadow-lg'
            }`}
          >
            {/* Encabezado visual fotográfico ilustrativo */}
            <div className="relative h-28 sm:h-32 bg-gradient-to-r from-purple-800 via-purple-700 to-indigo-600 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&auto=format&fit=crop&q=80"
                alt=""
                className="w-full h-full object-cover mix-blend-overlay opacity-60 group-hover:scale-105 transition-transform duration-500"
              />
              <div className={`absolute inset-0 bg-gradient-to-t via-transparent to-transparent ${
                esNoche ? 'from-[#132247]' : 'from-white'
              }`} />
              
              {/* Badge Circular Flotante */}
              <div className="absolute bottom-2 left-5 w-12 h-12 rounded-xl bg-[#5B32A8] text-white flex items-center justify-center text-2xl shadow-md border-2 border-white/80">
                ✏️
              </div>
            </div>

            {/* Contenido y Botón */}
            <div className="p-5 pt-3 space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <h4 className={`font-serif text-lg font-bold transition-colors ${
                  esNoche ? 'text-white group-hover:text-purple-300' : 'text-[#1B396A] group-hover:text-[#5B32A8]'
                }`}>
                  Preregistro de Curso
                </h4>
                <p className={`text-xs sm:text-sm mt-1 leading-relaxed ${
                  esNoche ? 'text-slate-300' : 'text-slate-600'
                }`}>
                  Propón un curso para impartir: nombre, objetivo y periodo intersemestral.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5B32A8] hover:bg-[#4a288c] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <span>Ir a preregistro</span>
                  <span className="text-sm">›</span>
                </button>
                <span className={`text-lg font-bold transition-all group-hover:translate-x-1 ${
                  esNoche ? 'text-slate-500 group-hover:text-purple-300' : 'text-slate-400 group-hover:text-[#5B32A8]'
                }`}>
                  →
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* ======================================================================= */}
        {/* 3.4. PANEL DE ADMINISTRACIÓN (SOLO VISIBLE SI ES ADMINISTRADOR)         */}
        {/* ======================================================================= */}
        {esAdmin && (
          <div
            onClick={() => onIr('administracion')}
            className={`group rounded-2xl border p-5 transition-all flex items-center justify-between cursor-pointer ${
              esNoche
                ? 'bg-gradient-to-r from-[#132247] via-[#1c2e5a] to-[#132247] border-slate-800 hover:border-slate-700 shadow-none'
                : 'bg-gradient-to-r from-slate-100 via-blue-50/70 to-slate-100 border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#3A5A80] text-white flex items-center justify-center text-2xl shrink-0 shadow-xs">
                ⚙️
              </div>
              <div>
                <h4 className={`font-serif text-base font-bold transition-colors ${
                  esNoche ? 'text-white group-hover:text-blue-300' : 'text-[#1B396A] group-hover:text-blue-800'
                }`}>
                  Panel de Administración
                </h4>
                <p className={`text-xs mt-0.5 ${esNoche ? 'text-slate-300' : 'text-slate-600'}`}>
                  Revisión de asistencia, validación, constancias y gestión de cursos.
                </p>
              </div>
            </div>

            <span className={`text-xl font-bold transition-all group-hover:translate-x-1 ${
              esNoche ? 'text-slate-400 group-hover:text-blue-300' : 'text-slate-400 group-hover:text-[#1B396A]'
            }`}>
              →
            </span>
          </div>
        )}

        {/* ======================================================================= */}
        {/* 3.5. ACCIÓN INFERIOR: CERRAR SESIÓN (ALINEADO A LA DERECHA)             */}
        {/* ======================================================================= */}
        <div className="flex justify-end pt-2">
          <button
            onClick={() => supabase.auth.signOut()}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              esNoche ? 'text-rose-400 hover:text-rose-300' : 'text-rose-700 hover:text-rose-900'
            }`}
          >
            <span>🚪</span>
            <span>Cerrar sesión</span>
          </button>
        </div>

      </main>

      {/* ========================================================================= */}
      {/* 4. PIE DE PÁGINA INSTITUCIONAL GUINDA                                     */}
      {/* ========================================================================= */}
      <footer className="w-full bg-[#781834] text-white py-3 px-4 sm:px-6 lg:px-8 border-t border-black/10">
        <div className="max-w-6xl mx-auto flex items-center justify-center text-xs">
          <div className="flex items-center gap-2 text-white/90">
            <span className="text-base">🏛️</span>
            <span>D.R. © Alejandro Calderón Rentería. 2026 · Instituto Tecnológico de Durango</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
