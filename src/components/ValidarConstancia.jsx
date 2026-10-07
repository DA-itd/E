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
      const folioSinPrefijo = valor.replace(/^TNM-054-/, '')

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
            tipo: r.tipo || (tipo === 'reconocimiento' ? 'Reconocimiento' : 'Constancia'),
            departamento: r.departamento || '',
            horas: r.horas || '',
          })
          return
        }
      } catch {
        // Continuar con consulta a tablas
      }

      // 3. Probar tabla inscripciones (Participantes activos)
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
            tipo: ins.cursos.tipo || (tipo === 'reconocimiento' ? 'Reconocimiento' : 'Constancia'),
            departamento: ins.cursos.departamento || ins.docentes?.departamento || '',
            horas: ins.cursos.horas || '',
          })
          return
        }
      } catch {
        // Continuar con historial
      }

      // 4. Probar tabla inscripciones_historial (Constancias históricas 2024, 2025, etc.)
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
            tipo: tipo === 'reconocimiento' ? 'Reconocimiento' : 'Constancia',
          })
          return
        }
      } catch {
        // Continuar con tabla de cursos para instructores
      }

      // 5. Probar tabla cursos (para Reconocimientos oficiales de Instructores)
      try {
        const { data: curso } = await supabase
          .from('cursos')
          .select('id, folio, nombre, instructor, fecha_inicio, fecha_fin, horas, departamento, tipo')
          .or(`folio.eq.${valor},folio.eq.${folioCompleto},folio.eq.${folioSinPrefijo}`)
          .maybeSingle()

        if (curso && curso.instructor) {
          setResultado({
            valido: true,
            folio: curso.folio || folioCompleto,
            nombre: curso.instructor,
            curso: curso.nombre,
            fechaInicio: curso.fecha_inicio,
            fechaFin: curso.fecha_fin,
            tipo: 'Reconocimiento (Instructor)',
            departamento: curso.departamento || '',
            horas: curso.horas || '',
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-100 py-10">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 text-center">
        <button
          onClick={volverAlInicio}
          className="text-xs text-[#1B396A] font-semibold hover:underline mb-4 inline-flex items-center gap-1 cursor-pointer"
        >
          ← Volver al inicio
        </button>

        <h1 className="text-xl font-bold text-[#1B396A] mb-1">
          Validación Oficial de Documento
        </h1>
        <p className="text-xs text-slate-500 mb-6">Instituto Tecnológico de Durango</p>

        {resultado === undefined && (
          <div className="py-8">
            <div className="w-10 h-10 border-4 border-[#1B396A] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-600 text-sm">Verificando autenticidad en la base de datos oficial…</p>
          </div>
        )}

        {resultado?.valido && (
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl text-green-600 shadow-inner">
              ✓
            </div>
            <div>
              <p className="text-lg font-bold text-green-700">Documento Válido y Auténtico</p>
              <p className="text-xs text-slate-500">Registrado en la Coordinación de Actualización Docente</p>
            </div>

            <div className="text-left bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm space-y-2 mt-4">
              <p><span className="text-slate-400 font-medium text-xs uppercase block">Tipo de Documento</span> <strong className="text-slate-800">{resultado.tipo || 'Constancia'}</strong></p>
              <p><span className="text-slate-400 font-medium text-xs uppercase block">Acreditado / Titular</span> <strong className="text-slate-900">{resultado.nombre}</strong></p>
              <p><span className="text-slate-400 font-medium text-xs uppercase block">Curso - Taller</span> <span className="text-slate-800 font-medium">{resultado.curso}</span></p>
              {(resultado.fechaInicio || resultado.fechaTexto) && (
                <p>
                  <span className="text-slate-400 font-medium text-xs uppercase block">Periodo / Fechas</span>{' '}
                  <span className="text-slate-700">
                    {resultado.fechaInicio && resultado.fechaFin
                      ? formatearRangoFechas(resultado.fechaInicio, resultado.fechaFin)
                      : (resultado.fechaTexto || '')}
                  </span>
                </p>
              )}
              {resultado.horas && (
                <p><span className="text-slate-400 font-medium text-xs uppercase block">Duración</span> <span className="text-slate-700">{resultado.horas} horas</span></p>
              )}
              <p className="pt-2 border-t border-slate-200"><span className="text-slate-400 font-medium text-xs uppercase block">Folio Oficial</span> <span className="font-mono text-xs font-bold text-[#1B396A] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block">{resultado.folio}</span></p>
            </div>
          </div>
        )}

        {resultado && !resultado.valido && (
          <div className="space-y-3">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-3xl text-red-600 shadow-inner">
              ✕
            </div>
            <p className="font-bold text-lg text-red-700">
              No se encontró un documento válido
            </p>
            <p className="text-sm text-slate-600">
              El folio consultado <strong className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">"{folio}"</strong> no existe o no cuenta con registro activo.
            </p>
            <p className="text-xs text-slate-400 pt-2">
              Si consideras que esto es un error, favor de contactar a la Coordinación de Actualización Docente del ITD.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
