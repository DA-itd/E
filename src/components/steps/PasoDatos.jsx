import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { leerTexto, leerEnCuantoSePueda } from '../../lib/voz'
import BotonEscuchar from '../BotonEscuchar'
import BotonDictar from '../BotonDictar'

const NIVELES = ['Licenciatura', 'Maestría', 'Doctorado', 'Especialidad']

const MENSAJE_BIENVENIDA =
  '¡Hola! Por favor verifica que tu información sea correcta antes de continuar. ' +
  'Puedes dictar la información presionando el ícono de micrófono junto a los campos.'

function validarCurp(v) {
  return /^[A-Z0-9]{18}$/.test(v.trim().toUpperCase())
}

export default function PasoDatos({ docente, onSiguiente }) {
  const [nombre, setNombre] = useState(docente.nombre_completo || '')
  const [curp, setCurp] = useState(docente.curp || '')
  const [departamento, setDepartamento] = useState(docente.departamento || '')
  const [genero, setGenero] = useState(docente.genero || '')
  const [telefono, setTelefono] = useState(docente.telefono || '')
  const [niveles, setNiveles] = useState(
    docente.nivel ? docente.nivel.split(',').map((n) => n.trim()).filter(Boolean) : []
  )
  const [departamentos, setDepartamentos] = useState([])
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarDepartamentos()
    leerEnCuantoSePueda(MENSAJE_BIENVENIDA)
  }, [])

  async function cargarDepartamentos() {
    const { data } = await supabase
      .from('docentes')
      .select('departamento')
      .not('departamento', 'is', null)
    const unicos = [...new Set((data || []).map((d) => d.departamento).filter(Boolean))].sort()
    setDepartamentos(unicos)
  }

  function toggleNivel(n) {
    setNiveles((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n)
      if (prev.length >= 2) return prev
      return [...prev, n]
    })
  }

  async function continuar() {
    setError('')
    if (!nombre.trim()) return setError('Falta tu nombre completo.')
    if (!validarCurp(curp)) return setError('El CURP debe tener 18 caracteres (letras y números).')
    if (!departamento) return setError('Selecciona tu departamento.')
    if (!genero) return setError('Selecciona tu género.')
    if (niveles.length === 0) return setError('Selecciona al menos un nivel académico.')

    setGuardando(true)
    const { data, error: errorDB } = await supabase
      .from('docentes')
      .update({
        nombre_completo: nombre.trim(),
        curp: curp.trim().toUpperCase(),
        departamento,
        genero,
        telefono: telefono.trim() || null,
        nivel: niveles.join(', '),
      })
      .eq('id', docente.id)
      .select()
      .single()
    setGuardando(false)

    if (errorDB) {
      if (errorDB.code === '23505') {
        setError('Ese CURP ya está registrado con otra cuenta. Verifica que esté bien escrito.')
      } else {
        setError('No se pudo guardar tu información. Intenta de nuevo.')
      }
      return
    }

    onSiguiente(data)
  }

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="font-display text-xl font-semibold text-itd-navy">Datos Personales</h2>
        <BotonEscuchar texto={MENSAJE_BIENVENIDA} />
      </div>
      <p className="text-sm text-itd-navyDark/60 mb-6">
        Verifica que tu información sea correcta antes de continuar.
      </p>

      <div className="mb-6 rounded-lg bg-itd-gold/10 border border-itd-gold/30 px-4 py-3 text-sm text-itd-navyDark/80 flex items-start gap-2">
        <span className="text-lg leading-none">👋</span>
        <span>
          ¡Hola! Por favor verifica que tu información sea correcta antes de continuar. Puedes
          dictar la información presionando el ícono de micrófono junto a los campos.
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-1 mb-1">
            <label className="text-sm font-medium text-itd-navyDark/80">Nombre Completo *</label>
            <BotonEscuchar texto="Nombre completo" />
          </div>
          <div className="flex items-center gap-2">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="flex-1 rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
            />
            <BotonDictar onTexto={(t) => setNombre(t.toUpperCase())} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-sm font-medium text-itd-navyDark/80">CURP *</label>
              <BotonEscuchar texto="CURP" />
            </div>
            <div className="flex items-center gap-2">
              <input
                value={curp}
                onChange={(e) => setCurp(e.target.value.toUpperCase())}
                maxLength={18}
                placeholder="Ej. XXXX000000XXXXXX00"
                className="flex-1 rounded-lg border border-itd-navy/20 px-3 py-2 text-sm font-mono uppercase"
              />
              <BotonDictar onTexto={(t) => setCurp(t.replace(/\s+/g, '').toUpperCase())} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-sm font-medium text-itd-navyDark/80">Email (Autenticado) *</label>
              <BotonEscuchar texto="Email autenticado" />
            </div>
            <input
              value={docente.email}
              disabled
              className="w-full rounded-lg border border-itd-navy/10 bg-gray-50 px-3 py-2 text-sm text-itd-navyDark/50"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-sm font-medium text-itd-navyDark/80">Departamento *</label>
              <BotonEscuchar texto="Departamento" />
            </div>
            <select
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value)}
              className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm bg-white"
            >
              <option value="">-- Seleccione --</option>
              {departamentos.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <label className="text-sm font-medium text-itd-navyDark/80">Género *</label>
              <BotonEscuchar texto="Género" />
            </div>
            <select
              value={genero}
              onChange={(e) => setGenero(e.target.value)}
              className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm bg-white"
            >
              <option value="">-- Seleccione --</option>
              <option value="Hombre">Hombre</option>
              <option value="Mujer">Mujer</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1 mb-1">
            <label className="text-sm font-medium text-itd-navyDark/80">Teléfono (WhatsApp)</label>
            <BotonEscuchar texto="Teléfono, WhatsApp" />
          </div>
          <div className="flex items-center gap-2">
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="10 dígitos"
              className="flex-1 rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
            />
            <BotonDictar onTexto={(t) => setTelefono(t.replace(/\D/g, ''))} />
          </div>
          <p className="text-xs text-itd-navyDark/50 mt-1">
            Se usará para enviar avisos de inscripciones o constancias.
          </p>
        </div>

        <div>
          <div className="flex items-center gap-1 mb-2">
            <label className="text-sm font-medium text-itd-navyDark/80">
              Nivel Académico (Máx. 2) *
            </label>
            <BotonEscuchar texto="Nivel académico, máximo 2" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {NIVELES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => toggleNivel(n)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  niveles.includes(n)
                    ? 'border-itd-navy bg-itd-navy/5 text-itd-navy'
                    : 'border-itd-navy/15 text-itd-navyDark/70 hover:bg-itd-sand'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-itd-guinda bg-itd-guinda/5 border border-itd-guinda/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-end mt-6">
        <button
          onClick={continuar}
          disabled={guardando}
          className="rounded-lg bg-itd-navy text-white px-6 py-2.5 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Siguiente →'}
        </button>
      </div>
    </div>
  )
}
