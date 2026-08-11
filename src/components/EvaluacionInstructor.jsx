// src/components/EvaluacionInstructor.jsx
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { generarPDFCriterios } from '../lib/criteriosInstructor';

const CRITERIOS = [
  { id: 1, label: 'Formación profesional relacionada a la capacitación a impartir.' },
  { id: 2, label: 'Experiencia en capacitación y en la temática a impartir.' },
  { id: 3, label: 'Materiales didácticos a utilizar.' },
  { id: 4, label: 'Empresas diferentes en las que ha participado como instructor(a).' },
  { id: 5, label: 'Certificaciones y acreditaciones relacionadas al área de capacitación.' }
];

const ESCALA = [
  { value: 1, label: 'Malo' },
  { value: 2, label: 'Regular' },
  { value: 3, label: 'Bien' },
  { value: 4, label: 'Muy bien' },
  { value: 5, label: 'Excelente' }
];

// ========== NUEVO: Componente de Autocompletado ==========
function AutocompleteInput({ 
  value, 
  onChange, 
  onSelect,
  options, 
  placeholder = 'Buscar...',
  label,
  required = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [filteredOptions, setFilteredOptions] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Filtrar opciones cuando cambia el término de búsqueda
  useEffect(() => {
    if (searchTerm.trim().length > 0) {
      const filtered = options.filter(opt => 
        opt.toLowerCase().includes(searchTerm.toLowerCase().trim())
      );
      setFilteredOptions(filtered.slice(0, 15)); // Limitar a 15 resultados
    } else {
      setFilteredOptions([]);
    }
    setHighlightedIndex(-1);
  }, [searchTerm, options]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    onChange(val);
    setIsOpen(true);
    
    // Si el usuario borra todo, limpiar selección
    if (val.trim() === '') {
      onSelect('');
    }
  };

  const handleSelectOption = (option) => {
    setSearchTerm(option);
    onChange(option);
    onSelect(option);
    setIsOpen(false);
    setFilteredOptions([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < filteredOptions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelectOption(filteredOptions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      {label && (
        <label className="block text-sm font-medium text-itd-navyDark/70 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={() => searchTerm.trim().length > 0 && setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm focus:outline-none focus:border-itd-navy focus:ring-2 focus:ring-itd-navy/20"
        required={required}
        autoComplete="off"
      />
      
      {/* Dropdown de sugerencias */}
      {isOpen && filteredOptions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-itd-navy/20 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredOptions.map((option, index) => (
            <li
              key={option}
              onClick={() => handleSelectOption(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                index === highlightedIndex
                  ? 'bg-itd-navy/10 text-itd-navy'
                  : 'hover:bg-itd-sand/50'
              }`}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
      
      {/* Mensaje cuando no hay resultados */}
      {isOpen && searchTerm.trim().length > 0 && filteredOptions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-itd-navy/20 rounded-lg shadow-lg p-3 text-sm text-itd-navyDark/50">
          No se encontraron resultados para "{searchTerm}"
        </div>
      )}
    </div>
  );
}

export default function EvaluacionInstructor({ 
  preregistro, 
  docente, 
  onCerrar,
  onEvaluacionGuardada,
  evaluacionExistente = null
}) {
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [jefesDepartamento, setJefesDepartamento] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [evaluacion, setEvaluacion] = useState({
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

  // ========== NUEVO: Si viene una evaluación existente, cargarla ==========
  useEffect(() => {
    if (evaluacionExistente) {
      setEvaluacion({
        instructor_nombre: evaluacionExistente.instructor_nombre || '',
        fecha_evaluacion: evaluacionExistente.fecha_evaluacion || new Date().toISOString().split('T')[0],
        curso_nombre: evaluacionExistente.curso_nombre || '',
        empresa_plantel: evaluacionExistente.empresa_plantel || 'ITD',
        criterio_1: evaluacionExistente.criterio_1 || null,
        criterio_2: evaluacionExistente.criterio_2 || null,
        criterio_3: evaluacionExistente.criterio_3 || null,
        criterio_4: evaluacionExistente.criterio_4 || null,
        criterio_5: evaluacionExistente.criterio_5 || null,
        aceptado: evaluacionExistente.aceptado || false,
        jefe_departamento: evaluacionExistente.jefe_departamento || '',
        cargo_evaluador: evaluacionExistente.cargo_evaluador || ''
      });
    }
  }, [evaluacionExistente]);

  useEffect(() => {
    cargarCatalogos();
  }, []);

  async function cargarCatalogos() {
    setCargando(true);
    
    // ========== NUEVO: Cargar SOLO los jefes de departamento ==========
    // Buscar docentes que tengan "jefe" en su cargo o departamento
    const { data: jefes } = await supabase
      .from('docentes')
      .select('nombre_completo, departamento, email')
      .eq('activo', true)
      .order('nombre_completo');

    if (jefes) {
      // Filtrar posibles jefes (por nombre o porque están en departamentos clave)
      const posiblesJefes = jefes.filter(d => {
        const nombre = d.nombre_completo.toUpperCase();
        const depto = d.departamento?.toUpperCase() || '';
        // Incluir jefes conocidos manualmente
        const jefesConocidos = [
          'ANÍBAL ROBERTO SAUCEDO ROSALES',
          'JUAN VANEGAS RENTERÍA',
          'LUIS CAMPA GALINDO',
          'MÓNICA ROSALES PÉREZ',
          'CÉLIDA CÓRDOVA NAVARRO',
          'EUSEBIO MUÑOZ RÍOS',
          'TANIA MONTOYA GARCÍA',
          'HÉCTOR SOLÍS FLORES',
          'ALMA CITLALI VÁSQUEZ MORENO',
          'CARLOS GALEANA DÁVILA',
          'AARÓN CUAUHTÉMOC VARGAS FIERRO'
        ];
        return jefesConocidos.some(j => nombre.includes(j)) || 
               depto.includes('JEFE') ||
               depto.includes('DIRECTOR');
      });
      
      // Si no se encontraron jefes, usar todos los docentes como fallback
      const listaJefes = posiblesJefes.length > 0 ? posiblesJefes : jefes;
      
      // Formatear nombres con departamento para mejor identificación
      const nombresFormateados = listaJefes.map(d => 
        d.departamento 
          ? `${d.nombre_completo} (${d.departamento})`
          : d.nombre_completo
      );
      
      setJefesDepartamento(nombresFormateados);
    }

    // Cargos predefinidos
    const cargosPredefinidos = [
      'Jefe(a) del Departamento de Ciencias Básicas',
      'Jefe(a) del Departamento de Ciencias Económico Administrativas',
      'Jefe(a) del Departamento de Ingenierías Eléctrica - Electrónica',
      'Jefe(a) del Departamento de Ingeniería Industrial',
      'Jefe(a) del Departamento Metal-Mecánica',
      'Jefe(a) del Departamento de Ingenierías Química-Bioquímica',
      'Jefe(a) del Departamento de Sistemas y Computación',
      'Jefe(a) del Departamento de Ciencias de la Tierra',
      'Jefe(a) de la División de Estudios de Posgrado e Investigación',
      'Jefe(a) del Departamento de Desarrollo Académico',
      'Subdirector(a) Académico',
      'Director(a) del Instituto Tecnológico de Durango'
    ];
    setCargos(cargosPredefinidos);
    setCargando(false);
  }

  function handleChange(campo, valor) {
    setEvaluacion(prev => ({
      ...prev,
      [campo]: valor
    }));
  }

  function handleCriterioChange(id, valor) {
    setEvaluacion(prev => ({
      ...prev,
      [`criterio_${id}`]: parseInt(valor)
    }));
  }

  function calcularTotal() {
    const total = [1,2,3,4,5].reduce((sum, i) => {
      return sum + (parseInt(evaluacion[`criterio_${i}`]) || 0);
    }, 0);
    return total;
  }

  // ========== NUEVO: Función para extraer solo el nombre sin departamento ==========
  function extraerNombreCompleto(texto) {
    if (!texto) return '';
    // Si tiene paréntesis, extraer solo la parte antes del paréntesis
    const match = texto.match(/^([^(]+)/);
    return match ? match[0].trim() : texto;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validaciones
    const camposRequeridos = ['instructor_nombre', 'fecha_evaluacion', 'curso_nombre', 'jefe_departamento', 'cargo_evaluador'];
    for (const campo of camposRequeridos) {
      if (!evaluacion[campo]) {
        setError(`El campo "${campo.replace('_', ' ')}" es obligatorio.`);
        return;
      }
    }

    // Validar que todos los criterios estén calificados
    for (let i = 1; i <= 5; i++) {
      if (evaluacion[`criterio_${i}`] === null || evaluacion[`criterio_${i}`] === undefined) {
        setError(`El criterio ${i} debe ser evaluado.`);
        return;
      }
    }

    setGuardando(true);

    try {
      // Preparar datos para guardar
      const dataToSave = {
        preregistro_id: preregistro?.id || null,
        docente_id: docente.id,
        instructor_nombre: evaluacion.instructor_nombre.toUpperCase(),
        fecha_evaluacion: evaluacion.fecha_evaluacion,
        curso_nombre: evaluacion.curso_nombre.toUpperCase(),
        empresa_plantel: evaluacion.empresa_plantel?.toUpperCase() || 'ITD',
        criterio_1: evaluacion.criterio_1,
        criterio_2: evaluacion.criterio_2,
        criterio_3: evaluacion.criterio_3,
        criterio_4: evaluacion.criterio_4,
        criterio_5: evaluacion.criterio_5,
        puntuacion_total: calcularTotal(),
        aceptado: evaluacion.aceptado,
        // ========== NUEVO: Guardar solo el nombre sin el departamento entre paréntesis ==========
        jefe_departamento: extraerNombreCompleto(evaluacion.jefe_departamento),
        cargo_evaluador: evaluacion.cargo_evaluador
      };

      let result;
      
      if (evaluacionExistente) {
        // Actualizar evaluación existente
        result = await supabase
          .from('evaluaciones_instructores')
          .update(dataToSave)
          .eq('id', evaluacionExistente.id)
          .select()
          .single();
      } else {
        // Insertar nueva evaluación
        result = await supabase
          .from('evaluaciones_instructores')
          .insert(dataToSave)
          .select()
          .single();
      }

      const { data, error: dbError } = result;
      if (dbError) throw dbError;

      // Generar PDF
      const pdfUrl = await generarPDFCriterios({
        ...evaluacion,
        // ========== NUEVO: Usar nombre limpio para el PDF ==========
        jefe_departamento: extraerNombreCompleto(evaluacion.jefe_departamento),
        puntuacion_total: calcularTotal(),
        fecha_generacion: new Date().toLocaleDateString('es-MX', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      });

      setSuccess(true);
      
      // Notificar éxito
      if (onEvaluacionGuardada) {
        onEvaluacionGuardada(data, pdfUrl);
      }

      // Descargar PDF automáticamente después de 1 segundo
      setTimeout(() => {
        window.open(pdfUrl, '_blank');
      }, 1000);

    } catch (err) {
      console.error('Error al guardar evaluación:', err);
      setError('No se pudo guardar la evaluación. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="bg-itd-navy text-white px-6 py-4 rounded-t-2xl flex justify-between items-center sticky top-0 z-10">
          <div>
            <h2 className="font-display text-xl font-semibold">
              {evaluacionExistente ? 'Editar Evaluación' : 'Evaluación de Instructor'}
            </h2>
            <p className="text-sm text-white/70">
              Criterios para seleccionar instructor(a)
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="text-white/70 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              ❌ {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              ✅ ¡Evaluación guardada exitosamente! El PDF se descargará automáticamente.
            </div>
          )}

          {/* Datos del Instructor */}
          <div className="space-y-3">
            <h3 className="font-semibold text-itd-navy text-sm uppercase tracking-wider border-b border-itd-navy/10 pb-2">
              Datos del Instructor
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-itd-navyDark/70 mb-1">
                  Nombre del Instructor (a) *
                </label>
                <input
                  type="text"
                  value={evaluacion.instructor_nombre}
                  onChange={(e) => handleChange('instructor_nombre', e.target.value)}
                  className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm uppercase"
                  required
                  disabled={!!evaluacionExistente}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-itd-navyDark/70 mb-1">
                  Fecha de Evaluación *
                </label>
                <input
                  type="date"
                  value={evaluacion.fecha_evaluacion}
                  onChange={(e) => handleChange('fecha_evaluacion', e.target.value)}
                  className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-itd-navyDark/70 mb-1">
                  Nombre del Curso a Impartir *
                </label>
                <input
                  type="text"
                  value={evaluacion.curso_nombre}
                  onChange={(e) => handleChange('curso_nombre', e.target.value)}
                  className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm uppercase"
                  required
                  disabled={!!evaluacionExistente}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-itd-navyDark/70 mb-1">
                  Nombre de la Empresa o Plantel
                </label>
                <input
                  type="text"
                  value={evaluacion.empresa_plantel}
                  onChange={(e) => handleChange('empresa_plantel', e.target.value)}
                  className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm uppercase"
                />
              </div>
            </div>
          </div>

          {/* Tabla de Criterios */}
          <div className="space-y-3">
            <h3 className="font-semibold text-itd-navy text-sm uppercase tracking-wider border-b border-itd-navy/10 pb-2">
              Evaluación por Criterios
            </h3>
            
            {/* Escala de referencia */}
            <div className="flex flex-wrap gap-2 bg-itd-sand/50 rounded-lg p-3">
              <span className="text-sm font-semibold text-itd-navyDark/70">Escala:</span>
              {ESCALA.map((item) => (
                <span key={item.value} className="inline-flex items-center gap-1 text-sm">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-itd-navy text-white text-xs font-bold">
                    {item.value}
                  </span>
                  {item.label}
                </span>
              ))}
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-itd-navy text-white">
                    <th className="px-4 py-2 text-left font-semibold">Criterio</th>
                    {[1,2,3,4,5].map(n => (
                      <th key={n} className="px-2 py-2 text-center font-semibold w-14">{n}</th>
                    ))}
                    <th className="px-2 py-2 text-center font-semibold w-14">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {CRITERIOS.map((criterio) => (
                    <tr key={criterio.id} className="border-b border-itd-navy/10 hover:bg-itd-sand/30">
                      <td className="px-4 py-2 text-itd-navyDark text-xs">{criterio.label}</td>
                      {[1,2,3,4,5].map(val => (
                        <td key={val} className="px-1 py-2 text-center">
                          <input
                            type="radio"
                            name={`criterio_${criterio.id}`}
                            value={val}
                            checked={evaluacion[`criterio_${criterio.id}`] === val}
                            onChange={(e) => handleCriterioChange(criterio.id, e.target.value)}
                            className="w-4 h-4 accent-itd-navy cursor-pointer"
                            required
                          />
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center font-bold text-itd-navy">
                        {evaluacion[`criterio_${criterio.id}`] || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-itd-navy/5 font-bold">
                    <td className="px-4 py-2 text-itd-navyDark">TOTAL GENERAL</td>
                    <td colSpan="5"></td>
                    <td className="px-2 py-2 text-center text-itd-guinda text-lg">
                      {calcularTotal()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Resultado y Evaluador */}
          <div className="space-y-3">
            <h3 className="font-semibold text-itd-navy text-sm uppercase tracking-wider border-b border-itd-navy/10 pb-2">
              Resultado de Evaluación
            </h3>
            <div className="flex items-center gap-6">
              <span className="text-sm font-medium text-itd-navyDark/70">¿Instructor Aceptado?</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="aceptado"
                  value="true"
                  checked={evaluacion.aceptado === true}
                  onChange={() => handleChange('aceptado', true)}
                  className="w-4 h-4 accent-green-600"
                />
                <span className="text-sm font-medium text-green-700">Sí</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="aceptado"
                  value="false"
                  checked={evaluacion.aceptado === false}
                  onChange={() => handleChange('aceptado', false)}
                  className="w-4 h-4 accent-red-600"
                />
                <span className="text-sm font-medium text-red-700">No</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ========== NUEVO: Campo de autocompletado para Jefe ========== */}
              <div>
                <AutocompleteInput
                  value={evaluacion.jefe_departamento}
                  onChange={(val) => handleChange('jefe_departamento', val)}
                  onSelect={(val) => handleChange('jefe_departamento', val)}
                  options={jefesDepartamento}
                  label="Jefe(a) de Departamento que Evalúa"
                  placeholder="Escribe el nombre del jefe(a)..."
                  required={true}
                />
                <p className="text-xs text-itd-navyDark/40 mt-1">
                  Escribe las primeras letras del nombre para buscar
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-itd-navyDark/70 mb-1">
                  Cargo del Evaluador *
                </label>
                <select
                  value={evaluacion.cargo_evaluador}
                  onChange={(e) => handleChange('cargo_evaluador', e.target.value)}
                  className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm bg-white"
                  required
                >
                  <option value="">Seleccione Cargo</option>
                  {cargos.map((cargo) => (
                    <option key={cargo} value={cargo}>{cargo}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Nota importante */}
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Este documento se generará en PDF para su descarga.
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Recuerda imprimir y entregar firmado este documento en Coordinación de Actualización Docente para que tenga validez.
                </p>
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4 border-t border-itd-navy/10">
            <button
              type="button"
              onClick={onCerrar}
              className="px-6 py-2.5 rounded-lg border border-itd-navy/20 text-itd-navyDark/70 hover:bg-itd-sand transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || cargando}
              className="flex-1 px-6 py-2.5 rounded-lg bg-itd-navy text-white font-semibold hover:bg-itd-navyDark disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {guardando ? (
                <>
                  <span className="animate-spin">⏳</span>
                  {evaluacionExistente ? 'Actualizando...' : 'Guardando...'}
                </>
              ) : (
                <>
                  📄 {evaluacionExistente ? 'Actualizar Evaluación' : 'Generar Evaluación'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}