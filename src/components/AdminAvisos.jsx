import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

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
  const [avisos, setAvisos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [tipo, setTipo] = useState('info')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('avisos').select('*').order('creado_en', { ascending: false })
    setAvisos(data || [])
    setCargando(false)
  }

  async function publicar() {
    setError('')
    if (!mensaje.trim()) return
    setGuardando(true)
    const { error: errorDB } = await supabase.from('avisos').insert({ mensaje: mensaje.trim(), tipo })
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

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">Avisos</h2>
      <p className="text-sm text-itd-navyDark/60 mb-6">
        Los avisos "activos" se muestran arriba de la pantalla de login y del menú principal, para
        todos los docentes. Úsalos para cosas cortas y temporales (ej. "Mantenimiento el sábado de
        8 a 10 am" o "Ya está disponible la constancia de Agosto 2026").
      </p>

      <div className="rounded-xl border border-itd-navy/10 p-4 mb-6 space-y-3">
        <textarea
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Escribe el aviso…"
          rows={2}
          maxLength={200}
          className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          >
            {TIPOS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <button
            onClick={publicar}
            disabled={guardando || !mensaje.trim()}
            className="rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-50"
          >
            {guardando ? 'Publicando…' : '+ Publicar aviso'}
          </button>
          <span className="text-xs text-itd-navyDark/40 ml-auto">{mensaje.length}/200</span>
        </div>
        {mensaje.trim() && (
          <div
            className="rounded-xl px-4 py-3 text-sm font-medium text-center"
            style={ESTILOS_TIPO[tipo]}
          >
            {mensaje}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-itd-guinda mb-4">{error}</p>}

      {cargando ? (
        <p className="text-sm text-itd-navyDark/50 py-4">Cargando…</p>
      ) : avisos.length === 0 ? (
        <p className="text-sm text-itd-navyDark/50 py-4 text-center">No hay avisos todavía.</p>
      ) : (
        <div className="space-y-2">
          {avisos.map((a) => (
            <div key={a.id} className={`rounded-lg border border-itd-navy/10 px-4 py-3 ${!a.activo ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-itd-navyDark">{a.mensaje}</p>
                  <p className="text-xs text-itd-navyDark/40 mt-1">
                    {TIPOS.find((t) => t.id === a.tipo)?.label || a.tipo}
                    {!a.activo && ' · dado de baja'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => alternarActivo(a)}
                    className="text-xs rounded-lg border border-itd-navy/20 px-3 py-1.5 hover:bg-itd-sand"
                  >
                    {a.activo ? 'Dar de baja' : 'Dar de alta'}
                  </button>
                  <button
                    onClick={() => eliminar(a)}
                    className="text-xs text-itd-guinda hover:underline"
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
  )
}
