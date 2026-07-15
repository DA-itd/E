import { useEffect, useState } from 'react'
import { supabase, DOMINIO_PERMITIDO } from '../lib/supabaseClient'

export default function AdminAdministradores() {
  const [admins, setAdmins] = useState([])
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('administradores').select('email').order('email')
    setAdmins(data || [])
    setCargando(false)
  }

  async function agregar() {
    setError('')
    const email = nuevoEmail.trim().toLowerCase()
    if (!email.endsWith('@' + DOMINIO_PERMITIDO)) {
      setError(`El correo debe terminar en @${DOMINIO_PERMITIDO}`)
      return
    }
    setGuardando(true)
    const { error: errorDB } = await supabase.from('administradores').insert({ email })
    setGuardando(false)

    if (errorDB) {
      setError(errorDB.code === '23505' ? 'Ese correo ya es administrador.' : 'No se pudo agregar. Intenta de nuevo.')
      return
    }
    setNuevoEmail('')
    cargar()
  }

  async function quitar(email) {
    if (!confirm(`¿Quitar a ${email} como administrador?`)) return
    await supabase.from('administradores').delete().eq('email', email)
    cargar()
  }

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">Administradores</h2>
      <p className="text-sm text-itd-navyDark/60 mb-6">
        Quien esté en esta lista puede entrar a la sección de Administración (tomar asistencia, etc.).
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <input
          value={nuevoEmail}
          onChange={(e) => setNuevoEmail(e.target.value)}
          placeholder="correo@itdurango.edu.mx"
          className="flex-1 rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
        />
        <button
          onClick={agregar}
          disabled={guardando || !nuevoEmail.trim()}
          className="rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-50"
        >
          {guardando ? 'Agregando…' : '+ Agregar'}
        </button>
      </div>
      {error && <p className="text-xs text-itd-guinda mb-4">{error}</p>}

      {cargando ? (
        <p className="text-sm text-itd-navyDark/50 py-4">Cargando…</p>
      ) : (
        <div className="space-y-2 mt-4">
          {admins.map((a) => (
            <div
              key={a.email}
              className="flex items-center justify-between rounded-lg border border-itd-navy/10 px-4 py-2"
            >
              <span className="text-sm text-itd-navyDark">{a.email}</span>
              <button
                onClick={() => quitar(a.email)}
                className="text-xs text-itd-guinda hover:underline"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
