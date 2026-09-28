// src/components/ValidarConstancia.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatearRangoFechas } from '../lib/formatoFechas'

export default function ValidarConstancia({ folio, tipo }) {
  const [resultado, setResultado] = useState(undefined) // undefined = cargando

  useEffect(() => {
    async function verificar() {
      const valor = (folio || '').trim().toUpperCase()
      if (!valor) {
        setResultado({ valido: false })
        return
      }

      const PREFIJO = 'TNM-054-'
      const folioCompleto = valor.startsWith('TNM-054-') ? valor : PREFIJO + valor

      // 1. Probar Edge Function si está activa
      try {
        const { data: edgeData } = await supabase.functions.invoke('validar-constancia', {
          body: { folio: valor, tipo },
        })
        if (edgeData && edgeData.valido) {
          setResultado(edgeData)
          return
        }
      } catch {
        // Continuar con RPC y consultas directas
      }

      // 2. Probar RPC validar_constancia
      try {
        let { data } = await supabase.rpc('validar_constancia', { p_folio: folioCompleto })
        if (!data || data.length === 0) {
          const respDirecto = await supabase.rpc('validar_constancia', { p_folio: valor })
          if (respDirecto.data && respDirecto.data.length > 0) {
            data = respDirecto.data
          }
        }

        if (data && data.length > 0) {
          const r = data[0]
          setResultado({
            valido: true,
            folio: r.folio || folioCompleto,
            nombre: r.nombre || '',
            curso: r.curso || '',
            fechaTexto: r.fecha_texto || '',
            tipo: r.tipo || tipo || 'Constancia',
            departamento: r.departamento || '',
            horas: r.horas || '',
          })
          return
        }
      } catch {
        // Continuar con consulta a tablas
      }

      // 3. Probar tabla inscripciones
      try {
        const { data: ins } = await supabase
          .from('inscripciones')
          .select('folio_personal, cursos(nombre, fecha_inicio, fecha_fin, horas, tipo, departamento), docentes(nombre_completo, departamento)')
          .or(`folio_personal.eq.${valor},folio_personal.eq.${folioCompleto}`)
          .maybeSingle()

        if (ins && ins.cursos) {
          setResultado({
            valido: true,
            folio: ins.folio_personal || folioCompleto,
            nombre: ins.docentes?.nombre_completo || '',
            curso: ins.cursos.nombre || '',
            fechaInicio: ins.cursos.fecha_inicio,
            fechaFin: ins.cursos.fecha_fin,
            tipo: ins.cursos.tipo || tipo || 'Constancia',
            departamento: ins.cursos.departamento || ins.docentes?.departamento || '',
            horas: ins.cursos.horas || '',
          })
          return
        }
      } catch {
        // Continuar con historial
      }

      // 4. Probar tabla inscripciones_historial
      try {
        const { data: hist } = await supabase
          .from('inscripciones_historial')
          .select('folio_personal, nombre_completo, curso')
          .or(`folio_personal.eq.${valor},folio_personal.eq.${folioCompleto}`)
          .maybeSingle()

        if (hist) {
          setResultado({
            valido: true,
            folio: hist.folio_personal || folioCompleto,
            nombre: hist.nombre_completo || '',
            curso: hist.curso || '',
            tipo: tipo || 'Constancia',
          })
          return
        }
      } catch {
        // No se encontró
      }

      setResultado({ valido: false })
    }

    verificar()
  }, [folio, tipo])

  function volverAlInicio() {
    window.location.href = window.location.origin + window.location.pathname
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-itd-sand">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-itd-navy/10 p-8 text-center">
        <button
          onClick={volverAlInicio}
          className="text-xs text-itd-navy font-semibold hover:underline mb-4 inline-flex items-center gap-1 cursor-pointer"
        >
          ← Volver al inicio
        </button>

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
                {resultado.fechaInicio && resultado.fechaFin
                  ? formatearRangoFechas(resultado.fechaInicio, resultado.fechaFin)
                  : (resultado.fechaTexto || '')}
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
