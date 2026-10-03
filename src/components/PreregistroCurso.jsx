import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatearRangoFechas } from '../lib/formatoFechas';
import { descargarOficioRegistro } from '../lib/oficio';
import { descargarCriteriosInstructor } from '../lib/criteriosInstructor';
import AutocompleteInput from './AutocompleteInput';
import EvaluacionInstructor from './EvaluacionInstructor';

const DEPARTAMENTOS = [
  'DEPARTAMENTO DE CIENCIAS BÁSICAS',
  'DEPARTAMENTO DE CIENCIAS ECONÓMICO ADMINISTRATIVAS',
  'DEPARTAMENTO DE INGENIERÍAS ELÉCTRICA - ELECTRÓNICA',
  'DEPARTAMENTO DE INGENIERÍA INDUSTRIAL',
  'DEPARTAMENTO DE METAL-MECÁNICA',
  'DEPARTAMENTO DE INGENIERÍAS QUÍMICA-BIOQUÍMICA',
  'DEPARTAMENTO DE SISTEMAS Y COMPUTACION',
  'DEPARTAMENTO DE CIENCIAS DE LA TIERRA',
  'DIVISION DE ESTUDIOS DE POSGRADO E INVESTIGACION',
  'DEPARTAMENTO DE DESARROLLO ACADÉMICO',
];

const MODALIDADES = ['Presencial', 'Virtual', 'Mixta'];
const HORARIOS = ['09:00 A 15:00 HRS', '15:00 A 20:00 HRS'];

const PREFIJOS_LUGAR_VALIDOS = ['AULA', 'TALLER', 'SALA', 'LABORATORIO', 'EDIFICIO DE', 'AUDIOVISUAL'];

const CARGOS_JEFATURA_SUGERIDOS = DEPARTAMENTOS.flatMap((d) => [
  `JEFE DEL ${d}`,
  `JEFA DEL ${d}`,
]);

const ESTADO_LABEL = {
  pendiente: { texto: 'En revisión', clase: 'bg-amber-100 text-amber-700' },
  aprobado: { texto: 'Aprobado', clase: 'bg-green-100 text-green-700' },
};

const LIMITE_MB = 3;
const LIMITE_BYTES = LIMITE_MB * 1024 * 1024;

function formatearPeso(bytes) {
  if (!bytes) return '0 KB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formVacio() {
  return {
    curso: '',
    objetivo: '',
    periodo: '',
    horario: '',
    duracion_horas: '',
    modalidad: '',
    lugar: '',
    dirigido_a: '',
    nombre_jefe: '',
    jefatura_cargo: '',
    oficio_no: '',
  };
}

function archivosVacios() {
  return {
    cvu: null,
    fichaTecnica: null,
  };
}

function etiquetaPeriodo(p) {
  if (p === 'PERIODO_1') return 'Periodo 1';
  if (p === 'PERIODO_2') return 'Periodo 2';
  return p || 'Sin periodo';
}

function aMayusculas(texto) {
  return texto.toUpperCase();
}

export default function PreregistroCurso({ docente, onSalir }) {
  const [misPreregistros, setMisPreregistros] = useState(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [form, setForm] = useState(formVacio());
  const [archivos, setArchivos] = useState(archivosVacios());
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [convocatoria, setConvocatoria] = useState(null);
  const [alcanceDirigido, setAlcanceDirigido] = useState('MISMO');
  const [formKey, setFormKey] = useState(Date.now());
  const [docentesNombres, setDocentesNombres] = useState([]);
  
  // Estados para evaluación
  const [mostrarEvaluacion, setMostrarEvaluacion] = useState(false);
  const [preregistroSeleccionado, setPreregistroSeleccionado] = useState(null);
  const [evaluacionesExistentes, setEvaluacionesExistentes] = useState({});

  // Estado para formatos descargables
  const [formatosDescargables, setFormatosDescargables] = useState([]);

  // Información de validación de archivos (peso, error, confirmación)
  const [infoArchivos, setInfoArchivos] = useState({
    cvu: { error: null, peso: null, nombre: null },
    fichaTecnica: { error: null, peso: null, nombre: null },
  });

  // Validador estricto de 3 MB para CVU y Ficha Técnica
  function manejarCambioArchivo(e, tipo, nombreEtiqueta) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Validar que sea PDF
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      e.target.value = '';
      setArchivos((prev) => ({ ...prev, [tipo]: null }));
      setInfoArchivos((prev) => ({
        ...prev,
        [tipo]: { error: `El archivo para "${nombreEtiqueta}" debe ser en formato PDF.`, peso: null, nombre: null },
      }));
      return;
    }

    // 2. Validar límite estricto de 3 MB
    if (file.size > LIMITE_BYTES) {
      const pesoExacto = formatearPeso(file.size);
      e.target.value = ''; // Limpiar el input para cancelar la selección
      setArchivos((prev) => ({ ...prev, [tipo]: null }));
      setInfoArchivos((prev) => ({
        ...prev,
        [tipo]: {
          error: `⚠️ El archivo seleccionado para ${nombreEtiqueta} pesa ${pesoExacto}, superando el límite de ${LIMITE_MB} MB. Por favor comprímelo antes de subirlo (por ejemplo en ilovepdf.com).`,
          peso: null,
          nombre: null,
        },
      }));
      return;
    }

    // 3. Archivo válido (<= 3 MB)
    setArchivos((prev) => ({ ...prev, [tipo]: file }));
    setInfoArchivos((prev) => ({
      ...prev,
      [tipo]: {
        error: null,
        peso: formatearPeso(file.size),
        nombre: file.name,
      },
    }));
  }

  // Abrir documento cargado del docente
  async function abrirDocumento(registroId, tipo) {
    const nombreArchivo = tipo === 'cvu' ? '1_cvu_instructor.pdf' : '2_ficha_tecnica.pdf';
    try {
      const { data, error } = await supabase.storage
        .from('documentos_preregistro')
        .download(`${registroId}/${nombreArchivo}`);

      if (error) {
        // Intentar con URL pública directa
        const { data: pub } = supabase.storage
          .from('documentos_preregistro')
          .getPublicUrl(`${registroId}/${nombreArchivo}`);
        if (pub?.publicUrl) {
          window.open(pub.publicUrl, '_blank');
          return;
        }
        throw error;
      }

      const blobUrl = URL.createObjectURL(data);
      window.open(blobUrl, '_blank');
    } catch (e) {
      alert(`No se pudo abrir el archivo (${tipo === 'cvu' ? 'CVU' : 'Ficha Técnica'}): ${e.message}`);
    }
  }

  useEffect(() => {
    cargar();
    cargarConvocatoria();
    cargarDocentes();
    cargarFormatos();
  }, []);

  async function cargarDocentes() {
    const { data } = await supabase
      .from('docentes')
      .select('nombre_completo')
      .order('nombre_completo', { ascending: true });
    
    if (data) setDocentesNombres(data.map(d => d.nombre_completo));
  }

  async function cargarFormatos() {
    const { data } = await supabase.storage.from('documentos_preregistro').list('formatos_plantillas');
    if (data) {
      setFormatosDescargables(data.filter(a => a.name !== '.emptyFolderPlaceholder' && a.name !== '.emptyFolder'));
    }
  }

  async function descargarFormatoOPlantilla(nombre) {
    const { data } = await supabase.storage.from('documentos_preregistro').download(`formatos_plantillas/${nombre}`);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  }

  async function cargar() {
    const { data } = await supabase
      .from('preregistro_cursos')
      .select('*, docentes(nombre_completo, email, departamento)')
      .eq('docente_id', docente.id)
      .order('created_at', { ascending: false });
    setMisPreregistros(data || []);

    if (data && data.length > 0) {
      cargarEvaluaciones(data.map(item => item.id));
    }
  }

  async function cargarEvaluaciones(preregistroIds) {
    if (preregistroIds.length === 0) return;
    const { data } = await supabase
      .from('evaluaciones_instructores')
      .select('*')
      .in('preregistro_id', preregistroIds);

    if (data) {
      const mapa = {};
      data.forEach(evalItem => { mapa[evalItem.preregistro_id] = evalItem; });
      setEvaluacionesExistentes(mapa);
    }
  }

  async function cargarConvocatoria() {
    const { data } = await supabase
      .from('convocatorias')
      .select('periodo1_inicio, periodo1_fin, periodo2_inicio, periodo2_fin')
      .eq('activo', true)
      .not('periodo1_inicio', 'is', null)
      .order('fecha_inicio', { ascending: true })
      .limit(1)
      .maybeSingle();
    setConvocatoria(data);
  }

  function validarLugar(lugar, modalidad) {
    if (modalidad === 'Virtual') return true;
    const l = lugar.trim().toUpperCase();
    return PREFIJOS_LUGAR_VALIDOS.some((prefijo) => l.startsWith(prefijo));
  }

  async function guardar(e) {
    e.preventDefault();
    setErrorMsg('');

    const faltantes = [];
    if (!form.curso.trim()) faltantes.push('Nombre del curso');
    if (!form.objetivo.trim()) faltantes.push('Objetivo');
    if (!form.periodo) faltantes.push('Periodo');
    if (!form.horario) faltantes.push('Horario');
    if (!form.duracion_horas) faltantes.push('Duración');
    if (!form.modalidad) faltantes.push('Modalidad');
    if (form.modalidad !== 'Virtual' && !form.lugar.trim()) faltantes.push('Lugar');
    if (!form.dirigido_a) faltantes.push('Departamento');
    if (!form.nombre_jefe.trim()) faltantes.push('Nombre del jefe(a) de departamento');
    if (!form.jefatura_cargo.trim()) faltantes.push('Cargo del jefe(a) de departamento');
    if (!form.oficio_no.trim()) faltantes.push('Número de oficio');
    
    if (!archivos.cvu) faltantes.push('Archivo PDF 1 (CVU)');
    if (!archivos.fichaTecnica) faltantes.push('Archivo PDF 2 (Ficha Técnica)');

    if (faltantes.length) {
      setErrorMsg('Faltan campos/archivos por llenar: ' + faltantes.join(', '));
      return;
    }

    if (!validarLugar(form.lugar, form.modalidad)) {
      setErrorMsg('El "Lugar" debe ser específico. Si es virtual, deja el campo vacío y elige modalidad Virtual.');
      return;
    }

    setGuardando(true);
    const dirigidoAFinal = alcanceDirigido === 'TODO_ITD' ? 'INSTITUTO TECNOLÓGICO DE DURANGO' : form.dirigido_a;
    
    const { data: nuevoRegistro, error } = await supabase.from('preregistro_cursos').insert({
      ...form,
      dirigido_a: dirigidoAFinal,
      docente_id: docente.id,
      duracion_horas: Number(form.duracion_horas),
    }).select().single();

    if (error) {
      setErrorMsg(error.message);
      setGuardando(false);
      return;
    }

    const registroId = nuevoRegistro.id;

    try {
      const bucket = 'documentos_preregistro';
      const subidas = [
        supabase.storage.from(bucket).upload(`${registroId}/1_cvu_instructor.pdf`, archivos.cvu, {
          cacheControl: '3600',
          upsert: false
        }),
        supabase.storage.from(bucket).upload(`${registroId}/2_ficha_tecnica.pdf`, archivos.fichaTecnica, {
          cacheControl: '3600',
          upsert: false
        })
      ];
      const resultados = await Promise.all(subidas);
      
      for (const res of resultados) {
        if (res.error) throw res.error;
      }
      
    } catch (uploadError) {
      console.error('Error al subir los archivos:', uploadError);
      setErrorMsg('El registro se guardó, pero hubo un error al subir los archivos PDF.');
      setGuardando(false);
      return;
    }

    setGuardando(false);
    setForm(formVacio());
    setArchivos(archivosVacios());
    setFormKey(Date.now());
    setAlcanceDirigido('MISMO');
    setFormAbierto(false);
    cargar();
  }

  function abrirEvaluacion(item) {
    setPreregistroSeleccionado(item);
    setMostrarEvaluacion(true);
  }

  function cerrarEvaluacion() {
    setMostrarEvaluacion(false);
    setPreregistroSeleccionado(null);
  }

  async function handleEvaluacionGuardada(data) {
    setEvaluacionesExistentes(prev => ({ ...prev, [data.preregistro_id]: data }));
    cerrarEvaluacion();
    await cargar();
  }

  const fechasPeriodo1 = convocatoria?.periodo1_inicio && convocatoria?.periodo1_fin
    ? formatearRangoFechas(convocatoria.periodo1_inicio, convocatoria.periodo1_fin)
    : null;
  const fechasPeriodo2 = convocatoria?.periodo2_inicio && convocatoria?.periodo2_fin
    ? formatearRangoFechas(convocatoria.periodo2_inicio, convocatoria.periodo2_fin)
    : null;

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      
      {onSalir && (
        <button 
          onClick={onSalir}
          className="mb-6 text-sm font-medium text-itd-navy/70 hover:text-itd-navy flex items-center gap-1"
        >
          ← Volver al menú principal
        </button>
      )}

      <div className="mb-6 p-4 bg-itd-sand/30 rounded-xl border border-itd-navy/10">
        <h3 className="font-semibold text-itd-navyDark mb-2 flex items-center gap-2">
          ℹ️ Información Importante
        </h3>
        <p className="text-sm text-itd-navyDark/80">
          En esta sección podrás proponer un curso y subir la documentación requerida (CVU y Ficha Técnica). 
          Una vez enviada la propuesta y realizada la evaluación del instructor, los administradores revisarán 
          la información. <strong>Si el curso es autorizado, se publicará oficialmente para que los docentes 
          puedan inscribirse.</strong> 
        </p>
      </div>

      {/* SECCIÓN NUEVA: FORMATOS DESCARGABLES */}
      {formatosDescargables.length > 0 && (
        <div className="mb-8 p-5 bg-blue-50/50 rounded-xl border border-blue-100 shadow-sm">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            📥 Formatos para descargar
          </h3>
          <p className="text-sm text-blue-800/80 mb-4">
            Descarga los siguientes formatos, llénalos manualmente como parte de tu proceso, y sube los que apliquen (CVU, Ficha) al momento de registrar tu curso.
          </p>
          <div className="flex flex-wrap gap-2.5">
            {formatosDescargables.map(f => (
              <button
                key={f.name}
                onClick={() => descargarFormatoOPlantilla(f.name)}
                className="text-xs font-semibold bg-white border border-blue-200 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-50 shadow-sm flex items-center gap-2 transition-all"
              >
                📄 {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h2 className="font-display text-xl font-semibold text-itd-navy">Preregistro de Curso</h2>
          <p className="text-sm text-itd-navyDark/60 mt-1">
            Propón un curso, carga los documentos y evalúa al instructor.
          </p>
        </div>
        <button
          onClick={() => setFormAbierto((v) => !v)}
          disabled={!convocatoria}
          className="shrink-0 rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-40"
        >
          {formAbierto ? 'Cancelar' : '+ Proponer curso'}
        </button>
      </div>

      {!convocatoria && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
          Por ahora no hay una convocatoria activa con fechas de periodo publicadas.
        </p>
      )}

      {formAbierto && convocatoria && (
        <form key={formKey} onSubmit={guardar} className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-itd-navy/10 pt-6">
          <div className="sm:col-span-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            ⚠️ Cuida la ortografía y los acentos. <strong>Todos los campos y documentos PDF son obligatorios.</strong>
          </div>

          {errorMsg && <p className="sm:col-span-2 text-sm font-medium text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{errorMsg}</p>}

          <input required placeholder="Nombre del curso" value={form.curso} onChange={(e) => setForm({ ...form, curso: aMayusculas(e.target.value) })} className="sm:col-span-2 rounded-lg border border-itd-navy/20 px-3 py-2 text-sm uppercase" />
          <textarea required placeholder="Objetivo del curso" value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} rows={3} className="sm:col-span-2 rounded-lg border border-itd-navy/20 px-3 py-2 text-sm" />

          <div>
            <select required value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })} className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm">
              <option value="">Periodo…</option>
              <option value="PERIODO_1">Periodo 1{fechasPeriodo1 ? ` (${fechasPeriodo1})` : ''}</option>
              <option value="PERIODO_2">Periodo 2{fechasPeriodo2 ? ` (${fechasPeriodo2})` : ''}</option>
            </select>
          </div>

          <select required value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm">
            <option value="">Horario…</option>
            {HORARIOS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>

          <input required placeholder="Duración (horas)" type="number" value={form.duracion_horas} onChange={(e) => setForm({ ...form, duracion_horas: e.target.value })} className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm" />

          <select required value={form.modalidad} onChange={(e) => setForm({ ...form, modalidad: e.target.value, lugar: e.target.value === 'Virtual' ? '' : form.lugar })} className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm">
            <option value="">Modalidad…</option>
            {MODALIDADES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>

          <div>
            <input required={form.modalidad !== 'Virtual'} disabled={form.modalidad === 'Virtual'} placeholder="Ej. AULA 3, TALLER DE ELECTRÓNICA..." value={form.lugar} onChange={(e) => setForm({ ...form, lugar: aMayusculas(e.target.value) })} className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm uppercase disabled:opacity-40 disabled:bg-itd-sand/40" />
          </div>

          <select
            required
            value={form.dirigido_a}
            onChange={(e) => {
              const depto = e.target.value;
              setForm((prev) => ({
                ...prev,
                dirigido_a: depto,
                jefatura_cargo: !prev.jefatura_cargo || CARGOS_JEFATURA_SUGERIDOS.includes(prev.jefatura_cargo) ? (depto ? `JEFE DEL ${depto}` : '') : prev.jefatura_cargo,
              }));
            }}
            className="sm:col-span-2 rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          >
            <option value="">Departamento…</option>
            {DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-itd-navyDark/70 mb-1">Dirigido a</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="radio" checked={alcanceDirigido === 'MISMO'} onChange={() => setAlcanceDirigido('MISMO')} /> Personal del mismo departamento</label>
              <label className="flex items-center gap-2 text-sm"><input type="radio" checked={alcanceDirigido === 'TODO_ITD'} onChange={() => setAlcanceDirigido('TODO_ITD')} /> Todo el personal del ITD</label>
            </div>
          </div>

          <div className="sm:col-span-2">
            <AutocompleteInput value={form.nombre_jefe} onChange={(v) => setForm({ ...form, nombre_jefe: aMayusculas(v) })} sugerencias={docentesNombres} placeholder="Nombre del jefe(a) de departamento" className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm uppercase" required />
          </div>

          <div className="sm:col-span-2">
            <AutocompleteInput value={form.jefatura_cargo} onChange={(v) => setForm({ ...form, jefatura_cargo: aMayusculas(v) })} sugerencias={CARGOS_JEFATURA_SUGERIDOS} placeholder="Cargo del jefe(a), ej. Jefe(a) del Departamento de Sistemas y Computación" className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm" required />
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-stretch rounded-lg border border-itd-navy/20 overflow-hidden">
              <input required placeholder="No. de oficio (solo números)" value={form.oficio_no} onChange={(e) => setForm({ ...form, oficio_no: e.target.value.replace(/[^0-9]/g, '') })} className="flex-1 px-3 py-2 text-sm outline-none" />
              <span className="flex items-center px-3 text-sm text-itd-navyDark/50 bg-itd-sand/40 border-l border-itd-navy/10">/{new Date().getFullYear()}</span>
            </div>
          </div>

          <div className="sm:col-span-2 mt-4 space-y-4 bg-itd-sand/10 rounded-xl p-4 border border-itd-navy/10">
            <div className="flex items-center justify-between border-b border-itd-navy/10 pb-2">
              <h3 className="text-sm font-semibold text-itd-navyDark">
                Documentos requeridos para revisión (Solo PDF · Máximo 3 MB c/u)
              </h3>
              <span className="text-[11px] font-bold text-itd-navy bg-itd-sand/40 px-2 py-0.5 rounded border border-itd-navy/15">
                Límite: 3 MB
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1. CVU */}
              <div>
                <label className="block text-xs font-medium text-itd-navyDark/70 mb-1">
                  1. CVU - Currículum del Instructor *
                </label>
                <input 
                  type="file" 
                  accept="application/pdf" 
                  required 
                  onChange={(e) => manejarCambioArchivo(e, 'cvu', 'CVU')} 
                  className="text-xs w-full file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-itd-navy file:text-white cursor-pointer" 
                />
                {infoArchivos.cvu.error && (
                  <p className="mt-1.5 text-xs text-rose-700 font-semibold bg-rose-50 border border-rose-200 p-2 rounded-lg leading-relaxed">
                    {infoArchivos.cvu.error}
                  </p>
                )}
                {infoArchivos.cvu.peso && !infoArchivos.cvu.error && (
                  <p className="mt-1.5 text-xs text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                    <span>✅</span>
                    <span>Archivo válido ({infoArchivos.cvu.peso}) listo para enviar</span>
                  </p>
                )}
              </div>

              {/* 2. Ficha Técnica */}
              <div>
                <label className="block text-xs font-medium text-itd-navyDark/70 mb-1">
                  2. Ficha Técnica del Curso *
                </label>
                <input 
                  type="file" 
                  accept="application/pdf" 
                  required 
                  onChange={(e) => manejarCambioArchivo(e, 'fichaTecnica', 'Ficha Técnica')} 
                  className="text-xs w-full file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-itd-navy file:text-white cursor-pointer" 
                />
                {infoArchivos.fichaTecnica.error && (
                  <p className="mt-1.5 text-xs text-rose-700 font-semibold bg-rose-50 border border-rose-200 p-2 rounded-lg leading-relaxed">
                    {infoArchivos.fichaTecnica.error}
                  </p>
                )}
                {infoArchivos.fichaTecnica.peso && !infoArchivos.fichaTecnica.error && (
                  <p className="mt-1.5 text-xs text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                    <span>✅</span>
                    <span>Archivo válido ({infoArchivos.fichaTecnica.peso}) listo para enviar</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <button type="submit" disabled={guardando} className="sm:col-span-2 rounded-lg bg-itd-navy text-white px-4 py-3 text-sm font-semibold hover:bg-itd-navyDark disabled:opacity-50 mt-2">
            {guardando ? 'Guardando propuesta...' : 'Enviar propuesta'}
          </button>
        </form>
      )}

      <div className="mt-8">
        <h3 className="text-sm font-semibold text-itd-navyDark/70 mb-3">Mis propuestas</h3>
        {!misPreregistros ? (
          <p className="text-center text-itd-navyDark/50 py-6">Cargando…</p>
        ) : misPreregistros.length === 0 ? (
          <p className="text-sm text-itd-navyDark/40 py-2">Todavía no has propuesto ningún curso.</p>
        ) : (
          <div className="space-y-3">
            {misPreregistros.map((item) => {
              const estado = ESTADO_LABEL[item.estado] || ESTADO_LABEL.pendiente;
              const evaluacion = evaluacionesExistentes[item.id];

              return (
                <div key={item.id} className="rounded-xl border border-itd-navy/10 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-itd-navyDark">{item.curso}</p>
                      <p className="text-xs text-itd-navyDark/50 mt-1">{etiquetaPeriodo(item.periodo)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${estado.clase}`}>
                        {estado.texto}
                      </span>
                      
                      {evaluacion && (
                        <div className="text-xs text-itd-navyDark/60 flex items-center gap-2">
                          <span>📊 {evaluacion.puntuacion_total}/25</span>
                          <span className={`px-1.5 py-0.5 rounded ${evaluacion.aceptado ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {evaluacion.aceptado ? '✅ Aceptado' : '❌ Rechazado'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Alerta de acción requerida si falta evaluación */}
                  {item.estado === 'pendiente' && !evaluacion && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">⚠️</span>
                        <p className="text-xs font-bold text-amber-800">
                          Siguiente paso requerido: Evaluar al instructor para completar el expediente.
                        </p>
                      </div>
                      <button 
                        onClick={() => abrirEvaluacion(item)} 
                        className="text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg px-3.5 py-1.5 shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      >
                        <span>📋 Evaluar Instructor</span>
                      </button>
                    </div>
                  )}

                  {/* ============================================================= */}
                  {/* EXPEDIENTE DEL CURSO: 4 DOCUMENTOS ENUMERADOS VISUALMENTE     */}
                  {/* ============================================================= */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <span>📁</span>
                        <span>Expediente de la Propuesta (4 Documentos)</span>
                      </p>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Generados por sistema y cargados por docente
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      
                      {/* 1. OFICIO DE REGISTRO (Generado) */}
                      {item.oficio_no ? (
                        <button
                          type="button"
                          onClick={() => descargarOficioRegistro(item, convocatoria)}
                          className="group flex flex-col justify-between p-3 rounded-xl border border-blue-200/80 bg-gradient-to-br from-blue-50/70 via-white to-blue-50/30 hover:border-blue-400 hover:shadow-xs text-left transition-all cursor-pointer"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-2xs">
                              1
                            </span>
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded">
                              No. {String(item.oficio_no).split('/')[0].trim()}
                            </span>
                          </div>
                          <div>
                            <p className="font-bold text-xs text-slate-800 group-hover:text-blue-700 transition-colors">
                              Oficio de Registro
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Generado por sistema
                            </p>
                          </div>
                          <div className="mt-2.5 pt-1.5 border-t border-blue-100 flex items-center justify-between text-[11px] font-semibold text-blue-700">
                            <span>Descargar PDF</span>
                            <span className="text-xs group-hover:translate-x-0.5 transition-transform">⬇️</span>
                          </div>
                        </button>
                      ) : (
                        <div className="p-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col justify-between text-left">
                          <span className="w-6 h-6 rounded-lg bg-slate-300 text-slate-600 flex items-center justify-center text-xs font-bold">1</span>
                          <p className="text-xs font-bold text-slate-400 mt-2">Oficio de Registro</p>
                          <p className="text-[10px] text-slate-400">Sin número de oficio</p>
                        </div>
                      )}

                      {/* 2. CRITERIOS DE EVALUACIÓN (Generado) */}
                      {evaluacion ? (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await descargarCriteriosInstructor({
                                ...evaluacion,
                                curso_nombre: evaluacion.curso_nombre || item.curso,
                                instructor_nombre: evaluacion.instructor_nombre || item.docentes?.nombre_completo,
                                jefe_departamento: evaluacion.jefe_departamento || item.nombre_jefe,
                                cargo_evaluador: evaluacion.cargo_evaluador || item.jefatura_cargo,
                              });
                            } catch (error) {
                              alert("Error al generar el PDF: " + error.message);
                            }
                          }}
                          className="group flex flex-col justify-between p-3 rounded-xl border border-purple-200/80 bg-gradient-to-br from-purple-50/70 via-white to-purple-50/30 hover:border-purple-400 hover:shadow-xs text-left transition-all cursor-pointer"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center text-xs font-black shadow-2xs">
                              2
                            </span>
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-100/80 px-1.5 py-0.5 rounded">
                              {evaluacion.puntuacion_total}/25 pts
                            </span>
                          </div>
                          <div>
                            <p className="font-bold text-xs text-slate-800 group-hover:text-purple-700 transition-colors">
                              Criterios de Evaluación
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Formato ITD-AD-FO-06
                            </p>
                          </div>
                          <div className="mt-2.5 pt-1.5 border-t border-purple-100 flex items-center justify-between text-[11px] font-semibold text-purple-700">
                            <span>Descargar PDF</span>
                            <span className="text-xs group-hover:translate-x-0.5 transition-transform">⬇️</span>
                          </div>
                        </button>
                      ) : (
                        <div className="p-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/40 flex flex-col justify-between text-left">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center text-xs font-bold">2</span>
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Pendiente</span>
                          </div>
                          <div>
                            <p className="font-bold text-xs text-amber-900">Criterios de Evaluación</p>
                            <p className="text-[10px] text-amber-700 mt-0.5">Falta evaluar instructor</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => abrirEvaluacion(item)}
                            className="mt-2.5 pt-1.5 border-t border-amber-200 text-[11px] font-bold text-amber-800 hover:text-amber-900 flex items-center justify-between cursor-pointer"
                          >
                            <span>📋 Evaluar ahora</span>
                            <span>→</span>
                          </button>
                        </div>
                      )}

                      {/* 3. CVU DEL INSTRUCTOR (Subido) */}
                      <button
                        type="button"
                        onClick={() => abrirDocumento(item.id, 'cvu')}
                        className="group flex flex-col justify-between p-3 rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 hover:border-emerald-400 hover:shadow-xs text-left transition-all cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-black shadow-2xs">
                            3
                          </span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                            PDF Cargado
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-800 group-hover:text-emerald-700 transition-colors">
                            CVU del Instructor
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Currículum adjunto
                          </p>
                        </div>
                        <div className="mt-2.5 pt-1.5 border-t border-emerald-100 flex items-center justify-between text-[11px] font-semibold text-emerald-700">
                          <span>Ver mi CVU</span>
                          <span className="text-xs group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
                        </div>
                      </button>

                      {/* 4. FICHA TÉCNICA (Subida) */}
                      <button
                        type="button"
                        onClick={() => abrirDocumento(item.id, 'fichaTecnica')}
                        className="group flex flex-col justify-between p-3 rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 via-white to-indigo-50/30 hover:border-indigo-400 hover:shadow-xs text-left transition-all cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-2xs">
                            4
                          </span>
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-1.5 py-0.5 rounded">
                            PDF Cargado
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-800 group-hover:text-indigo-700 transition-colors">
                            Ficha Técnica
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Contenido del curso
                          </p>
                        </div>
                        <div className="mt-2.5 pt-1.5 border-t border-indigo-100 flex items-center justify-between text-[11px] font-semibold text-indigo-700">
                          <span>Ver Ficha Técnica</span>
                          <span className="text-xs group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
                        </div>
                      </button>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {mostrarEvaluacion && preregistroSeleccionado && (
        <EvaluacionInstructor
          preregistro={preregistroSeleccionado}
          docente={docente}
          onCerrar={cerrarEvaluacion}
          onEvaluacionGuardada={handleEvaluacionGuardada}
          evaluacionExistente={evaluacionesExistentes[preregistroSeleccionado.id] || null}
        />
      )}
    </div>
  );
}