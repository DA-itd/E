import React, { useState, useEffect, useMemo } from 'react';
import { Curso, Participante } from '../../types';
import { getLocalCursos, saveLocalCursos, getLocalDocentes, supabase } from '../../lib/supabaseClient';
import { DEPARTAMENTOS_ITD } from './AdminProyectosDocencia';
import { BookOpen, Users, Plus, X, Check, ArrowLeft, Upload, Sparkles } from 'lucide-react';

interface Props {
  onCursoCreado: () => void;
  onVolver: () => void;
}

export default function FormularioNuevoCurso({ onCursoCreado, onVolver }: Props) {
  const [nombre, setNombre] = useState('');
  const [folio, setFolio] = useState(`ITD-AD-2026-${String(Math.floor(Math.random() * 900) + 100)}`);
  const [clave, setClave] = useState(`CAD-26-${String(Math.floor(Math.random() * 90) + 10)}`);
  const [instructor, setInstructor] = useState('');
  const [instructorRfc, setInstructorRfc] = useState('');
  const [instructorCurp, setInstructorCurp] = useState('');
  const [periodo, setPeriodo] = useState('Del 12 al 16 de Enero de 2026');
  const [semana, setSemana] = useState('PERIODO_1');
  const [horas, setHoras] = useState(30);
  const [horario, setHorario] = useState('08:00 a 14:00 hrs');
  const [lugar, setLugar] = useState('Campus Principal ITD');
  const [departamento, setDepartamento] = useState(DEPARTAMENTOS_ITD[0]);
  const [modalidad, setModalidad] = useState<'PRESENCIAL' | 'VIRTUAL' | 'HÍBRIDO'>('PRESENCIAL');

  // Catálogo de docentes y autocompletado
  const [catalogoDocentes, setCatalogoDocentes] = useState<any[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [docenteSugeridoIndex, setDocenteSugeridoIndex] = useState(-1);

  // Participantes agregados
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [tempNombre, setTempNombre] = useState('');
  const [tempRfc, setTempRfc] = useState('');
  const [tempCurp, setTempCurp] = useState('');
  const [tempDepto, setTempDepto] = useState(DEPARTAMENTOS_ITD[0]);
  const [tempPuesto, setTempPuesto] = useState('Docente');
  const [tempNivel, setTempNivel] = useState('Docente');
  const [tempEsFD, setTempEsFD] = useState(false);

  useEffect(() => {
    cargarCatalogo();
  }, []);

  async function cargarCatalogo() {
    const mapa = new Map<string, any>();

    try {
      const tablas = ['docentes', 'personal_docente', 'personal', 'usuarios', 'profesores', 'participantes'];
      for (const tabla of tablas) {
        try {
          const { data: docs } = await supabase.from(tabla).select('*').limit(300);
          (docs || []).forEach((d: any) => {
            const nom = (d.nombre_completo || d.nombreCompleto || d.nombre || d.nombres || d.name || '').trim();
            if (nom) {
              const k = nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              if (!mapa.has(k)) {
                mapa.set(k, {
                  ...d,
                  nombre_completo: nom.toUpperCase(),
                  rfc: d.rfc || d.RFC || d.clave_rfc || '',
                  curp: d.curp || d.CURP || d.clave_curp || '',
                  departamento: d.departamento || d.depto || d.adscripcion || '',
                  puesto: d.puesto || d.categoria || 'Docente',
                  es_fd: Boolean(d.es_fd || d.rol === 'admin' || d.nivel === 'Funcionario Docente')
                });
              }
            }
          });
        } catch {}
      }
    } catch {}

    try {
      const loc = getLocalDocentes();
      loc.forEach((d: any) => {
        const nom = (d.nombre_completo || d.nombre || '').trim();
        if (nom) {
          const k = nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (!mapa.has(k)) {
            mapa.set(k, {
              ...d,
              nombre_completo: nom.toUpperCase(),
              rfc: d.rfc || '',
              curp: d.curp || '',
              departamento: d.departamento || '',
              puesto: d.puesto || 'Docente',
              es_fd: Boolean(d.es_fd)
            });
          }
        }
      });
    } catch {}

    try {
      const cursos = getLocalCursos();
      cursos.forEach(c => {
        (c.participantes || []).forEach(p => {
          const nom = (p.nombre_completo || '').trim();
          if (nom) {
            const k = nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (!mapa.has(k)) {
              mapa.set(k, {
                nombre_completo: nom.toUpperCase(),
                rfc: p.rfc || '',
                curp: p.curp || '',
                email: p.email || '',
                departamento: p.departamento || '',
                puesto: p.puesto || 'Docente',
                es_fd: Boolean(p.es_fd)
              });
            }
          }
        });
      });
    } catch {}

    setCatalogoDocentes(Array.from(mapa.values()));
  }

  const sugerencias = useMemo(() => {
    const q = tempNombre.trim().toLowerCase();
    if (!q || q.length < 1) return [];
    const palabras = q.split(/\s+/).filter(Boolean);
    return catalogoDocentes.filter(d => {
      const nom = (d.nombre_completo || '').toLowerCase();
      const r = (d.rfc || '').toLowerCase();
      const c = (d.curp || '').toLowerCase();
      const dep = (d.departamento || '').toLowerCase();
      return (
        palabras.every(p => nom.includes(p) || dep.includes(p) || r.includes(p)) ||
        nom.includes(q) || r.includes(q) || c.includes(q) || dep.includes(q)
      );
    }).slice(0, 10);
  }, [catalogoDocentes, tempNombre]);

  function handleSeleccionarDocente(d: any) {
    setTempNombre(d.nombre_completo);
    setTempRfc(d.rfc || '');
    setTempCurp(d.curp || '');
    if (d.departamento) setTempDepto(d.departamento);
    if (d.puesto) setTempPuesto(d.puesto);
    if (d.nivel) setTempNivel(d.nivel);
    setTempEsFD(Boolean(d.es_fd));
    setMostrarSugerencias(false);
  }

  // Bulk paste text
  const [bulkText, setBulkText] = useState('');
  const [mostrarBulk, setMostrarBulk] = useState(false);

  function handleAgregarParticipante(e: React.FormEvent) {
    e.preventDefault();
    if (!tempNombre.trim()) return;

    const p: Participante = {
      id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      nombre_completo: tempNombre.trim().toUpperCase(),
      rfc: tempRfc.trim().toUpperCase(),
      curp: tempCurp.trim().toUpperCase(),
      email: `${tempNombre.trim().split(' ')[0].toLowerCase()}@itdurango.edu.mx`,
      departamento: tempDepto,
      puesto: tempPuesto,
      nivel: tempNivel,
      es_fd: tempEsFD,
      es_d: !tempEsFD,
      asistencias: { L: true, M: true, M2: true, J: true, V: true }
    };

    setParticipantes([...participantes, p]);
    setTempNombre('');
    setTempRfc('');
    setTempCurp('');
  }

  function handleProcesarBulk() {
    if (!bulkText.trim()) return;
    const lineas = bulkText.split('\n');
    const nuevos: Participante[] = [];

    lineas.forEach(linea => {
      const parts = linea.split('\t').length > 1 ? linea.split('\t') : linea.split(',');
      const nombrePart = parts[0]?.trim();
      if (nombrePart) {
        nuevos.push({
          id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          nombre_completo: nombrePart.toUpperCase(),
          rfc: (parts[1] || '').trim().toUpperCase(),
          curp: (parts[2] || '').trim().toUpperCase(),
          email: `${nombrePart.split(' ')[0].toLowerCase()}@itdurango.edu.mx`,
          departamento: parts[3]?.trim() || departamento,
          puesto: 'Docente',
          nivel: 'Docente',
          es_fd: false,
          es_d: true,
          asistencias: { L: true, M: true, M2: true, J: true, V: true }
        });
      }
    });

    if (nuevos.length > 0) {
      setParticipantes([...participantes, ...nuevos]);
      setBulkText('');
      setMostrarBulk(false);
    }
  }

  function handleEliminarParticipante(id: string) {
    setParticipantes(participantes.filter(p => p.id !== id));
  }

  function handleGuardarCurso(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      alert('Por favor ingresa el nombre del curso.');
      return;
    }

    const nuevoCurso: Curso = {
      id: `curso-${Date.now()}`,
      nombre: nombre.trim().toUpperCase(),
      folio: folio.trim(),
      clave: clave.trim(),
      instructor: instructor.trim() || 'No asignado',
      instructor_rfc: instructorRfc.trim().toUpperCase(),
      instructor_curp: instructorCurp.trim().toUpperCase(),
      periodo: periodo.trim(),
      semana: semana.trim(),
      horas: Number(horas) || 30,
      duracion: `${horas} hrs`,
      horario: horario.trim(),
      lugar: lugar.trim(),
      departamento: departamento,
      status: 'activo',
      modalidad: modalidad,
      participantes: participantes.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo))
    };

    const existentes = getLocalCursos();
    saveLocalCursos([nuevoCurso, ...existentes]);
    onCursoCreado();
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onVolver}
          className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al catálogo
        </button>
        <span className="text-xs text-slate-500 font-mono">Formato ITD-AD-FO-8</span>
      </div>

      <form onSubmit={handleGuardarCurso} className="space-y-6">
        {/* Course Main Details */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <BookOpen className="w-5 h-5 text-[#1B396A]" />
            <h2 className="font-bold text-base text-slate-900">Datos Principales del Curso</h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del Curso *</label>
            <input
              type="text"
              required
              placeholder="Ej. ESTRATEGIAS DIDÁCTICAS Y EVALUACIÓN POR COMPETENCIAS"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium focus:ring-2 focus:ring-[#1B396A] focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Folio Institucional</label>
              <input
                type="text"
                required
                value={folio}
                onChange={e => setFolio(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono font-bold text-[#1B396A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Clave</label>
              <input
                type="text"
                value={clave}
                onChange={e => setClave(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Modalidad</label>
              <select
                value={modalidad}
                onChange={e => setModalidad(e.target.value as any)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white"
              >
                <option value="CURSO PRESENCIAL">CURSO PRESENCIAL</option>
                <option value="CURSO VIRTUAL">CURSO VIRTUAL</option>
                <option value="CURSO HÍBRIDO">CURSO HÍBRIDO</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del Instructor (a)</label>
              <input
                type="text"
                required
                placeholder="Dr. / Ing. / M.C."
                value={instructor}
                onChange={e => setInstructor(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">R.F.C. del Instructor</label>
              <input
                type="text"
                placeholder="SOVA750312XX1"
                value={instructorRfc}
                onChange={e => setInstructorRfc(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">CURP del Instructor</label>
              <input
                type="text"
                placeholder="SOVA750312HDGRNN09"
                value={instructorCurp}
                onChange={e => setInstructorCurp(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Periodo (Texto en formato)</label>
              <input
                type="text"
                value={periodo}
                onChange={e => setPeriodo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Duración (Horas)</label>
              <input
                type="number"
                value={horas}
                onChange={e => setHoras(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Horario</label>
              <input
                type="text"
                value={horario}
                onChange={e => setHorario(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Departamento Responsable</label>
              <select
                value={departamento}
                onChange={e => setDepartamento(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white"
              >
                {DEPARTAMENTOS_ITD.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Lugar o Aula</label>
              <input
                type="text"
                value={lugar}
                onChange={e => setLugar(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Participants Registration Block */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#1B396A]" />
              <h2 className="font-bold text-base text-slate-900">
                Participantes para la Lista ({participantes.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setMostrarBulk(!mostrarBulk)}
              className="text-xs text-[#1B396A] font-semibold hover:underline flex items-center gap-1"
            >
              <Upload className="w-3.5 h-3.5" />
              {mostrarBulk ? 'Ocultar Carga Masiva' : 'Importar por Lotes / Pegar Texto'}
            </button>
          </div>

          {/* Bulk Paste Box */}
          {mostrarBulk && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <p className="text-xs font-semibold text-slate-700">
                Pega una lista de participantes (un docente por línea; opcionalmente separado por comas o tabuladores: Nombre, RFC, CURP, Departamento):
              </p>
              <textarea
                rows={4}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={"AGUIRRE SILVA MARCO ANTONIO, AUSA820310H89, AUSA820310HDGRRC04, Sistemas\nBARRAZA FLORES CLAUDIA PATRICIA, BAFC850614M32, BAFC850614MDGRLL01, Sistemas"}
                className="w-full text-xs font-mono p-3 rounded-lg border border-slate-300 bg-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleProcesarBulk}
                  className="px-4 py-1.5 rounded-lg bg-[#1B396A] text-white text-xs font-semibold hover:bg-[#102244]"
                >
                  Agregar a la Lista
                </button>
              </div>
            </div>
          )}

          {/* Manual Add Inline */}
          <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-3">
            <h4 className="text-xs font-semibold text-slate-800">Agregar Docente Individual</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Nombre Completo * (Escribe para autocompletar)"
                  value={tempNombre}
                  onChange={e => {
                    setTempNombre(e.target.value);
                    setMostrarSugerencias(true);
                  }}
                  onFocus={() => {
                    if (tempNombre.trim().length >= 1) setMostrarSugerencias(true);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white uppercase font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {mostrarSugerencias && sugerencias.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-blue-300 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                    <div className="px-2.5 py-1 bg-blue-50 text-[10px] font-bold text-blue-900 flex justify-between">
                      <span>Coincidencias ({sugerencias.length})</span>
                      <span className="text-[9px] text-blue-600 font-normal">Clic para autollenar</span>
                    </div>
                    {sugerencias.map((doc, idx) => (
                      <button
                        key={`${doc.nombre_completo}-${idx}`}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSeleccionarDocente(doc);
                        }}
                        onClick={() => handleSeleccionarDocente(doc)}
                        className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-xs transition flex flex-col gap-0.5 cursor-pointer"
                      >
                        <span className="font-bold text-slate-800 uppercase">{doc.nombre_completo}</span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          {doc.departamento && <span>🏢 {doc.departamento}</span>}
                          {doc.curp && <span>CURP: {doc.curp}</span>}
                          {doc.rfc && <span>RFC: {doc.rfc}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="text"
                placeholder="RFC (Ej. AUSA820310H89)"
                value={tempRfc}
                onChange={e => setTempRfc(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono uppercase bg-white"
              />
              <input
                type="text"
                placeholder="CURP (Ej. AUSA820310HDGRRC04)"
                value={tempCurp}
                onChange={e => setTempCurp(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono uppercase bg-white"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={tempDepto}
                onChange={e => setTempDepto(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
              >
                {DEPARTAMENTOS_ITD.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Puesto (Ej. Docente / Jefe)"
                value={tempPuesto}
                onChange={e => setTempPuesto(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tempEsFD}
                    onChange={e => setTempEsFD(e.target.checked)}
                    className="rounded text-[#1B396A]"
                  />
                  ¿Es Funcionario Docente (FD)?
                </label>
                <button
                  type="button"
                  onClick={handleAgregarParticipante}
                  className="px-3 py-1.5 rounded-lg bg-[#1B396A] text-white text-xs font-semibold hover:bg-[#102244] flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar
                </button>
              </div>
            </div>
          </div>

          {/* List of currently enrolled */}
          {participantes.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">
              Aún no has agregado docentes a la lista de este curso. (Se pueden agregar ahora o más adelante).
            </p>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="p-2 text-center w-8">#</th>
                    <th className="p-2">Nombre</th>
                    <th className="p-2">RFC / CURP</th>
                    <th className="p-2">Departamento</th>
                    <th className="p-2 text-center">Tipo</th>
                    <th className="p-2 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {participantes.map((p, i) => (
                    <tr key={p.id || i} className="hover:bg-slate-50">
                      <td className="p-2 text-center text-slate-400 font-medium">{i + 1}</td>
                      <td className="p-2 font-medium text-slate-800">{p.nombre_completo}</td>
                      <td className="p-2 font-mono text-[11px] text-slate-500">{p.rfc || p.curp || '-'}</td>
                      <td className="p-2 text-slate-600">{p.departamento}</td>
                      <td className="p-2 text-center font-bold text-[11px] text-[#1B396A]">
                        {p.es_fd ? 'FD' : 'D'}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleEliminarParticipante(p.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Submit action */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onVolver}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-[#1B396A] hover:bg-[#102244] text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors"
          >
            <Check className="w-4 h-4" />
            Guardar Curso y Generar Formato
          </button>
        </div>
      </form>
    </div>
  );
}
