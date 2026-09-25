// src/components/AdminAvisos.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  FECHAS_ESPECIALES,
  obtenerBannerFechaEspecial,
  obtenerFechasPorMes,
  NOMBRES_MESES,
} from '../lib/bannerFechas'
import BannerConmemorativo from './BannerConmemorativo'

const TIPOS = [
  { id: 'info', label: 'Informativo (azul)' },
  { id: 'exito', label: 'Bueno / positivo (verde)' },
  { id: 'aviso', label: 'Aviso (ámbar)' },
  { id: 'urgente', label: 'Urgente (guinda)' },
]

const ESTILOS_TIPO = {
  info: { bg: '#0C447C', color: '#ffffff' },
  exito: { bg: '#3B6D11', color: '#ffffff' },
  aviso: { bg: '#FAC775', color: '#412402' },
  urgente: { bg: '#72243E', color: '#ffffff' },
}

export default function AdminAvisos() {
  const [tabActual, setTabActual] = useState('avisos') // 'avisos' | 'calendario'
  const [avisos, setAvisos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [tipo, setTipo] = useState('info')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth() + 1)

  const fechaHoy = new Date()
  const bannerActivoHoy = obtenerBannerFechaEspecial(fechaHoy)
  const fechasPorMes = obtenerFechasPorMes()

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('avisos')
      .select('*')
      .order('creado_en', { ascending: false })
    setAvisos(data || [])
    setCargando(false)
  }

  async function publicar() {
    setError('')
    if (!mensaje.trim()) return
    setGuardando(true)
    const { error: errorDB } = await supabase
      .from('avisos')
      .insert({ mensaje: mensaje.trim(), tipo })
    setGuardando(false)
    if (errorDB) {
      setError('No se pudo publicar: ' + errorDB.message)
      return
    }
    setMensaje('')
    setTipo('info')
    cargar()
  }

  async function alternarActivo(aviso) {
    await supabase.from('avisos').update({ activo: !aviso.activo }).eq('id', aviso.id)
    cargar()
  }

  async function eliminar(aviso) {
    if (!confirm('¿Eliminar este aviso por completo?')) return
    await supabase.from('avisos').delete().eq('id', aviso.id)
    cargar()
  }

  function usarComoPlantilla(fecha) {
    setMensaje(`${fecha.icono} ${fecha.titulo}: ${fecha.texto}`)
    setTabActual('avisos')
  }

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8 space-y-6">
      {/* Encabezado con selector de pestañas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="font-display text-xl font-bold text-itd-navy flex items-center gap-2">
            <span>📢</span>
            <span>Gestión de Avisos y Efemérides Institucionales</span>
          </h2>
          <p className="text-xs sm:text-sm text-itd-navyDark/60 mt-0.5">
            Configura avisos manuales o consulta el calendario automático de conmemoraciones (mes de la patria, cáncer de mama, día del maestro, aniversario ITD, etc.).
          </p>
        </div>

        {/* Pestañas de control */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 shrink-0 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setTabActual('avisos')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tabActual === 'avisos'
                ? 'bg-white text-itd-navy shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Avisos del Sistema ({avisos.filter((a) => a.activo).length} activos)
          </button>
          <button
            type="button"
            onClick={() => setTabActual('calendario')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tabActual === 'calendario'
                ? 'bg-white text-itd-navy shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🗓️ Efemérides y Meses ({FECHAS_ESPECIALES.length})
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PESTAÑA 1: GESTIÓN DE AVISOS MANUALES                                     */}
      {/* ========================================================================= */}
      {tabActual === 'avisos' && (
        <div className="space-y-6">
          {/* Vista previa de cómo se ve HOY en el Login */}
          {bannerActivoHoy && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <span>✨</span>
                  <span>Efeméride que se muestra automáticamente HOY en Login y Menú:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setTabActual('calendario')}
                  className="text-xs text-itd-navy font-semibold hover:underline"
                >
                  Ver todo el calendario anual ›
                </button>
              </div>
              <BannerConmemorativo fechaEspecial={bannerActivoHoy} />
            </div>
          )}

          {/* Formulario para publicar nuevo aviso */}
          <div className="rounded-2xl border border-itd-navy/15 bg-gradient-to-br from-white to-slate-50/50 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-itd-navy flex items-center gap-2">
                <span>✍️</span>
                <span>Publicar nuevo aviso institucional</span>
              </h3>
              <span className="text-[11px] text-slate-500">
                Se mostrará en tiempo real a todos los docentes antes y después de iniciar sesión.
              </span>
            </div>

            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Ejemplo: Convocatoria para el periodo Enero-Junio abierta. Recuerda registrarte antes del 15 de enero…"
              rows={2}
              maxLength={220}
              className="w-full rounded-xl border border-slate-300 focus:border-itd-navy focus:ring-2 focus:ring-itd-navy/10 px-3.5 py-2.5 text-sm transition-all outline-hidden"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600">Tipo de aviso:</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium bg-white"
                >
                  {TIPOS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-mono">
                  {mensaje.length}/220
                </span>
                <button
                  type="button"
                  onClick={publicar}
                  disabled={guardando || !mensaje.trim()}
                  className="rounded-xl bg-itd-navy hover:bg-itd-navyDark active:scale-95 text-white px-5 py-2 text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {guardando ? 'Publicando…' : '+ Publicar aviso'}
                </button>
              </div>
            </div>

            {/* Vista previa en vivo del aviso a redactar */}
            {mensaje.trim() && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">
                  Vista previa del aviso:
                </p>
                <div
                  className="rounded-xl px-4 py-2.5 text-xs font-medium text-center shadow-xs"
                  style={ESTILOS_TIPO[tipo]}
                >
                  {mensaje}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* Listado de avisos ya existentes */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Historial de avisos publicados
            </h3>

            {cargando ? (
              <p className="text-xs text-slate-400 py-6 text-center">Cargando avisos…</p>
            ) : avisos.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                No hay avisos manuales registrados aún.
              </div>
            ) : (
              <div className="space-y-2.5">
                {avisos.map((a) => (
                  <div
                    key={a.id}
                    className={`rounded-xl border p-4 transition-all ${
                      a.activo
                        ? 'border-slate-200 bg-white shadow-xs'
                        : 'border-slate-100 bg-slate-50/70 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ background: ESTILOS_TIPO[a.tipo]?.bg || '#0C447C' }}
                          />
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            {TIPOS.find((t) => t.id === a.tipo)?.label || a.tipo}
                          </span>
                          {!a.activo && (
                            <span className="text-[10px] font-semibold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                              Dado de baja
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
                          {a.mensaje}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => alternarActivo(a)}
                          className={`text-xs rounded-lg px-3 py-1.5 font-bold transition-all ${
                            a.activo
                              ? 'border border-slate-300 text-slate-700 hover:bg-slate-100'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {a.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminar(a)}
                          className="text-xs text-rose-600 hover:text-rose-800 hover:underline px-2 py-1 font-semibold"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: CALENDARIO DE EFEMÉRIDES Y FECHAS CONMEMORATIVAS               */}
      {/* ========================================================================= */}
      {tabActual === 'calendario' && (
        <div className="space-y-6">
          {/* Explicación de cómo funciona el sistema automático */}
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs leading-relaxed space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <span>💡</span>
              <span>Funcionamiento automático del calendario institucional:</span>
            </p>
            <p>
              El sistema detecta automáticamente el día y mes actual de acuerdo con el calendario oficial
              del Tecnológico de Durango. Muestra durante todo el mes la conmemoración correspondiente (ejemplo:
              <strong> Septiembre mes de la patria</strong>, <strong>Octubre mes rosa contra el cáncer de mama</strong>,
              <strong> Noviembre mes de las tradiciones y revolución</strong>) y en los días específicos
              conmemorativos (ejemplo: <strong>16 de septiembre</strong>, <strong>2 de agosto aniversario ITD</strong>,
              <strong> 15 de mayo día del maestro</strong>) la efeméride particular toma la prioridad principal.
            </p>
          </div>

          {/* Selector de Mes */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Selecciona un mes para ver sus fechas conmemorativas:
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {Object.values(fechasPorMes).map((m) => {
                const esMesActual = new Date().getMonth() + 1 === m.numero
                const esSeleccionado = mesSeleccionado === m.numero
                return (
                  <button
                    key={m.numero}
                    type="button"
                    onClick={() => setMesSeleccionado(m.numero)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all relative text-center border ${
                      esSeleccionado
                        ? 'bg-itd-navy text-white border-itd-navy shadow-sm scale-[1.02]'
                        : esMesActual
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {m.nombre}
                    {esMesActual && (
                      <span className="block text-[9px] font-normal opacity-80">
                        (Mes actual)
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Listado de fechas del mes seleccionado con vista previa */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-display text-sm font-bold text-itd-navy">
                Efemérides programadas para {NOMBRES_MESES[mesSeleccionado]}:
              </h3>
              <span className="text-xs text-slate-500">
                {fechasPorMes[mesSeleccionado]?.fechas.length || 0} eventos registrados
              </span>
            </div>

            <div className="grid gap-3.5">
              {fechasPorMes[mesSeleccionado]?.fechas.map((fecha) => (
                <div
                  key={fecha.id}
                  className="rounded-2xl border border-slate-200 p-4 bg-white shadow-2xs hover:shadow-xs transition-shadow space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                        {fecha.inicioMD} {fecha.inicioMD !== fecha.finMD ? `al ${fecha.finMD}` : ''}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {fecha.titulo}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => usarComoPlantilla(fecha)}
                      className="text-[11px] font-bold text-itd-navy hover:text-itd-guinda transition-colors self-start sm:self-auto flex items-center gap-1"
                    >
                      <span>📋</span>
                      <span>Usar texto en aviso manual</span>
                    </button>
                  </div>

                  {/* Vista previa exacta del banner */}
                  <BannerConmemorativo fechaEspecial={fecha} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
