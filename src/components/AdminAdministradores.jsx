import { useEffect, useState } from 'react'
import { supabase, DOMINIO_PERMITIDO } from '../lib/supabaseClient'
import { PESTANAS_ADMIN } from '../lib/permisosAdmin'

export default function AdminAdministradores() {
  const [admins, setAdmins] = useState([])
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevosPermisos, setNuevosPermisos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('administradores')
      .select('email, es_superadmin, permisos')
      .order('email')
    setAdmins(data || [])
    setCargando(false)
  }

  function toggleNuevoPermiso(id) {
    setNuevosPermisos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function agregar() {
    setError('')
    const email = nuevoEmail.trim().toLowerCase()
    if (!email.endsWith('@' + DOMINIO_PERMITIDO)) {
      setError(`El correo debe terminar en @${DOMINIO_PERMITIDO}`)
      return
    }
    setGuardando(true)
    const { error: errorDB } = await supabase
      .from('administradores')
      .insert({ email, permisos: nuevosPermisos, es_superadmin: false })
    setGuardando(false)

    if (errorDB) {
      setError(errorDB.code === '23505' ? 'Ese correo ya es administrador.' : 'No se pudo agregar. Intenta de nuevo.')
      return
    }
    setNuevoEmail('')
    setNuevosPermisos([])
    cargar()
  }

  async function quitar(email) {
    if (!confirm(`¿Quitar a ${email} como administrador?`)) return
    const { error: errorDB } = await supabase.from('administradores').delete().eq('email', email)
    if (errorDB) {
      alert('No se pudo quitar: ' + errorDB.message)
      return
    }
    cargar()
  }

  async function actualizarPermisos(email, permisos) {
    const { error: errorDB } = await supabase.from('administradores').update({ permisos }).eq('email', email)
    if (errorDB) {
      alert('No se pudieron actualizar los permisos: ' + errorDB.message)
      return
    }
    cargar()
  }

  function togglePermisoExistente(admin, id) {
    const actual = admin.permisos || []
    const nuevo = actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id]
    actualizarPermisos(admin.email, nuevo)
  }

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">Administradores</h2>
      <p className="text-sm text-itd-navyDark/60 mb-6">
        Solo el súper administrador puede dar de alta, quitar administradores o cambiar sus permisos.
        Cada administrador normal solo ve las pestañas que le actives aquí.
      </p>

      <div className="rounded-xl border border-itd-navy/10 p-4 mb-6">
        <p className="text-sm font-medium text-itd-navyDark mb-2">Nuevo administrador</p>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
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
        <p className="text-xs text-itd-navyDark/50 mb-2">Pestañas a las que tendrá acceso:</p>
        <div className="flex flex-wrap gap-3">
          {PESTANAS_ADMIN.map((p) => (
            <label key={p.id} className="flex items-center gap-1.5 text-sm text-itd-navyDark/80 cursor-pointer">
              <input
                type="checkbox"
                checked={nuevosPermisos.includes(p.id)}
                onChange={() => toggleNuevoPermiso(p.id)}
                className="h-4 w-4 accent-itd-navy"
              />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-itd-guinda mb-4">{error}</p>}

      {cargando ? (
        <p className="text-sm text-itd-navyDark/50 py-4">Cargando…</p>
      ) : (
        <div className="space-y-3">
          {admins.map((a) => (
            <div key={a.email} className="rounded-lg border border-itd-navy/10 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-itd-navyDark">{a.email}</span>
                {a.es_superadmin ? (
                  <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    Súper administrador
                  </span>
                ) : (
                  <button onClick={() => quitar(a.email)} className="text-xs text-itd-guinda hover:underline">
                    Quitar
                  </button>
                )}
              </div>
              {a.es_superadmin ? (
                <p className="text-xs text-itd-navyDark/40">Acceso total a todas las pestañas, incluyendo esta.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {PESTANAS_ADMIN.map((p) => (
                    <label key={p.id} className="flex items-center gap-1.5 text-xs text-itd-navyDark/70 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(a.permisos || []).includes(p.id)}
                        onChange={() => togglePermisoExistente(a, p.id)}
                        className="h-3.5 w-3.5 accent-itd-navy"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
