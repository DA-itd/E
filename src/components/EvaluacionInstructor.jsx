// src/components/EvaluacionInstructor.jsx
// VERSIÓN SIMPLIFICADA - SIGUE LA ESTRUCTURA DE PreregistroCurso

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { descargarCriteriosInstructor } from '../lib/criteriosInstructor';

export default function EvaluacionInstructor({ 
  preregistro,  // Datos del preregistro (curso, docente, etc.)
  docente,      // Datos del docente logueado
  onClose,      // Función para cerrar el modal
  onSuccess     // Función al guardar exitosamente
}) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);
  
  // Estado del formulario - IGUAL que en PreregistroCurso
  const [form, setForm] = useState({
    instructor_nombre: preregistro?.docentes?.nombre_completo || '',
    fecha_evaluacion: new Date().toISOString().split('T')[0],
    curso_nombre: preregistro?.curso || '',
    empresa_plantel: 'ITD',
    criterio_1: null,
    criterio_2: null,
    criterio_3: null,
    criterio_4: null,
    criterio_5: null,
    aceptado: false,
    jefe_departamento: '',
    cargo_evaluador: ''
  });

  // Cargar lista de jefes desde Supabase
  const [jefes, setJefes] = useState([]);
  const [cargos, setCargos] = useState([]);

  useEffect(() => {
    cargarCatalogos();
  }, []);

  async function cargarCatalogos() {
    // Cargar docentes para autocompletar
    const { data } = await supabase
      .from('docentes')
      .select('nombre_completo')
      .eq('activo', true)
      .order('nombre_completo');
    
    if (data) {
      setJefes(data.map(d => d.nombre_completo));
    }

    // Cargar cargos predefinidos
    setCargos([
      'Jefe(a) de Departamento',
      'Subdirector(a) Académico',
      'Director(a) del Instituto Tecnológico de Durango',
      'Coordinador(a) de Actualización Docente'
    ]);
  }

  function handleChange(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }));
  }

  function calcularTotal() {
    const total = [1,2,3,4,5].reduce((sum, i) => {
      return sum + (parseInt(form[`criterio_${i}`]) || 0);
    }, 0);
    return total;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setGuardando(true);

    try {
      // ===== 1. Guardar en Supabase (IGUAL que preregistro) =====
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
        cargo_evaluador: form.cargo_evaluador
      };

      const { error: dbError } = await supabase
        .from('evaluaciones_instructores')
        .insert(dataToSave);

      if (dbError) throw dbError;

      // ===== 2. Generar PDF (IGUAL que preregistro) =====
      await descargarCriteriosInstructor(form, null);

      setExito(true);
      if (onSuccess) onSuccess();
      
      // Cerrar después de 2 segundos
      setTimeout(onClose, 2000);

    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'No se pudo guardar la evaluación');
    } finally {
      setGuardando(false);
    }
  }

  // Renderizado SIMPLIFICADO
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display text-xl font-semibold text-itd-navy">
            Evaluación de Instructor
          </h2>
          <button onClick={onClose} className="text-2xl">✕</button>
        </div>

        {exito ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">✅</div>
            <p className="text-lg font-semibold text-green-700">¡Evaluación guardada!</p>
            <p className="text-sm text-gray-500">El PDF se descargará automáticamente.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                ❌ {error}
              </div>
            )}

            {/* DATOS DEL INSTRUCTOR */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Nombre del Instructor *</label>
                <input
                  type="text"
                  value={form.instructor_nombre}
                  onChange={(e) => handleChange('instructor_nombre', e.target.value)}
                  className="w-full rounded-lg border p-2 text-sm uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Fecha de Evaluación *</label>
                <input
                  type="date"
                  value={form.fecha_evaluacion}
                  onChange={(e) => handleChange('fecha_evaluacion', e.target.value)}
                  className="w-full rounded-lg border p-2 text-sm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Curso a Impartir *</label>
                <input
                  type="text"
                  value={form.curso_nombre}
                  onChange={(e) => handleChange('curso_nombre', e.target.value)}
                  className="w-full rounded-lg border p-2 text-sm uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Empresa o Plantel</label>
                <input
                  type="text"
                  value={form.empresa_plantel}
                  onChange={(e) => handleChange('empresa_plantel', e.target.value)}
                  className="w-full rounded-lg border p-2 text-sm uppercase"
                />
              </div>
            </div>

            {/* CRITERIOS */}
            <div>
              <h3 className="font-semibold text-itd-navy mb-2">Evaluación por Criterios</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-itd-navy text-white">
                      <th className="p-2 text-left">Criterio</th>
                      {[1,2,3,4,5].map(n => (
                        <th key={n} className="p-2 text-center w-12">{n}</th>
                      ))}
                      <th className="p-2 text-center w-12">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      'Formación profesional relacionada a la capacitación',
                      'Experiencia en capacitación y en la temática',
                      'Materiales didácticos a utilizar',
                      'Empresas diferentes como instructor(a)',
                      'Certificaciones y acreditaciones'
                    ].map((label, idx) => {
                      const id = idx + 1;
                      return (
                        <tr key={id} className="border-b">
                          <td className="p-2 text-xs">{id}. {label}</td>
                          {[1,2,3,4,5].map(val => (
                            <td key={val} className="p-1 text-center">
                              <input
                                type="radio"
                                name={`criterio_${id}`}
                                value={val}
                                checked={form[`criterio_${id}`] === val}
                                onChange={(e) => handleChange(`criterio_${id}`, parseInt(e.target.value))}
                                className="w-4 h-4"
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
                      <td className="p-2 text-center text-itd-guinda text-lg">
                        {calcularTotal()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* RESULTADO Y EVALUADOR */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">¿Instructor Aceptado?</label>
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="aceptado"
                      value="true"
                      checked={form.aceptado === true}
                      onChange={() => handleChange('aceptado', true)}
                    />
                    <span className="text-green-700">Sí</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="aceptado"
                      value="false"
                      checked={form.aceptado === false}
                      onChange={() => handleChange('aceptado', false)}
                    />
                    <span className="text-red-700">No</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Jefe(a) de Departamento *</label>
                <select
                  value={form.jefe_departamento}
                  onChange={(e) => handleChange('jefe_departamento', e.target.value)}
                  className="w-full rounded-lg border p-2 text-sm"
                  required
                >
                  <option value="">Seleccione Jefe(a)</option>
                  {jefes.map(j => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Cargo del Evaluador *</label>
                <select
                  value={form.cargo_evaluador}
                  onChange={(e) => handleChange('cargo_evaluador', e.target.value)}
                  className="w-full rounded-lg border p-2 text-sm"
                  required
                >
                  <option value="">Seleccione Cargo</option>
                  {cargos.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* NOTA */}
            <div className="bg-amber-50 border-l-4 border-amber-500 p-3 text-sm text-amber-800">
              ⚠️ Este documento se generará en PDF para su descarga.
              Recuerda imprimir y entregar firmado en Coordinación de Actualización Docente.
            </div>

            {/* BOTONES */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 rounded-lg border"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="flex-1 px-6 py-2 rounded-lg bg-itd-navy text-white font-semibold disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : '📄 Generar Evaluación'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}