// src/components/EvaluacionInstructor.jsx
// Modal de "Criterios para seleccionar instructor (a)" (ITD-AD-FO-06)
// Se abre desde la tarjeta de Preregistro de Curso. Autocompleta instructor/curso
// a partir del preregistro ya capturado y guarda la evaluación en Supabase.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { descargarCriteriosInstructor } from '../lib/criteriosInstructor';
import AutocompleteInput from './AutocompleteInput';

const CRITERIOS_LIST = [
  'Formación profesional relacionada a la capacitación a impartir.',
  'Experiencia en capacitación y en la temática a impartir.',
  'Materiales didácticos a utilizar.',
  'Empresas diferentes en las que ha participado como instructor(a).',
  'Certificaciones y acreditaciones relacionadas al área de capacitación.',
];

const CARGOS_EVALUADOR = [
  'Jefe(a) de Departamento',
  'Subdirector(a) Académico',
  'Director(a) del Instituto Tecnológico de Durango',
  'Coordinador(a) de Actualización Docente',
];

const ITD_LABEL = 'Instituto Tecnológico de Durango';

function formInicial(preregistro, evaluacionExistente) {
  if (evaluacionExistente) {
    return {
      instructor_nombre: evaluacionExistente.instructor_nombre || '',
      fecha_evaluacion: evaluacionExistente.fecha_evaluacion || new Date().toISOString().split('T')[0],
      curso_nombre: evaluacionExistente.curso_nombre || '',
      empresa_plantel: evaluacionExistente.empresa_plantel || ITD_LABEL,
      criterio_1: evaluacionExistente.criterio_1 ?? null,
      criterio_2: evaluacionExistente.criterio_2 ?? null,
      criterio_3: evaluacionExistente.criterio_3 ?? null,
      criterio_4: evaluacionExistente.criterio_4 ?? null,
      criterio_5: evaluacionExistente.criterio_5 ?? null,
      aceptado: !!evaluacionExistente.aceptado,
      jefe_departamento: evaluacionExistente.jefe_departamento || '',
      cargo_evaluador: evaluacionExistente.cargo_evaluador || '',
    };
  }
  // Autocompletado a partir del preregistro ya capturado
  return {
    instructor_nombre: '',
    fecha_evaluacion: new Date().toISOString().split('T')[0],
    curso_nombre: preregistro?.curso || '',
    empresa_plantel: ITD_LABEL,
    criterio_1: null,
    criterio_2: null,
    criterio_3: null,
    criterio_4: null,
    criterio_5: null,
    aceptado: true,
    jefe_departamento: preregistro?.nombre_jefe || '',
    cargo_evaluador: preregistro?.jefatura_cargo || '',
  };
}

export default function EvaluacionInstructor({
  preregistro,
  docente,
  onCerrar,
  onEvaluacionGuardada,
  evaluacionExistente,
}) {
  const soloLectura = !!evaluacionExistente;

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [guardadoOk, setGuardadoOk] = useState(null); // null = no guardado aún; objeto = evaluación recién guardada
  const [form, setForm] = useState(() => formInicial(preregistro, evaluacionExistente));
  const [docentesSugeridos, setDocentesSugeridos] = useState([]);
  const [empresaEsOtra, setEmpresaEsOtra] = useState(() => {
    const inicial = formInicial(preregistro, evaluacionExistente).empresa_plantel;
    return !!inicial && inicial !== ITD_LABEL;
  });

  useEffect(() => {
    cargarDocentesSugeridos();
  }, []);

  async function cargarDocentesSugeridos() {
    const { data } = await supabase
      .from('docentes')
      .select('nombre_completo')
      .eq('activo', true)
      .order('nombre_completo');
    if (data) setDocentesSugeridos(data.map((d) => d.nombre_completo));
  }

  function handleChange(campo, valor) {
    if (soloLectura) return;
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function calcularTotal() {
    return [1, 2, 3, 4, 5].reduce((sum, i) => sum + (parseInt(form[`criterio_${i}`]) || 0), 0);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);

    try {
      const dataToSave = {
        preregistro_id: preregistro?.id || null,
        docente_id: docente.id,
        instructor_nombre: form.instructor_nombre.toUpperCase(),
        fecha_evaluacion: form.fecha_evaluacion,
        curso_nombre: form.curso_nombre.toUpperCase(),
        empresa_plantel: form.empresa_plantel.toUpperCase(),
        criterio_1: parseInt(form.criterio_1),
        criterio_2: parseInt(form.criterio_2),
        criterio_3: parseInt(form.criterio_3),
        criterio_4: parseInt(form.criterio_4),
        criterio_5: parseInt(form.criterio_5),
        puntuacion_total: calcularTotal(),
        aceptado: form.aceptado,
        jefe_departamento: form.jefe_departamento,
        cargo_evaluador: form.cargo_evaluador,
      };

      const { data: saved, error: dbError } = await supabase
        .from('evaluaciones_instructores')
        .upsert(dataToSave, { onConflict: 'preregistro_id' })
        .select()
        .single();

      if (dbError) throw dbError;

      setGuardadoOk(dataToSave);
      if (onEvaluacionGuardada) onEvaluacionGuardada(saved);
    } catch (err) {
      console.error('Error al guardar evaluación:', err);
      setError(err.message || 'No se pudo guardar la evaluación');
    } finally {
      setGuardando(false);
    }
  }

  async function handleDescargarExistente() {
    await descargarCriteriosInstructor(form);
  }

  // ===== Pantalla de éxito tras guardar: botón para descargar, no descarga sola =====
  if (guardadoOk) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center">
          <div className="text-4xl mb-2">✅</div>
          <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">
            ¡Evaluación Registrada!
          </h2>
          <p className="text-sm text-itd-navyDark/60 mb-6">
            Descarga el PDF, imprímelo, fírmalo y séllalo para que tenga validez oficial. Puedes
            volver a descargarlo cuando quieras desde esta misma tarjeta de Preregistro.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => descargarCriteriosInstructor(guardadoOk)}
              className="px-6 py-2.5 rounded-lg bg-itd-navy text-white font-semibold hover:bg-itd-navyDark"
            >
              📄 Descargar PDF de Criterios
            </button>
            <button onClick={onCerrar} className="px-6 py-2 rounded-lg border">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-1">
          <h2 className="font-display text-xl font-semibold text-itd-navy">
            Criterios para Seleccionar Instructor
          </h2>
          <button onClick={onCerrar} className="text-2xl leading-none">✕</button>
        </div>
        <p className="text-xs text-itd-navyDark/50 mb-4">
          {soloLectura
            ? 'Esta evaluación ya fue registrada. Puedes volver a descargar el PDF.'
            : 'Se autocompleta con los datos del curso propuesto en el preregistro.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">❌ {error}</div>
          )}

          {/* DATOS DEL INSTRUCTOR — el curso ya viene del Preregistro; el instructor se
              captura aquí porque puede ser un docente de la institución o alguien externo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Nombre del Instructor *</label>
              <AutocompleteInput
                value={form.instructor_nombre}
                onChange={(v) => handleChange('instructor_nombre', v)}
                sugerencias={docentesSugeridos}
                placeholder="Escribe el nombre; si es externo, captúralo completo"
                className="w-full rounded-lg border p-2 text-sm uppercase disabled:bg-gray-100"
                disabled={soloLectura}
                required
              />
              {!soloLectura && (
                <p className="text-xs text-itd-navyDark/40 mt-1">
                  Si aparece en la lista, selecciónalo; si no, escribe el nombre completo (instructor externo).
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium">Fecha de Evaluación *</label>
              <input
                type="date"
                value={form.fecha_evaluacion}
                onChange={(e) => handleChange('fecha_evaluacion', e.target.value)}
                className="w-full rounded-lg border p-2 text-sm disabled:bg-gray-100"
                disabled={soloLectura}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Curso a Impartir</label>
              <input
                type="text"
                value={form.curso_nombre}
                className="w-full rounded-lg border p-2 text-sm uppercase bg-gray-100"
                disabled
                title="Tomado del Preregistro de este curso"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Empresa o Plantel</label>
              {!soloLectura ? (
                <>
                  <div className="flex gap-4 mt-1 mb-1">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={!empresaEsOtra}
                        onChange={() => {
                          setEmpresaEsOtra(false);
                          handleChange('empresa_plantel', ITD_LABEL);
                        }}
                      />
                      {ITD_LABEL}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={empresaEsOtra}
                        onChange={() => {
                          setEmpresaEsOtra(true);
                          handleChange('empresa_plantel', '');
                        }}
                      />
                      Otra
                    </label>
                  </div>
                  {empresaEsOtra && (
                    <input
                      type="text"
                      value={form.empresa_plantel}
                      onChange={(e) => handleChange('empresa_plantel', e.target.value)}
                      placeholder="Nombre de la empresa o plantel"
                      className="w-full rounded-lg border p-2 text-sm uppercase"
                      required
                    />
                  )}
                </>
              ) : (
                <input
                  type="text"
                  value={form.empresa_plantel}
                  className="w-full rounded-lg border p-2 text-sm uppercase bg-gray-100"
                  disabled
                />
              )}
            </div>
          </div>

          {/* CRITERIOS */}
          <div>
            <h3 className="font-semibold text-itd-navy mb-2">Evaluación por Criterios</h3>
            <p className="text-xs text-itd-navyDark/50 mb-2">
              Escala: 1 Malo · 2 Regular · 3 Bien · 4 Muy bien · 5 Excelente
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-itd-navy text-white">
                    <th className="p-2 text-left">Criterio</th>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <th key={n} className="p-2 text-center w-12">{n}</th>
                    ))}
                    <th className="p-2 text-center w-12">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {CRITERIOS_LIST.map((label, idx) => {
                    const id = idx + 1;
                    return (
                      <tr key={id} className="border-b">
                        <td className="p-2 text-xs">{id}. {label}</td>
                        {[1, 2, 3, 4, 5].map((val) => (
                          <td key={val} className="p-1 text-center">
                            <input
                              type="radio"
                              name={`criterio_${id}`}
                              value={val}
                              checked={form[`criterio_${id}`] === val}
                              onChange={() => handleChange(`criterio_${id}`, val)}
                              className="w-4 h-4"
                              disabled={soloLectura}
                              required
                            />
                          </td>
                        ))}
                        <td className="p-2 text-center font-bold text-itd-navy">
                          {form[`criterio_${id}`] || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-bold">
                    <td className="p-2">TOTAL GENERAL</td>
                    <td colSpan="5"></td>
                    <td className="p-2 text-center text-itd-guinda text-lg">{calcularTotal()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* RESULTADO */}
          <div>
            <label className="block text-sm font-medium">¿Instructor Aceptado?</label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="aceptado"
                  checked={form.aceptado === true}
                  onChange={() => handleChange('aceptado', true)}
                  disabled={soloLectura}
                />
                <span className="text-green-700">Sí</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="aceptado"
                  checked={form.aceptado === false}
                  onChange={() => handleChange('aceptado', false)}
                  disabled={soloLectura}
                />
                <span className="text-red-700">No</span>
              </label>
            </div>
          </div>

          {/* EVALUADOR */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Jefe(a) de Departamento que Evalúa *</label>
              <AutocompleteInput
                value={form.jefe_departamento}
                onChange={(v) => handleChange('jefe_departamento', v)}
                sugerencias={docentesSugeridos}
                className="w-full rounded-lg border p-2 text-sm uppercase disabled:bg-gray-100"
                disabled={soloLectura}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Cargo del Evaluador *</label>
              <select
                value={form.cargo_evaluador}
                onChange={(e) => handleChange('cargo_evaluador', e.target.value)}
                className="w-full rounded-lg border p-2 text-sm disabled:bg-gray-100"
                disabled={soloLectura}
                required
              >
                <option value="">Seleccione Cargo</option>
                {CARGOS_EVALUADOR.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {!soloLectura && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-3 text-sm text-amber-800">
              ⚠️ Este documento se generará en PDF para su descarga. Recuerda imprimir y entregar
              firmado en Coordinación de Actualización Docente para que tenga validez.
            </div>
          )}

          {/* BOTONES */}
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onCerrar} className="px-6 py-2 rounded-lg border">
              Cerrar
            </button>
            {soloLectura ? (
              <button
                type="button"
                onClick={handleDescargarExistente}
                className="flex-1 px-6 py-2 rounded-lg bg-itd-navy text-white font-semibold"
              >
                📄 Descargar PDF de nuevo
              </button>
            ) : (
              <button
                type="submit"
                disabled={guardando}
                className="flex-1 px-6 py-2 rounded-lg bg-itd-navy text-white font-semibold disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : '📄 Generar Evaluación'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
