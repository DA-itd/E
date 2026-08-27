import React, { useState } from 'react';
import { Curso, Participante } from '../../types';
import { getLocalCursos, saveLocalCursos } from '../../lib/supabaseClient';
import { DEPARTAMENTOS_ITD } from './AdminProyectosDocencia';

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

  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [tempNombre, setTempNombre] = useState('');
  const [tempRfc, setTempRfc] = useState('');
  const [tempCurp, setTempCurp] = useState('');
  const [tempDepto, setTempDepto] = useState(DEPARTAMENTOS_ITD[0]);
  const [tempPuesto, setTempPuesto] = useState('Docente');
  const [tempNivel, setTempNivel] = useState('Docente');
  const [tempEsFD, setTempEsFD] = useState(false);

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
      <div className="flex items-center justify-between">
        <button
          onClick={onVolver}
          className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl transition-colors"
        >
          <span>←</span> Volver al catálogo
        </button>
        <span className="text-xs text-slate-500 font-mono">Formato ITD-AD-FO-8</span>
      </div>

      <form onSubmit={handleGuardarCurso} className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="text-lg">📘</span>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Periodo</label>
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

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-lg">👥</span>
              <h2 className="font-bold text-base text-slate-900">
                Participantes para la Lista ({participantes.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setMostrarBulk(!mostrarBulk)}
              className="text-xs text-[#1B396A] font-semibold hover:underline"
            >
              {mostrarBulk ? 'Ocultar Carga Masiva' : '📥 Importar por Lotes / Pegar'}
            </button>
          </div>

          {mostrarBulk && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <p className="text-xs font-semibold text-slate-700">
                Pega la lista de docentes (un docente por línea):
              </p>
              <textarea
                rows={4}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={"AGUIRRE SILVA MARCO ANTONIO, AUSA820310H89, AUSA820310HDGRRC04, Sistemas"}
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

          <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-3">
            <h4 className="text-xs font-semibold text-slate-800">Agregar Docente Individual</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Nombre Completo *"
                value={tempNombre}
                onChange={e => setTempNombre(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
              />
              <input
                type="text"
                placeholder="RFC"
                value={tempRfc}
                onChange={e => setTempRfc(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono uppercase bg-white"
              />
              <input
                type="text"
                placeholder="CURP"
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
                placeholder="Puesto (Docente / Jefe)"
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
                  ¿Es FD?
                </label>
                <button
                  type="button"
                  onClick={handleAgregarParticipante}
                  className="px-3 py-1.5 rounded-lg bg-[#1B396A] text-white text-xs font-semibold hover:bg-[#102244]"
                >
                  + Agregar
                </button>
              </div>
            </div>
          </div>

          {participantes.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">
              Aún no has agregado docentes a la lista.
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
                          className="text-slate-400 hover:text-rose-600 p-1 font-bold"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onVolver}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-[#1B396A] hover:bg-[#102244] text-white text-xs font-semibold shadow-xs flex items-center gap-2"
          >
            ✓ Guardar Curso y Generar Formato
          </button>
        </div>
      </form>
    </div>
  );
}