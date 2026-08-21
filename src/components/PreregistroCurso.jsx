// src/components/PreregistroCurso.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatearRangoFechas } from '../lib/formatoFechas';
import { descargarOficioRegistro } from '../lib/oficio';
import EvaluacionInstructor from './EvaluacionInstructor';
import AutocompleteInput from './AutocompleteInput';
import GenerarListaAsistencia from './GenerarListaAsistencia';

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
  'DEPARTAMENTO DESARROLLO ACADÉMICO',
];

const MODALIDADES = ['Presencial', 'Virtual', 'Mixta'];
const HORARIOS = ['09:00 A 15:00 HRS', '15:00 A 20:00 HRS'];

const PREFIJOS_LUGAR_VALIDOS = ['AULA', 'TALLER', 'SALA', 'LABORATORIO', 'EDIFICIO DE', 'AUDIOVISUAL'];

// Sugerencias para "Cargo del jefe(a)": Jefe/Jefa + cada departamento
const CARGOS_JEFATURA_SUGERIDOS = DEPARTAMENTOS.flatMap((d) => [
  `JEFE DEL ${d}`,
  `JEFA DEL ${d}`,
]);

const ESTADO_LABEL = {
  pendiente: { texto: 'En revisión', clase: 'bg-amber-100 text-amber-700' },
  aprobado: { texto: 'Aprobado', clase: 'bg-green-100 text-green-700' },
};

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

function etiquetaPeriodo(p) {
  if (p === 'PERIODO_1') return 'Periodo 1';
  if (p === 'PERIODO_2') return 'Periodo 2';
  return p || 'Sin periodo';
}

function aMayusculas(texto) {
  return texto.toUpperCase();
}

export default function PreregistroCurso({ docente }) {
  const [misPreregistros, setMisPreregistros] = useState(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [form, setForm] = useState(formVacio());
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [convocatoria, setConvocatoria] = useState(null);
  const [alcanceDirigido, setAlcanceDirigido] = useState('MISMO');

  // ===== ESTADOS PARA EVALUACIÓN =====
  const [mostrarEvaluacion, setMostrarEvaluacion] = useState(false);
  const [preregistroSeleccionado, setPreregistroSeleccionado] = useState(null);
  const [evaluacionesExistentes, setEvaluacionesExistentes] = useState({});

  // ===== NUEVO: ESTADOS PARA LISTA DE ASISTENCIA =====
  const [esAdmin, setEsAdmin] = useState(false);
  const [mostrarListaAsistencia, setMostrarListaAsistencia] = useState(false);
  const [cursoParaLista, setCursoParaLista] = useState(null);

  useEffect(() => {
    cargar();
    cargarConvocatoria();
    verificarAdmin();
  }, []);

  // ===== NUEVO: Verificar si el usuario es administrador =====
  async function verificarAdmin() {
    const { data } = await supabase
      .from('administradores')
      .select('email')
      .ilike('email', docente.email);
    setEsAdmin((data || []).length > 0);
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
      data.forEach(evalItem => {
        mapa[evalItem.preregistro_id] = evalItem;
      });
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

    if (faltantes.length) {
      setErrorMsg('Faltan campos por llenar: ' + faltantes.join(', '));
      return;
    }

    if (!validarLugar(form.lugar, form.modalidad)) {
      setErrorMsg(
        'El "Lugar" debe indicar el espacio específico: Aula, Taller, Sala, Laboratorio, Audiovisual o Edificio de... ' +
        '(no se acepta solo "ITD" o el nombre del instituto). Si es virtual, deja el campo vacío y elige modalidad Virtual.'
      );
      return;
    }

    setGuardando(true);
    const dirigidoAFinal = alcanceDirigido === 'TODO_ITD' ? 'INSTITUTO TECNOLÓGICO DE DURANGO' : form.dirigido_a;
    const { error } = await supabase.from('preregistro_cursos').insert({
      ...form,
      dirigido_a: dirigidoAFinal,
      docente_id: docente.id,
      duracion_horas: Number(form.duracion_horas),
    });
    setGuardando(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setForm(formVacio());
    setAlcanceDirigido('MISMO');
    setFormAbierto(false);
    cargar();
  }

  // ===== FUNCIONES PARA EVALUACIÓN =====
  function abrirEvaluacion(item) {
    setPreregistroSeleccionado(item);
    setMostrarEvaluacion(true);
  }

  function cerrarEvaluacion() {
    setMostrarEvaluacion(false);
    setPreregistroSeleccionado(null);
  }

  async function handleEvaluacionGuardada(data) {
    setEvaluacionesExistentes(prev => ({
      ...prev,
      [data.preregistro_id]: data
    }));
    cerrarEvaluacion();
    await cargar();
  }

  // ===== NUEVO: FUNCIÓN PARA ABRIR LISTA DE ASISTENCIA =====
  function abrirListaAsistencia(item) {
    if (item.curso_id) {
      setCursoParaLista({ id: item.curso_id });
      setMostrarListaAsistencia(true);
    } else {
      alert('⚠️ Este curso aún no tiene una lista de asistencia generada. Asegúrate de que el curso haya sido aprobado y tenga inscripciones activas.');
    }
  }

  const fechasPeriodo1 = convocatoria?.periodo1_inicio && convocatoria?.periodo1_fin
    ? formatearRangoFechas(convocatoria.periodo1_inicio, convocatoria.periodo1_fin)
    : null;
  const fechasPeriodo2 = convocatoria?.periodo2_inicio && convocatoria?.periodo2_fin
    ? formatearRangoFechas(convocatoria.periodo2_inicio, convocatoria.periodo2_fin)
    : null;

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h2 className="font-display text-xl font-semibold text-itd-navy">Preregistro de Curso</h2>
          <p className="text-sm text-itd-navyDark/60 mt-1">
            Propón un curso para impartir. La Coordinación de Actualización Docente lo revisa y confirma
            antes de abrir inscripciones.
          </p>
        </div>
        <button
          onClick={() => setFormAbierto((v) => !v)}
          disabled={!convocatoria}
          title={!convocatoria ? 'No hay convocatoria activa con fechas de periodo publicadas todavía' : undefined}
          className="shrink-0 rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-itd-navy"
        >
          {formAbierto ? 'Cancelar' : '+ Proponer curso'}
        </button>
      </div>

      {!convocatoria && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
          Por ahora no hay una convocatoria activa con fechas de periodo publicadas, así que todavía no
          se pueden proponer cursos nuevos. En cuanto la Coordinación abra la siguiente convocatoria,
          este botón se habilita solo.
        </p>
      )}

      {formAbierto && convocatoria && (
        <form onSubmit={guardar} className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-itd-navy/10 pt-6">
          <div className="sm:col-span-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            ⚠️ Cuida la ortografía y los acentos: lo que captures aquí aparecerá <strong>tal cual</strong> en
            las constancias y reconocimientos. Todos los campos son obligatorios.
          </div>

          {errorMsg && <p className="sm:col-span-2 text-sm text-red-600">{errorMsg}</p>}

          <input
            required
            placeholder="Nombre del curso"
            value={form.curso}
            onChange={(e) => setForm({ ...form, curso: aMayusculas(e.target.value) })}
            className="sm:col-span-2 rounded-lg border border-itd-navy/20 px-3 py-2 text-sm uppercase"
          />
          <textarea
            required
            placeholder="Objetivo del curso"
            value={form.objetivo}
            onChange={(e) => setForm({ ...form, objetivo: e.target.value })}
            rows={3}
            className="sm:col-span-2 rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          />

          <div>
            <select
              required
              value={form.periodo}
              onChange={(e) => setForm({ ...form, periodo: e.target.value })}
              className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
            >
              <option value="">Periodo…</option>
              <option value="PERIODO_1">Periodo 1{fechasPeriodo1 ? ` (${fechasPeriodo1})` : ''}</option>
              <option value="PERIODO_2">Periodo 2{fechasPeriodo2 ? ` (${fechasPeriodo2})` : ''}</option>
            </select>
          </div>

          <select
            required
            value={form.horario}
            onChange={(e) => setForm({ ...form, horario: e.target.value })}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          >
            <option value="">Horario…</option>
            {HORARIOS.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>

          <input
            required
            placeholder="Duración (horas)"
            type="number"
            value={form.duracion_horas}
            onChange={(e) => setForm({ ...form, duracion_horas: e.target.value })}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          />

          <select
            required
            value={form.modalidad}
            onChange={(e) => setForm({ ...form, modalidad: e.target.value, lugar: e.target.value === 'Virtual' ? '' : form.lugar })}
            className="rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          >
            <option value="">Modalidad…</option>
            {MODALIDADES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <div>
            <input
              required={form.modalidad !== 'Virtual'}
              disabled={form.modalidad === 'Virtual'}
              placeholder="Ej. AULA 3, TALLER DE ELECTRÓNICA, LABORATORIO 2…"
              value={form.lugar}
              onChange={(e) => setForm({ ...form, lugar: aMayusculas(e.target.value) })}
              className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm uppercase disabled:opacity-40 disabled:bg-itd-sand/40"
            />
            <p className="text-[11px] text-itd-navyDark/40 mt-1">
              {form.modalidad === 'Virtual'
                ? 'No aplica en modalidad Virtual.'
                : 'Indica Aula, Taller, Sala, Laboratorio, Audiovisual o Edificio de… (no se acepta solo "ITD").'}
            </p>
          </div>

          <select
            required
            value={form.dirigido_a}
            onChange={(e) => {
              const depto = e.target.value;
              setForm((prev) => ({
                ...prev,
                dirigido_a: depto,
                jefatura_cargo:
                  !prev.jefatura_cargo || CARGOS_JEFATURA_SUGERIDOS.includes(prev.jefatura_cargo)
                    ? (depto ? `JEFE DEL ${depto}` : '')
                    : prev.jefatura_cargo,
              }));
            }}
            className="sm:col-span-2 rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
          >
            <option value="">Departamento…</option>
            {DEPARTAMENTOS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-itd-navyDark/70 mb-1">Dirigido a</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={alcanceDirigido === 'MISMO'}
                  onChange={() => setAlcanceDirigido('MISMO')}
                />
                Personal del mismo departamento
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={alcanceDirigido === 'TODO_ITD'}
                  onChange={() => setAlcanceDirigido('TODO_ITD')}
                />
                Todo el personal del ITD
              </label>
            </div>
          </div>

          <input
            required
            placeholder="Nombre del jefe(a) de departamento"
            value={form.nombre_jefe}
            onChange={(e) => setForm({ ...form, nombre_jefe: aMayusculas(e.target.value) })}
            className="sm:col-span-2 rounded-lg border border-itd-navy/20 px-3 py-2 text-sm uppercase"
          />

          <div className="sm:col-span-2">
            <AutocompleteInput
              value={form.jefatura_cargo}
              onChange={(v) => setForm({ ...form, jefatura_cargo: aMayusculas(v) })}
              sugerencias={CARGOS_JEFATURA_SUGERIDOS}
              placeholder="Cargo del jefe(a), ej. Jefe(a) del Departamento de Sistemas y Computación"
              className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
              required
            />
            <p className="text-[11px] text-itd-navyDark/40 mt-1">
              Se autocompletó con el departamento de arriba — ajusta "Jefe"/"Jefa" si hace falta.
            </p>
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-stretch rounded-lg border border-itd-navy/20 overflow-hidden">
              <input
                required
                placeholder="No. de oficio de tu departamento (solo el número, ej. 123)"
                value={form.oficio_no}
                onChange={(e) => setForm({ ...form, oficio_no: e.target.value.replace(/[^0-9]/g, '') })}
                className="flex-1 px-3 py-2 text-sm outline-none"
              />
              <span className="flex items-center px-3 text-sm text-itd-navyDark/50 bg-itd-sand/40 border-l border-itd-navy/10">
                /{new Date().getFullYear()}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="sm:col-span-2 rounded-lg bg-itd-navy text-white px-4 py-2 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-50"
          >
            {guardando ? 'Enviando…' : 'Enviar propuesta'}
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
                      {item.docentes && (
                        <p className="text-xs text-itd-navyDark/50">
                          Propuesto por: {item.docentes.nombre_completo}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${estado.clase}`}>
                        {estado.texto}
                      </span>

                      {item.estado === 'pendiente' && (
                        <button
                          onClick={() => abrirEvaluacion(item)}
                          className="text-xs font-medium text-purple-700 border border-purple-300 rounded-lg px-3 py-1.5 hover:bg-purple-50 transition-colors flex items-center gap-1"
                        >
                          {evaluacion ? (
                            <>✅ Ver Evaluación</>
                          ) : (
                            <>📋 Evaluar Instructor</>
                          )}
                        </button>
                      )}

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

                  {/* ===== BOTÓN LISTA DE ASISTENCIA ===== */}
                  {item.estado === 'aprobado' && esAdmin && (
                    <button
                      onClick={() => abrirListaAsistencia(item)}
                      className="mt-3 text-xs font-medium text-itd-navy border border-itd-navy/20 rounded-lg px-3 py-1.5 hover:bg-itd-sand transition-colors flex items-center gap-1"
                    >
                      📋 Lista de Asistencia
                    </button>
                  )}

                  {item.oficio_no && (
                    <button
                      onClick={() => descargarOficioRegistro(item, convocatoria)}
                      className="mt-3 text-xs font-medium text-itd-navy border border-itd-navy/20 rounded-lg px-3 py-1.5 hover:bg-itd-sand"
                    >
                      📄 Descargar oficio de registro (No. {String(item.oficio_no).split('/')[0].trim()}/{new Date(item.created_at).getFullYear()})
                    </button>
                  )}
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

      {/* ===== MODAL LISTA DE ASISTENCIA ===== */}
      {mostrarListaAsistencia && cursoParaLista && (
        <GenerarListaAsistencia
          cursoId={cursoParaLista.id}
          onClose={() => {
            setMostrarListaAsistencia(false);
            setCursoParaLista(null);
          }}
        />
      )}
    </div>
  );
}