import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatearRangoFechas } from '../lib/formatoFechas'

// Página PÚBLICA (no requiere iniciar sesión) que se abre al escanear el
// QR de una constancia o reconocimiento, para confirmar que es auténtica.
export default function ValidarConstancia({ folio, tipo }) {
  const [resultado, setResultado] = useState(undefined) // undefined = cargando

  useEffect(() => {
    supabase.functions
      .invoke('validar-constancia', { body: { folio, tipo } })
      .then(({ data }) => setResultado(data || { valido: false }))
      .catch(() => setResultado({ valido: false }))
  }, [folio, tipo])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-itd-sand">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-itd-navy/10 p-8 text-center">
        <h1 className="font-display text-lg font-semibold text-itd-navy mb-1">
          Validación de Documento
        </h1>
        <p className="text-xs text-itd-navyDark/50 mb-6">Instituto Tecnológico de Durango</p>

        {resultado === undefined && <p className="text-itd-navyDark/60 py-6">Verificando…</p>}

        {resultado?.valido && (
          <div className="space-y-3">
            <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-2xl text-green-600">
              ✓
            </div>
            <p className="font-semibold text-green-700">Documento válido</p>
            <div className="text-left bg-itd-sand/60 rounded-xl p-4 text-sm space-y-1 mt-4">
              <p><span className="text-itd-navyDark/50">Tipo:</span> {resultado.tipo}</p>
              <p><span className="text-itd-navyDark/50">Nombre:</span> {resultado.nombre}</p>
              <p><span className="text-itd-navyDark/50">Curso:</span> {resultado.curso}</p>
              <p>
                <span className="text-itd-navyDark/50">Fechas:</span>{' '}
                {formatearRangoFechas(resultado.fechaInicio, resultado.fechaFin)}
              </p>
              <p><span className="text-itd-navyDark/50">Folio:</span> {resultado.folio}</p>
            </div>
          </div>
        )}

        {resultado && !resultado.valido && (
          <div className="space-y-3">
            <div className="mx-auto w-14 h-14 rounded-full bg-red-100 flex items-center justify-center text-2xl text-red-600">
              ✕
            </div>
            <p className="font-semibold text-red-700">
              No se encontró un documento válido con este folio
            </p>
            <p className="text-sm text-itd-navyDark/60">
              Si crees que esto es un error, contacta a la Coordinación de Actualización Docente.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
