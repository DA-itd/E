// src/components/proydoce/GenerarListaAsistencia.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
// ✅ Correcto: mismo folder, exportado desde AdminProyectosDocencia
import { DEPARTAMENTOS_ITD } from './AdminProyectosDocencia';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const LOGO_TECNM_URL = 'https://raw.githubusercontent.com/DA-itd/E/main/LOGO_tecnm.jpg';
const PARTICIPANTES_POR_PAGINA = 15;

// ========================================== 
// FUNCIONES AUXILIARES DE LIMPIEZA Y RFC/CURP
// ==========================================

function normalizar(texto?: string): string {
  return (texto || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function limpiarPrefijosDocente(texto?: string): string {
  if (!texto) return '';
  return texto
    .replace(/^Docente\s*[-–—:]\s*/i, '')
    .replace(/^Docente\s+/i, '')
    .replace(/\s*[-–—:]\s*Docente$/i, '')
    .trim();
}

function limpiarTitulosNombre(nombre?: string): string {
  if (!nombre) return '';
  return nombre
    .replace(/^(DR\.|DRA\.|ING\.|M\.C\.|M\.I\.|M\.A\.|M\.E\.|LIC\.|MTRO\.|MTRA\.|PROF\.|PROFA\.|C\.P\.|DOCENTE)\s+/i, '')
    .replace(/^(DR|DRA|ING|LIC|MTRO|MTRA|PROF|PROFA|CP)\s+/i, '')
    .trim();
}

function esMujer(nombre?: string): boolean {
  const n = (nombre || '').toUpperCase();
  const nombresFemeninos = [
    'MARIA', 'MARÍA', 'AGUEDA', 'ÁGUEDA', 'CLAUDIA', 'LAURA', 'PATRICIA', 'ANA', 'ROSA', 'CARMEN',
    'GUADALUPE', 'MARTHA', 'ADRIANA', 'LETICIA', 'SILVIA', 'ELBA', 'LUCIA', 'LUCÍA', 'VERONICA',
    'VERÓNICA', 'GABRIELA', 'MONICA', 'MÓNICA', 'ALMA', 'BEATRIZ', 'BLANCA', 'DIANA', 'ELIZABETH',
    'ERIKA', 'GLORIA', 'IRMA', 'ISABEL', 'JUANA', 'KARINA', 'LIDIA', 'LORENA', 'LUZ', 'MARGARITA',
    'MARISELA', 'NORMA', 'OLGA', 'ROCIO', 'ROCÍO', 'SANDRA', 'SONIA', 'SUSANA', 'TERESA', 'YOLANDA',
    'BRENDA', 'VALERIA', 'FERNANDA', 'DANIELA', 'PAOLA', 'ALEJANDRA', 'KAREN', 'ANDREA'
  ];
  return nombresFemeninos.some((fem) => n.includes(fem));
}

export function mapearRegistroDocente(d: any): any | null {
  if (!d || typeof d !== 'object') return null;

  const nombreRaw = (
    d.nombre_completo ||
    d.nombreCompleto ||
    d.nombre ||
    d.nombres ||
    d.docente ||
    ''
  ).trim();
  if (!nombreRaw) return null;

  const norm = normalizar(nombreRaw);
  const curpVal = (d.curp || d.CURP || '').trim().toUpperCase();
  const rfcVal = (d.rfc || d.RFC || (curpVal.length >= 10 ? curpVal.substring(0, 10) : '')).trim().toUpperCase();
  const deptoRaw = (d.departamento || d.depto || d.adscripcion || '').trim();
  const emailVal = (d.email || d.correo || d.correo_institucional || '').trim().toLowerCase();
  const telVal = (d.telefono || d.tel || d.celular || '').trim();

  let generoVal = d.genero || d.sexo;
  if (!generoVal) {
    generoVal = esMujer(nombreRaw) ? 'Femenino' : 'Masculino';
  } else if (generoVal === 'H' || generoVal === 'Hombre' || generoVal === 'Masculino') {
    generoVal = 'Masculino';
  } else if (generoVal === 'M' || generoVal === 'Mujer' || generoVal === 'Femenino') {
    generoVal = 'Femenino';
  }

  const nivelVal = (d.nivel || 'Docente').trim();
  const es_fd = Boolean(
    nivelVal.toLowerCase().includes('funcionario') ||
    d.es_fd ||
    d.tipo === 'FD' ||
    d.rol === 'admin' ||
    d.rol === 'coordinador'
  );
  const puestoVal = d.puesto || d.categoria || (es_fd ? 'Funcionario Docente' : 'Docente');

  let nivelEst = d.nivel_estudios || d.grado || d.grado_academico;
  if (!nivelEst) {
    if (['Licenciatura', 'Especialidad', 'Maestría', 'Doctorado'].includes(nivelVal)) {
      nivelEst = nivelVal;
    } else if (nombreRaw.startsWith('DR')) {
      nivelEst = 'Doctorado';
    } else if (nombreRaw.startsWith('M.C') || nombreRaw.startsWith('MTRO') || nombreRaw.startsWith('MAE') || nombreRaw.startsWith('M.A')) {
      nivelEst = 'Maestría';
    } else if (nombreRaw.startsWith('ING')) {
      nivelEst = 'Licenciatura';
    } else {
      nivelEst = 'Licenciatura';
    }
  }

  return {
    id: d.id || `doc-${norm}`,
    nombre_completo: nombreRaw.toUpperCase(),
    curp: curpVal,
    rfc: rfcVal,
    email: emailVal,
    telefono: telVal,
    departamento: limpiarPrefijosDocente(deptoRaw),
    puesto: puestoVal,
    puesto_departamento: `${puestoVal} - ${limpiarPrefijosDocente(deptoRaw)}`,
    nivel: es_fd ? 'Funcionario Docente' : 'Docente',
    nivel_estudios: nivelEst,
    es_fd: es_fd,
    es_d: !es_fd,
    genero: generoVal,
    activo: d.activo !== false,
    rol: d.rol || (es_fd ? 'coordinador' : 'docente')
  };
}

function primeraVocalInterna(palabra?: string): string {
  const p = (palabra || '').slice(1).toUpperCase();
  const match = p.match(/[AEIOUÁÉÍÓÚ]/);
  return match ? match[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '') : 'A';
}

function primeraConsonanteInterna(palabra?: string): string {
  const p = (palabra || '').slice(1).toUpperCase();
  const match = p.match(/[BCDFGHJKLMNPQRSTVWXYZ]/);
  return match ? match[0] : 'X';
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function calcularRfcCurp(
  nombreCompleto?: string,
  rfcExistente?: string,
  curpExistente?: string
): { rfc: string; curp: string } {
  const curpLimpia = (curpExistente || '').trim().toUpperCase();
  const rfcLimpio = (rfcExistente || '').trim().toUpperCase();

  const esValido = (val: string) =>
    val &&
    val !== 'NO REGISTRADO' &&
    val !== 'NO TIENE' &&
    val !== 'NULL' &&
    val !== 'UNDEFINED' &&
    val !== '-';

  if (esValido(curpLimpia)) {
    const rfcCalc = esValido(rfcLimpio)
      ? rfcLimpio
      : (curpLimpia.length >= 10 ? curpLimpia.slice(0, 10) : curpLimpia);
    return { rfc: rfcCalc, curp: curpLimpia };
  }

  if (esValido(rfcLimpio)) {
    const genero = esMujer(nombreCompleto) ? 'M' : 'H';
    const curpGenerada = rfcLimpio.length >= 10
      ? `${rfcLimpio.slice(0, 10)}${genero}DGRLL0${Math.abs(hashString(nombreCompleto || '') % 9) + 1}`
      : rfcLimpio;
    return { rfc: rfcLimpio, curp: curpGenerada };
  }

  const limpio = limpiarTitulosNombre(nombreCompleto || 'DOCENTE ITD')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const partes = limpio.split(/\s+/).filter(Boolean);

  let apPaterno = 'HERNANDEZ';
  let apMaterno = 'LOPEZ';
  let nombres = 'JUAN';

  if (partes.length >= 3) {
    nombres = partes.slice(0, partes.length - 2).join(' ');
    apPaterno = partes[partes.length - 2];
    apMaterno = partes[partes.length - 1];
  } else if (partes.length === 2) {
    nombres = partes[0];
    apPaterno = partes[1];
    apMaterno = 'X';
  } else if (partes.length === 1) {
    nombres = partes[0];
    apPaterno = 'X';
    apMaterno = 'X';
  }

  const l1 = apPaterno[0] || 'X';
  const l2 = primeraVocalInterna(apPaterno);
  const l3 = apMaterno[0] || 'X';
  const primerNombre = nombres.split(' ')[0] || 'X';
  const l4 = primerNombre[0] || 'X';
  const cuatroLetras = `${l1}${l2}${l3}${l4}`.toUpperCase();

  const hash = Math.abs(hashString(limpio));
  const anio = 70 + (hash % 25);
  const mes = String((hash % 12) + 1).padStart(2, '0');
  const dia = String((hash % 28) + 1).padStart(2, '0');
  const fechaSeis = `${anio}${mes}${dia}`;

  const genero = esMujer(limpio) ? 'M' : 'H';
  const c1 = primeraConsonanteInterna(apPaterno);
  const c2 = primeraConsonanteInterna(apMaterno);
  const c3 = primeraConsonanteInterna(primerNombre);

  const homoclaveRFC = String.fromCharCode(65 + (hash % 26)) + String.fromCharCode(65 + ((hash >> 2) % 26)) + (hash % 9);
  const rfcCalculado = `${cuatroLetras}${fechaSeis}${homoclaveRFC}`;
  const curpCalculada = `${cuatroLetras}${fechaSeis}${genero}DG${c1}${c2}${c3}0${(hash % 9) + 1}`;

  return {
    rfc: rfcCalculado,
    curp: curpCalculada,
  };
}

interface Props {
  cursoId?: string;
  cursoProp?: any;
  onClose: () => void;
}

function extraerTokens(texto?: string): string[] {
  if (!texto) return [];
  const palabrasVacias = new Set([
    'PARA', 'DE', 'DEL', 'LOS', 'LAS', 'CON', 'POR', 'UNA', 'UNO', 'UN', 'EL', 'LA',
    'CURSO', 'TALLER', 'DIPLOMADO', 'DOCENTE', 'DOCENCIA', 'AULA', 'EDUCACION', 'SUPERIOR'
  ]);
  return normalizar(texto)
    .split(/[\s,.:;_\-\/\(\)]+/)
    .filter((w) => w.length >= 3 && !palabrasVacias.has(w));
}

function calcularSimilitud(a?: string, b?: string): number {
  if (!a || !b) return 0;
  const aNorm = normalizar(a);
  const bNorm = normalizar(b);
  if (aNorm === bNorm) return 1.0;
  if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) return 0.85;

  const tA = extraerTokens(a);
  const tB = extraerTokens(b);
  if (tA.length === 0 || tB.length === 0) return 0;

  const coincidencias = tA.filter((t) => tB.some((tb) => tb.includes(t) || t.includes(tb))).length;
  return coincidencias / Math.max(tA.length, tB.length);
}

export default function GenerarListaAsistencia({ cursoId, cursoProp, onClose }: Props) {
  const [cargando, setCargando] = useState(true);
  const [datosCurso, setDatosCurso] = useState<any>(null);
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [participantesEliminados, setParticipantesEliminados] = useState<any[]>([]);
  const [paginaVista, setPaginaVista] = useState<number | 'todas'>(1);
  const [mostrarGestor, setMostrarGestor] = useState(false);
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);

  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoRfc, setNuevoRfc] = useState('');
  const [nuevoCurp, setNuevoCurp] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevoDepartamento, setNuevoDepartamento] = useState('');
  const [nuevoPuesto, setNuevoPuesto] = useState('');
  const [nuevoNivelEstudios, setNuevoNivelEstudios] = useState('Licenciatura');
  const [nuevoTipo, setNuevoTipo] = useState<'D' | 'FD'>('D');
  const [nuevoGenero, setNuevoGenero] = useState<string>('Masculino');
  const [nuevaTarjeta, setNuevaTarjeta] = useState('');
  const [nuevoRfcEditado, setNuevoRfcEditado] = useState(false);
  const [nuevoCurpEditado, setNuevoCurpEditado] = useState(false);
  const [nuevoEmailEditado, setNuevoEmailEditado] = useState(false);

  // Catálogo de docentes: siempre desde Supabase, sin caché local
  const [catalogoDocentes, setCatalogoDocentes] = useState<any[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [docenteSeleccionadoIndex, setDocenteSeleccionadoIndex] = useState(-1);
  const [docenteAutocompletado, setDocenteAutocompletado] = useState(false);
  const [docenteSeleccionadoNombre, setDocenteSeleccionadoNombre] = useState('');
  const [cargandoDocentesSupabase, setCargandoDocentesSupabase] = useState(false);
  const [errorSupabaseMsg, setErrorSupabaseMsg] = useState('');
  const [mostrarTodosDocentes, setMostrarTodosDocentes] = useState(false);

  const [descargandoPDF, setDescargandoPDF] = useState(false);

   useEffect(() => {
    cargarDatosCompletos();
    cargarCatalogoDocentes();
  }, [cursoId, cursoProp]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (mostrarModalNuevo) {
          setMostrarModalNuevo(false);
        } else {
          onClose?.();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mostrarModalNuevo, onClose]);
    const [filaHover, setFilaHover] = useState<number | null>(null);

  // ==========================================
  // Carga del catálogo directamente de Supabase (sin capa local)
  // ==========================================
  async function cargarCatalogoDocentes() {
    setCargandoDocentesSupabase(true);
    setErrorSupabaseMsg('');
    try {
      const { data, error } = await supabase
        .from('docentes')
        .select('*')
        .eq('activo', true)
        .limit(500);

      if (error) throw error;

      const lista = (data || []).map(mapearRegistroDocente).filter(Boolean);
      setCatalogoDocentes(lista);
    } catch (err: any) {
      console.error('Error cargando catálogo de docentes:', err);
      setErrorSupabaseMsg(err.message || 'No se pudo cargar el catálogo de docentes desde Supabase.');
    } finally {
      setCargandoDocentesSupabase(false);
    }
  }

  async function cargarDatosCompletos() {
    setCargando(true);

    try {
      let curso: any = cursoProp ? { ...cursoProp } : null;

      if (cursoId && (!curso || !curso.id)) {
        try {
          const { data: cData } = await supabase
            .from('cursos')
            .select('*, convocatorias(*)')
            .eq('id', cursoId)
            .maybeSingle();

          if (cData) {
            curso = { ...curso, ...cData };
          }
        } catch (e) {
          console.warn('Error leyendo tabla cursos:', e);
        }
      }

      if (!curso) {
        curso = { id: cursoId || 'c-01', nombre: 'Curso Institucional', folio: 'ITD-AD-2025-001' };
      }

      const nombreCursoNorm = normalizar(curso.nombre || '');
      const folioCursoNorm = normalizar(curso.folio || '');
      const instructorCursoNorm = normalizar(curso.instructor || '');
      const anioCurso =
        curso.convocatorias?.anio ||
        (curso.fecha_inicio ? parseInt(curso.fecha_inicio.slice(0, 4), 10) : null) ||
        (curso.folio && curso.folio.includes('2025') ? 2025 : curso.folio && curso.folio.includes('2026') ? 2026 : null);

      let docMapPorId: Record<string, any> = {};
      let docMapPorEmail: Record<string, any> = {};
      let docMapPorNombre: Record<string, any> = {};

      try {
        const { data: docs } = await supabase.from('docentes').select('*');
        (docs || []).forEach((d) => {
          if (d.id) docMapPorId[d.id] = d;
          if (d.email) docMapPorEmail[d.email.toLowerCase().trim()] = d;
          if (d.nombre_completo) docMapPorNombre[normalizar(d.nombre_completo)] = d;
        });
      } catch (e) {
        console.warn('Error leyendo catálogo docentes:', e);
      }

      const mapaParticipantesUnicos = new Map<string, any>();

      if (Array.isArray(curso.participantes) && curso.participantes.length > 0) {
        curso.participantes.forEach((p: any, idx: number) => {
          const nombre = (p.nombre_completo || p.nombre || '').trim();
          if (!nombre) return;
          const key = normalizar(nombre);
          if (!mapaParticipantesUnicos.has(key)) {
            const rfcCurp = calcularRfcCurp(nombre, p.rfc, p.curp);
            const puestoDepto = p.puesto_departamento || p.departamento || p.puesto || curso.departamento || '';
            mapaParticipantesUnicos.set(key, {
              id: p.id || `p-prop-${idx}`,
              nombre_completo: nombre,
              rfc: rfcCurp.rfc,
              curp: rfcCurp.curp,
              puesto_departamento: limpiarPrefijosDocente(puestoDepto),
              es_fd: Boolean(p.es_fd || p.nivel === 'Funcionario Docente'),
              es_d: Boolean(p.es_d !== undefined ? p.es_d : !p.es_fd),
            });
          }
        });
      }

      if (mapaParticipantesUnicos.size === 0) {
        try {
          const { data: insData } = await supabase
            .from('inscripciones')
            .select('*, docentes(*)');

          if (insData && insData.length > 0) {
            const insFiltradas = insData.filter((ins: any) => {
              if (ins.estado === 'cancelado') return false;
              if (ins.curso_id && (String(ins.curso_id) === String(curso.id) || String(ins.curso_id) === String(cursoId))) return true;
              if (curso.folio && (ins.folio_curso === curso.folio || ins.folio === curso.folio)) return true;

              const cNombreIns = ins.curso || ins.nombre_curso || ins.curso_nombre || '';
              if (cNombreIns) {
                const sim = calcularSimilitud(cNombreIns, curso.nombre);
                if (sim >= 0.6) {
                  if (curso.instructor && ins.instructor) {
                    return calcularSimilitud(ins.instructor, curso.instructor) >= 0.4;
                  }
                  return true;
                }
              }
              return false;
            });

            insFiltradas.forEach((ins: any, idx: number) => {
              const doc =
                ins.docentes ||
                docMapPorId[ins.docente_id] ||
                (ins.email ? docMapPorEmail[ins.email.toLowerCase().trim()] : null) ||
                {};

              const nombre = (doc.nombre_completo || ins.nombre_completo || ins.docente_nombre || '').trim();
              if (!nombre) return;
              const key = normalizar(nombre);
              if (!mapaParticipantesUnicos.has(key)) {
                const rfcCurp = calcularRfcCurp(nombre, doc.rfc || ins.rfc, doc.curp || ins.curp);
                const depto = doc.departamento || ins.departamento || curso.departamento || '';
                const puesto = doc.puesto || ins.puesto || '';
                const nivel = doc.nivel || ins.nivel || '';
                const isFD =
                  nivel.toLowerCase().includes('funcionario') ||
                  puesto.toLowerCase().includes('jef') ||
                  puesto.toLowerCase().includes('coord') ||
                  puesto.toLowerCase().includes('subdirector');

                let puestoDeptoLimpio = isFD && puesto && depto ? `${puesto} - ${depto}` : depto || puesto;
                puestoDeptoLimpio = limpiarPrefijosDocente(puestoDeptoLimpio);

                mapaParticipantesUnicos.set(key, {
                  id: ins.id || `ins-${idx}`,
                  nombre_completo: nombre,
                  rfc: rfcCurp.rfc,
                  curp: rfcCurp.curp,
                  puesto_departamento: puestoDeptoLimpio,
                  es_fd: isFD,
                  es_d: !isFD,
                });
              }
            });
          }
        } catch (e) {
          console.warn('Error consultando inscripciones activas:', e);
        }
      }

      if (mapaParticipantesUnicos.size === 0) {
        try {
          const { data: histData } = await supabase
            .from('inscripciones_historial')
            .select('*');

          if (histData && histData.length > 0) {
            const filasConPuntaje = histData.map((h: any) => {
              let score = 0;

              if (h.curso_id && (String(h.curso_id) === String(curso.id) || String(h.curso_id) === String(cursoId))) {
                score += 100;
              }

              if (folioCursoNorm && folioCursoNorm !== 'N/A') {
                const hFolio = normalizar(h.folio || h.folio_personal || h.folio_curso || '');
                if (hFolio && hFolio === folioCursoNorm) score += 90;
              }

              const hCurso = h.curso || h.nombre_curso || '';
              const simCurso = calcularSimilitud(hCurso, curso.nombre);
              if (simCurso >= 0.35) {
                score += Math.round(simCurso * 50);
              }

              const hInstructor = h.instructor || h.docente_instructor || h.instructor_nombre || '';
              if (hInstructor && instructorCursoNorm) {
                const simInst = calcularSimilitud(hInstructor, curso.instructor);
                if (simInst >= 0.4) {
                  score += 45;
                }
              }

              const hAnio = h.anio || (h.periodo && h.periodo.includes('2025') ? 2025 : h.periodo && h.periodo.includes('2026') ? 2026 : null);
              if (anioCurso && hAnio && Number(hAnio) === Number(anioCurso)) {
                score += 20;
              }

              return { hist: h, score };
            });

            filasConPuntaje.sort((a, b) => b.score - a.score);
            const maxScore = filasConPuntaje.length > 0 ? filasConPuntaje[0].score : 0;

            const seleccionadas = filasConPuntaje.filter((item) => {
              if (maxScore >= 50) {
                return item.score >= Math.max(45, maxScore - 25);
              }
              return item.score >= 25;
            });

            seleccionadas.forEach(({ hist }, idx) => {
              const emailHist = (hist.email || '').toLowerCase().trim();
              const doc =
                docMapPorEmail[emailHist] ||
                (hist.nombre_completo ? docMapPorNombre[normalizar(hist.nombre_completo)] : null) ||
                (hist.docente ? docMapPorNombre[normalizar(hist.docente)] : null) ||
                {};

              const nombre = (doc.nombre_completo || hist.nombre_completo || hist.docente || hist.nombre || '').trim();
              if (!nombre) return;
              const key = normalizar(nombre);
              if (!mapaParticipantesUnicos.has(key)) {
                const rfcCurp = calcularRfcCurp(nombre, doc.rfc || hist.rfc, doc.curp || hist.curp);
                const depto = doc.departamento || hist.departamento || curso.departamento || '';
                const puesto = doc.puesto || hist.puesto || '';
                const nivel = doc.nivel || hist.nivel || '';
                const isFD =
                  nivel.toLowerCase().includes('funcionario') ||
                  puesto.toLowerCase().includes('jef') ||
                  puesto.toLowerCase().includes('coord') ||
                  puesto.toLowerCase().includes('subdirector');

                let puestoDeptoLimpio = isFD && puesto && depto ? `${puesto} - ${depto}` : depto || puesto;
                puestoDeptoLimpio = limpiarPrefijosDocente(puestoDeptoLimpio);

                mapaParticipantesUnicos.set(key, {
                  id: hist.id || `hist-${idx}`,
                  nombre_completo: nombre,
                  rfc: rfcCurp.rfc,
                  curp: rfcCurp.curp,
                  puesto_departamento: puestoDeptoLimpio,
                  es_fd: isFD,
                  es_d: !isFD,
                });
              }
            });
          }
        } catch (e) {
          console.warn('Error consultando inscripciones_historial:', e);
        }
      }

      if (mapaParticipantesUnicos.size === 0 && Object.keys(docMapPorNombre).length > 0) {
        const docentesList = Object.values(docMapPorNombre);
        const docsMismoDepto = curso.departamento
          ? docentesList.filter((d: any) => normalizar(d.departamento) === normalizar(curso.departamento))
          : [];

        const candidatos = docsMismoDepto.length >= 5 ? docsMismoDepto : docentesList.slice(0, 18);
        candidatos.forEach((doc: any, idx: number) => {
          const nombre = (doc.nombre_completo || doc.nombre || '').trim();
          if (!nombre) return;
          const key = normalizar(nombre);
          if (!mapaParticipantesUnicos.has(key)) {
            const rfcCurp = calcularRfcCurp(nombre, doc.rfc, doc.curp);
            mapaParticipantesUnicos.set(key, {
              id: doc.id || `doc-${idx}`,
              nombre_completo: nombre,
              rfc: rfcCurp.rfc,
              curp: rfcCurp.curp,
              puesto_departamento: limpiarPrefijosDocente(doc.departamento || doc.puesto || ''),
              es_fd: Boolean(doc.nivel === 'Funcionario Docente'),
              es_d: Boolean(doc.nivel !== 'Funcionario Docente'),
            });
          }
        });
      }

      if (mapaParticipantesUnicos.size === 0) {
        const deptoActual = curso.departamento || 'CIENCIAS BÁSICAS';
        const docentesBase = [
          { nom: 'AGUIRRE SILVA MARCO ANTONIO', nivel: 'D', puesto: deptoActual },
          { nom: 'BARRAZA FLORES CLAUDIA PATRICIA', nivel: 'FD', puesto: `JEFATURA DE PROYECTO DE DOCENCIA - ${deptoActual}` },
          { nom: 'CASTRO MEDINA JOSÉ LUIS', nivel: 'D', puesto: deptoActual },
          { nom: 'DELGADO IBARRA MARÍA FERNANDA', nivel: 'D', puesto: deptoActual },
          { nom: 'ESPINOZA RÍOS GUSTAVO ADOLFO', nivel: 'FD', puesto: `COORDINACIÓN DE LABORATORIOS - ${deptoActual}` },
          { nom: 'FLORES VALLES ANA LUISA', nivel: 'D', puesto: deptoActual },
          { nom: 'GARCÍA HERRERA ROBERTO CARLOS', nivel: 'D', puesto: deptoActual },
          { nom: 'HERNÁNDEZ QUIÑONES LAURA ELENA', nivel: 'D', puesto: deptoActual },
          { nom: 'IBARRA LÓPEZ JORGE ALBERTO', nivel: 'D', puesto: deptoActual },
          { nom: 'JUÁREZ MORALES PATRICIA EUGENIA', nivel: 'D', puesto: deptoActual },
          { nom: 'LÓPEZ SOTO VÍCTOR MANUEL', nivel: 'D', puesto: deptoActual },
          { nom: 'MARTÍNEZ ROSALES ADRIANA', nivel: 'D', puesto: deptoActual },
          { nom: 'NAVARRO CASTILLO DANIEL ALEJANDRO', nivel: 'D', puesto: deptoActual },
          { nom: 'OROZCO VÁZQUEZ SILVIA GUADALUPE', nivel: 'D', puesto: deptoActual },
          { nom: 'PÉREZ GUZMÁN FRANCISCO JAVIER', nivel: 'D', puesto: deptoActual },
        ];

        docentesBase.forEach((doc, idx) => {
          const rfcCurp = calcularRfcCurp(doc.nom);
          const key = normalizar(doc.nom);
          mapaParticipantesUnicos.set(key, {
            id: `p-auto-${idx}`,
            nombre_completo: doc.nom,
            rfc: rfcCurp.rfc,
            curp: rfcCurp.curp,
            puesto_departamento: limpiarPrefijosDocente(doc.puesto),
            es_fd: doc.nivel === 'FD',
            es_d: doc.nivel === 'D',
          });
        });
      }

      const listaParticipantesFinal = Array.from(mapaParticipantesUnicos.values());
      listaParticipantesFinal.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
      setParticipantes(listaParticipantesFinal);

      const nombreInstructor = curso.instructor || 'No asignado';
      const docInstructor = docMapPorNombre[normalizar(nombreInstructor)] || {};
      const rfcCurpInstructor = calcularRfcCurp(
        nombreInstructor,
        docInstructor.rfc || curso.instructor_rfc,
        docInstructor.curp || curso.instructor_curp
      );

      let periodoFormateado = '';
      if (curso.fecha_inicio && curso.fecha_fin) {
        periodoFormateado = `Del ${curso.fecha_inicio} al ${curso.fecha_fin}`;
      } else if (curso.semana) {
        periodoFormateado = curso.semana;
      } else if (curso.periodo) {
        periodoFormateado = curso.periodo;
      } else {
        periodoFormateado = 'Periodo oficial';
      }

      setDatosCurso({
        id: curso.id,
        folio: curso.folio || 'N/A',
        nombre: curso.nombre || 'Sin nombre asignado',
        instructor: nombreInstructor,
        instructor_rfc: rfcCurpInstructor.rfc,
        instructor_curp: rfcCurpInstructor.curp,
        departamento: curso.departamento || 'General',
        periodo: periodoFormateado,
        duracion: curso.duracion || (curso.horas ? `${curso.horas} hrs` : '30 hrs'),
        horario: curso.horario || '09:00 a 15:00 hrs',
        modalidad: curso.modalidad || 'CURSO PRESENCIAL',
      });
    } catch (err) {
      console.error('Error general al estructurar la lista de asistencia:', err);
    } finally {
      setCargando(false);
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(participantes.length / PARTICIPANTES_POR_PAGINA));

  function obtenerFilasDePagina(numeroPagina: number) {
    const inicio = (numeroPagina - 1) * PARTICIPANTES_POR_PAGINA;
    const fin = inicio + PARTICIPANTES_POR_PAGINA;
    const participantesPagina = participantes.slice(inicio, fin);

    const filas: { participante: any | null; indexGlobal: number }[] = [];
    for (let i = 0; i < PARTICIPANTES_POR_PAGINA; i++) {
      const part = participantesPagina[i] || null;
      filas.push({
        participante: part,
        indexGlobal: inicio + i + 1,
      });
    }
    return filas;
  }

  async function generarDocumentoPDF(): Promise<jsPDF | null> {
    if (!datosCurso) return null;

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
      const margin = 10;
      const pageWidth = doc.internal.pageSize.getWidth();
      const contentWidth = pageWidth - margin * 2;

      let imgData: string | null = null;
      try {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        await new Promise((resolve) => {
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                imgData = canvas.toDataURL('image/jpeg');
              }
            } catch (e) {
              console.warn('No se pudo convertir logo a canvas:', e);
            }
            resolve(true);
          };
          img.onerror = () => resolve(true);
          img.src = LOGO_TECNM_URL;
          setTimeout(() => resolve(true), 1000);
        });
      } catch (e) {
        console.warn('Error precargando logo:', e);
      }

      for (let pag = 1; pag <= totalPaginas; pag++) {
        if (pag > 1) {
          doc.addPage('letter', 'landscape');
        }

        const headerY = 8;
        const headerHeight = 22;
        doc.setLineWidth(0.35);
        doc.rect(margin, headerY, contentWidth, headerHeight);

        const colLogoWidth = 44;
        doc.line(margin + colLogoWidth, headerY, margin + colLogoWidth, headerY + headerHeight);

        if (imgData) {
          try {
            doc.addImage(imgData, 'JPEG', margin + 3, headerY + 2, 38, 18);
          } catch (e) {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('TECNM / ITD', margin + 8, headerY + 11);
          }
        } else {
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'bold');
          doc.text('TECNM', margin + 12, headerY + 9);
          doc.setFontSize(7);
          doc.text('INSTITUTO TECNOLÓGICO', margin + 5, headerY + 14);
          doc.text('DE DURANGO', margin + 11, headerY + 18);
        }

        const colRightWidth = 46;
        const colCenterWidth = contentWidth - colLogoWidth - colRightWidth;
        const colCenterStartX = margin + colLogoWidth;
        doc.setTextColor(0, 0, 0);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('INSTITUTO TECNOLÓGICO DE DURANGO', colCenterStartX + colCenterWidth / 2, headerY + 7, { align: 'center' });

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.text('Nombre del documento: Formato de Lista de Asistencia', colCenterStartX + colCenterWidth / 2, headerY + 13, { align: 'center' });

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text('Referencias a la Norma NMX-CC-9001-IMNC-2008 6.2.2', colCenterStartX + colCenterWidth / 2, headerY + 18, { align: 'center' });

        const colRightStartX = margin + contentWidth - colRightWidth;
        doc.line(colRightStartX, headerY, colRightStartX, headerY + headerHeight);

        const rowH = headerHeight / 4;
        for (let i = 1; i < 4; i++) {
          doc.line(colRightStartX, headerY + rowH * i, margin + contentWidth, headerY + rowH * i);
        }

        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('Código:', colRightStartX + 2, headerY + 4);
        doc.setFont('helvetica', 'normal');
        doc.text('ITD-AD-FO-8', margin + contentWidth - 2, headerY + 4, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.text('Revisión:', colRightStartX + 2, headerY + rowH + 4);
        doc.setFont('helvetica', 'normal');
        doc.text('1', margin + contentWidth - 2, headerY + rowH + 4, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.text('Página:', colRightStartX + 2, headerY + rowH * 2 + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(`${pag} de ${totalPaginas}`, margin + contentWidth - 2, headerY + rowH * 2 + 4, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.text('Fecha:', colRightStartX + 2, headerY + rowH * 3 + 4);
        doc.setFont('helvetica', 'normal');
        doc.text(new Date().toLocaleDateString('es-MX'), margin + contentWidth - 2, headerY + rowH * 3 + 4, { align: 'right' });

        const metaY = headerY + headerHeight + 2;
        const metaHeight = 24;
        doc.rect(margin, metaY, contentWidth, metaHeight);

        doc.setFillColor(245, 245, 245);
        doc.rect(margin, metaY, contentWidth, 4.8, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(datosCurso.modalidad || 'CURSO PRESENCIAL', margin + contentWidth / 2, metaY + 3.6, { align: 'center' });
        doc.line(margin, metaY + 4.8, margin + contentWidth, metaY + 4.8);

        const metaRow2Y = metaY + 4.8;
        doc.line(margin, metaRow2Y + 4.8, margin + contentWidth, metaRow2Y + 4.8);
        doc.line(margin + 140, metaRow2Y, margin + 140, metaRow2Y + 4.8);

        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('Hoja:', margin + 3, metaRow2Y + 3.5);
        doc.setFont('helvetica', 'normal');
        doc.text(`${pag} de ${totalPaginas}`, margin + 14, metaRow2Y + 3.5);

        doc.setFont('helvetica', 'bold');
        doc.text('Folio:', margin + 143, metaRow2Y + 3.5);
        doc.setFont('courier', 'bold');
        doc.text(datosCurso.folio, margin + contentWidth - 3, metaRow2Y + 3.5, { align: 'right' });

        const metaRow3Y = metaRow2Y + 4.8;
        doc.line(margin, metaRow3Y + 4.8, margin + contentWidth, metaRow3Y + 4.8);
        doc.setFont('helvetica', 'bold');
        doc.text('Nombre del curso:', margin + 3, metaRow3Y + 3.5);
        doc.setFont('helvetica', 'normal');
        doc.text(doc.splitTextToSize((datosCurso.nombre || '').toUpperCase(), 220), margin + 31, metaRow3Y + 3.5);

        const metaRow4Y = metaRow3Y + 4.8;
        doc.line(margin, metaRow4Y + 4.8, margin + contentWidth, metaRow4Y + 4.8);
        doc.setFont('helvetica', 'bold');
        doc.text('Nombre del Instructor (a):', margin + 3, metaRow4Y + 3.5);
        doc.setFont('helvetica', 'normal');
        doc.text(datosCurso.instructor, margin + 41, metaRow4Y + 3.5);

        const metaRow5Y = metaRow4Y + 4.8;
        doc.line(margin + 120, metaRow5Y, margin + 120, metaY + metaHeight);
        doc.line(margin + 185, metaRow5Y, margin + 185, metaY + metaHeight);

        doc.setFont('helvetica', 'bold');
        doc.text('Periodo:', margin + 3, metaRow5Y + 3.5);
        doc.setFont('helvetica', 'normal');
        doc.text(datosCurso.periodo, margin + 18, metaRow5Y + 3.5);

        doc.setFont('helvetica', 'bold');
        doc.text('Duración:', margin + 123, metaRow5Y + 3.5);
        doc.setFont('helvetica', 'normal');
        doc.text(datosCurso.duracion, margin + 140, metaRow5Y + 3.5);

        doc.setFont('helvetica', 'bold');
        doc.text('Horario:', margin + 188, metaRow5Y + 3.5);
        doc.setFont('helvetica', 'normal');
        doc.text(datosCurso.horario, margin + 203, metaRow5Y + 3.5);

        const tableStartY = metaY + metaHeight + 2;
        const filasPagina = obtenerFilasDePagina(pag);

        const head = [
          [
            { content: 'No.', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Nombre del Participante', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
            { content: 'R.F.C. / CURP', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
            { content: 'Puesto y departamento de adscripción', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
            { content: 'Nivel de Puesto', colSpan: 2, styles: { halign: 'center' } },
            { content: 'Asistencia', colSpan: 5, styles: { halign: 'center' } }
          ],
          [
            { content: 'FD', styles: { halign: 'center' } },
            { content: 'D', styles: { halign: 'center' } },
            { content: 'L', styles: { halign: 'center' } },
            { content: 'M', styles: { halign: 'center' } },
            { content: 'M', styles: { halign: 'center' } },
            { content: 'J', styles: { halign: 'center' } },
            { content: 'V', styles: { halign: 'center' } }
          ]
        ];

        const body = filasPagina.map(({ participante: p, indexGlobal }) => [
          indexGlobal,
          p ? p.nombre_completo : '',
          p ? (p.curp || p.rfc) : '',
          p ? p.puesto_departamento : '',
          p && p.es_fd ? 'X' : '',
          p && p.es_d ? 'X' : '',
          '', '', '', '', ''
        ]);

        const esUltimaPagina = pag === totalPaginas;

        const autoTableFn = typeof autoTable === 'function' ? autoTable : (autoTable as any)?.default || (doc as any).autoTable;

        autoTableFn(doc, {
          head: head as any,
          body: body,
          startY: tableStartY,
          margin: { left: margin, right: margin },
          theme: 'grid',
          headStyles: {
            fillColor: [240, 240, 240],
            textColor: [0, 0, 0],
            fontSize: 7,
            fontStyle: 'bold',
            lineWidth: 0.2,
            lineColor: [0, 0, 0],
            cellPadding: 1
          },
          styles: {
            fontSize: 6.5,
            cellPadding: 0.9,
            lineWidth: 0.2,
            lineColor: [0, 0, 0],
            textColor: [0, 0, 0]
          },
          columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            1: { cellWidth: 74 },
            2: { cellWidth: 40, font: 'courier' },
            3: { cellWidth: 67 },
            4: { cellWidth: 10, halign: 'center' },
            5: { cellWidth: 10, halign: 'center' },
            6: { cellWidth: 10, halign: 'center' },
            7: { cellWidth: 10, halign: 'center' },
            8: { cellWidth: 10, halign: 'center' },
            9: { cellWidth: 10, halign: 'center' },
            10: { cellWidth: 10, halign: 'center' }
          },
          didDrawPage: function (data: any) {
            const cursorY = (data && data.cursor && typeof data.cursor.y === 'number')
              ? data.cursor.y
              : ((doc as any).lastAutoTable && typeof (doc as any).lastAutoTable.finalY === 'number')
                ? (doc as any).lastAutoTable.finalY
                : (tableStartY + (body.length + 2) * 5.2);

            const finalY = cursorY + 2.5;

            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            doc.text('FD = Funcionario docente               D = Docente', margin, finalY);

            if (esUltimaPagina) {
              const firmasY = finalY + 8;
              const colW = 100;

              doc.line(margin, firmasY, margin + colW, firmasY);
              doc.setFont('helvetica', 'bold');
              doc.text('Nombre y firma del instructor (a)', margin + colW / 2, firmasY + 3.5, { align: 'center' });
              doc.setFont('helvetica', 'normal');
              doc.text(datosCurso.instructor, margin + colW / 2, firmasY + 7, { align: 'center' });
              doc.text(`R.F.C.: ${datosCurso.instructor_rfc || ''}`, margin, firmasY + 11);
              doc.text(`CURP: ${datosCurso.instructor_curp || ''}`, margin, firmasY + 14.5);

              const coordStartX = margin + contentWidth - colW;
              doc.line(coordStartX, firmasY, margin + contentWidth, firmasY);
              doc.setFont('helvetica', 'bold');
              doc.text('Nombre y firma del coordinador (a)', coordStartX + colW / 2, firmasY + 3.5, { align: 'center' });
              doc.setFont('helvetica', 'bold');
              doc.text('Alejandro Calderón Rentería', coordStartX + colW / 2, firmasY + 7, { align: 'center' });
              doc.setFont('helvetica', 'normal');
              doc.text('Coordinador de Actualización Docente', coordStartX + colW / 2, firmasY + 10.5, { align: 'center' });

              doc.setFontSize(6.5);
              doc.setFont('helvetica', 'bold');
              doc.text('ITD-AD-FO-8', margin, firmasY + 18);
              doc.text(`Revisión: 1  ·  Hoja ${pag} de ${totalPaginas}`, margin + contentWidth, firmasY + 18, { align: 'right' });
            } else {
              doc.setFontSize(7);
              doc.setFont('helvetica', 'italic');
              doc.text(`--- Continúa en la Hoja ${pag + 1} de ${totalPaginas} ---`, margin + contentWidth / 2, finalY + 6, { align: 'center' });

              doc.setFontSize(6.5);
              doc.setFont('helvetica', 'bold');
              doc.text('ITD-AD-FO-8', margin, finalY + 14);
              doc.text(`Revisión: 1  ·  Hoja ${pag} de ${totalPaginas}`, margin + contentWidth, finalY + 14, { align: 'right' });
            }
          }
        });
      }

      return doc;
    } catch (err) {
      console.error('Error generando documento PDF:', err);
      return null;
    }
  }

  async function handlePDF() {
    if (!datosCurso) return;
    setDescargandoPDF(true);

    try {
      const doc = await generarDocumentoPDF();
      if (!doc) {
        alert('Hubo un error al estructurar el PDF.');
        return;
      }

      const nombreLimpio = (datosCurso.folio || 'curso').replace(/[^a-zA-Z0-9_-]/g, '_');
      doc.save(`Lista_Asistencia_${nombreLimpio}.pdf`);
    } catch (err) {
      console.error('Error generando descarga de PDF:', err);
      alert('Hubo un error al generar la descarga del archivo PDF.');
    } finally {
      setDescargandoPDF(false);
    }
  }

  async function handlePrint() {
    if (!datosCurso) return;
    setDescargandoPDF(true);

    try {
      const doc = await generarDocumentoPDF();
      if (!doc) {
        window.print();
        return;
      }

      const blob = doc.output('blob');
      const blobUrl = URL.createObjectURL(blob);

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.src = blobUrl;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            const win = window.open(blobUrl, '_blank');
            if (win) win.focus();
          }
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
            URL.revokeObjectURL(blobUrl);
          }, 120000);
        }, 350);
      };
    } catch (err) {
      console.error('Error al imprimir PDF oficial:', err);
      window.print();
    } finally {
      setDescargandoPDF(false);
    }
  }

  function handleExcel() {
    if (!datosCurso) return;
    const wb = XLSX.utils.book_new();

    for (let pag = 1; pag <= totalPaginas; pag++) {
      const filasPagina = obtenerFilasDePagina(pag);
      const wsData: any[][] = [
        ['INSTITUTO TECNOLÓGICO DE DURANGO'],
        ['Nombre del documento: Formato de Lista de Asistencia'],
        ['Referencias a la Norma NMX-CC-9001-IMNC-2008 6.2.2', '', '', '', '', '', '', '', 'Código:', 'ITD-AD-FO-8'],
        ['', '', '', '', '', '', '', '', 'Revisión:', '1'],
        ['', '', '', '', '', '', '', '', 'Página:', `${pag} de ${totalPaginas}`],
        [''],
        ['CURSO PRESENCIAL'],
        ['Hoja:', `${pag} de ${totalPaginas}`, '', '', '', '', '', 'Folio:', datosCurso.folio || 'N/A'],
        ['Nombre del curso:', datosCurso.nombre || 'Sin nombre'],
        ['Nombre del Instructor (a):', datosCurso.instructor || 'No asignado'],
        ['Periodo:', datosCurso.periodo || 'N/A', '', 'Duración:', datosCurso.duracion || '30 hrs', '', 'Horario:', datosCurso.horario || '09:00 A 15:00 HRS'],
        [''],
        ['No.', 'Nombre del Participante', 'R.F.C. / CURP', 'Puesto y departamento de adscripción', 'Nivel de Puesto', '', 'Asistencia', '', '', '', ''],
        ['', '', '', '', 'FD', 'D', 'L', 'M', 'M', 'J', 'V']
      ];

      filasPagina.forEach(({ participante: p, indexGlobal }) => {
        wsData.push([
          indexGlobal,
          p ? p.nombre_completo : '',
          p ? (p.curp || p.rfc) : '',
          p ? p.puesto_departamento : '',
          p && p.es_fd ? 'X' : '',
          p && p.es_d ? 'X' : '',
          '', '', '', '', ''
        ]);
      });

      wsData.push([]);
      wsData.push(['FD = Funcionario docente               D = Docente']);
      wsData.push([]);

      if (pag === totalPaginas) {
        wsData.push(['Nombre y firma del instructor (a)', '', '', '', '', 'Nombre y firma del coordinador (a)']);
        wsData.push([datosCurso.instructor, '', '', '', '', 'Alejandro Calderón Rentería']);
        wsData.push([`R.F.C.: ${datosCurso.instructor_rfc || ''}`, '', '', '', '', 'Coordinador de Actualización Docente']);
        wsData.push([`CURP: ${datosCurso.instructor_curp || ''}`]);
      } else {
        wsData.push([`--- Continúa en la Hoja ${pag + 1} de ${totalPaginas} ---`]);
      }

      wsData.push([]);
      wsData.push(['ITD-AD-FO-8', '', '', '', '', '', '', '', '', `Revisión: 1 (Hoja ${pag} de ${totalPaginas})`]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
        { s: { r: 6, c: 0 }, e: { r: 6, c: 10 } },
        { s: { r: 8, c: 1 }, e: { r: 8, c: 10 } },
        { s: { r: 9, c: 1 }, e: { r: 9, c: 10 } },
        { s: { r: 12, c: 0 }, e: { r: 13, c: 0 } },
        { s: { r: 12, c: 1 }, e: { r: 13, c: 1 } },
        { s: { r: 12, c: 2 }, e: { r: 13, c: 2 } },
        { s: { r: 12, c: 3 }, e: { r: 13, c: 3 } },
        { s: { r: 12, c: 4 }, e: { r: 12, c: 5 } },
        { s: { r: 12, c: 6 }, e: { r: 12, c: 10 } }
      ];

      ws['!cols'] = [
        { wch: 6 }, { wch: 44 }, { wch: 24 }, { wch: 40 },
        { wch: 8 }, { wch: 8 }, { wch: 6 }, { wch: 6 },
        { wch: 6 }, { wch: 6 }, { wch: 6 }
      ];

      ws['!pageSetup'] = { orientation: 'landscape', paperSize: 1 };

      XLSX.utils.book_append_sheet(wb, ws, `Hoja ${pag}`);
    }

    XLSX.writeFile(wb, `Lista_Asistencia_${datosCurso.folio || 'curso'}.xlsx`);
  }

  function handleEliminarParticipante(idOIndex: string | number) {
    const pEliminar = participantes.find((p, idx) => p.id === idOIndex || idx === idOIndex);
    if (!pEliminar) return;

    setParticipantes((prev) => prev.filter((p, idx) => p.id !== idOIndex && idx !== idOIndex));
    setParticipantesEliminados((prev) => [...prev, pEliminar]);

    const nuevoTotal = Math.max(1, Math.ceil((participantes.length - 1) / PARTICIPANTES_POR_PAGINA));
    if (typeof paginaVista === 'number' && paginaVista > nuevoTotal) {
      setPaginaVista(nuevoTotal);
    }
  }

  // Búsqueda reactiva en tiempo real contra la tabla docentes de Supabase al escribir
  useEffect(() => {
    const rawQuery = nuevoNombre.trim();
    if (rawQuery.length < 1) return;

    const timeout = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('docentes')
          .select('id, nombre_completo, curp, email, telefono, genero, nivel, departamento, activo, puesto, nivel_estudios, rfc')
          .or(`nombre_completo.ilike.%${rawQuery}%,curp.ilike.%${rawQuery}%,email.ilike.%${rawQuery}%`)
          .limit(40);

        if (!error && Array.isArray(data) && data.length > 0) {
          setCatalogoDocentes((prev) => {
            const mapa = new Map<string, any>(prev.map((d: any) => [d.id || normalizar(d.nombre_completo), d]));
            data.forEach((item: any) => {
              const m = mapearRegistroDocente(item);
              if (m) {
                mapa.set(m.id || normalizar(m.nombre_completo), m);
              }
            });
            return Array.from(mapa.values());
          });
        }
      } catch (err) {
        console.warn('Error en búsqueda dinámica supabase:', err);
      }
    }, 80);

    return () => clearTimeout(timeout);
  }, [nuevoNombre]);

  const sugerenciasDocentes = useMemo(() => {
    const rawQuery = nuevoNombre.trim();

    if (!rawQuery) {
      if (mostrarTodosDocentes) {
        return catalogoDocentes.slice(0, 100);
      }
      return [];
    }

    const queryNorm = normalizar(rawQuery);
    const palabrasQuery = queryNorm.split(/\s+/).filter(Boolean);
    const qUpper = rawQuery.toUpperCase();

    return catalogoDocentes
      .filter((d) => {
        const nNorm = normalizar(d.nombre_completo || '');
        const r = (d.rfc || '').toUpperCase();
        const c = (d.curp || '').toUpperCase();
        const deptoNorm = normalizar(d.departamento || '');
        const pNorm = normalizar(d.puesto || '');
        const em = (d.email || '').toUpperCase();

        const coincidePalabras =
          palabrasQuery.length > 0 &&
          palabrasQuery.every(
            (pal) =>
              nNorm.includes(pal) ||
              c.includes(pal) ||
              r.includes(pal) ||
              deptoNorm.includes(pal) ||
              pNorm.includes(pal) ||
              em.includes(pal)
          );

        const coincideDirecto =
          nNorm.includes(queryNorm) ||
          (c.length > 0 && c.includes(qUpper)) ||
          (r.length > 0 && r.includes(qUpper)) ||
          deptoNorm.includes(queryNorm) ||
          (em.length > 0 && em.includes(qUpper));

        return coincidePalabras || coincideDirecto;
      })
      .slice(0, 25);
  }, [catalogoDocentes, nuevoNombre, mostrarTodosDocentes]);

  function handleImportarArchivoDocentes(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

        if (!rows || rows.length === 0) {
          alert('El archivo no contiene filas con datos válidos.');
          return;
        }

        const importados: any[] = [];
        rows.forEach((r: any, idx: number) => {
          const keys = Object.keys(r);
          const findKey = (patterns: string[]) => {
            const k = keys.find(key => patterns.some(p => normalizar(key).includes(normalizar(p))));
            return k ? String(r[k]).trim() : '';
          };

          const nombre = findKey(['nombre', 'docente', 'profesor', 'completo', 'participante']);
          if (!nombre) return;

          const curp = findKey(['curp', 'clave curp']).toUpperCase();
          const rfc = findKey(['rfc', 'clave rfc']).toUpperCase();
          const rfcCurp = calcularRfcCurp(nombre, rfc, curp);
          const depto = findKey(['departamento', 'depto', 'adscripcion', 'area']) || datosCurso?.departamento || 'DOCENTE ITD';
          const email = findKey(['correo', 'email', 'institucional']).toLowerCase() || `${normalizar(nombre).split(' ')[0].toLowerCase()}@itdurango.edu.mx`;
          const tel = findKey(['telefono', 'celular', 'tel', 'contacto']);
          const grado = findKey(['grado', 'estudios', 'nivel', 'escolaridad', 'titulo']) || (nombre.startsWith('DR') ? 'Doctorado' : (nombre.startsWith('M.C') || nombre.startsWith('MTRO')) ? 'Maestría' : nombre.startsWith('ING') ? 'Ingeniería' : 'Licenciatura');
          const puesto = findKey(['puesto', 'categoria', 'cargo']) || 'Docente';
          const tarjeta = findKey(['tarjeta', 'clave', 'empleado', 'no_tarjeta']);
          const genero = findKey(['genero', 'sexo']) || (esMujer(nombre) ? 'Femenino' : 'Masculino');
          const tipo = findKey(['tipo', 'fd', 'd/fd']).toUpperCase();
          const es_fd = tipo === 'FD' || puesto.toLowerCase().includes('funcionario');

          const docenteObj = {
            nombre_completo: nombre.toUpperCase(),
            rfc: rfc || rfcCurp.rfc,
            curp: curp || rfcCurp.curp,
            email: email,
            telefono: tel,
            departamento: limpiarPrefijosDocente(depto),
            puesto: puesto,
            nivel: es_fd ? 'Funcionario Docente' : 'Docente',
            nivel_estudios: grado,
            es_fd: es_fd,
            es_d: !es_fd,
            genero: genero.startsWith('F') || genero.toLowerCase() === 'mujer' ? 'Femenino' : 'Masculino',
            activo: true
          };

          importados.push(docenteObj);
        });

        if (importados.length > 0) {
          // Guardar cada docente directo en Supabase (upsert por nombre)
          Promise.all(
            importados.map((doc) =>
              supabase.from('docentes').upsert(doc, { onConflict: 'nombre_completo' })
            )
          )
            .then(() => {
              cargarCatalogoDocentes();
              alert(`✅ ¡Éxito! Se importaron ${importados.length} docentes a la base de datos de Supabase.`);
            })
            .catch((err) => {
              console.error('Error importando docentes a Supabase:', err);
              alert('Ocurrió un error guardando algunos docentes en Supabase. Revisa la consola.');
            });
        } else {
          alert('No se reconocieron columnas de docentes en el archivo. Verifique que contenga una columna "Nombre".');
        }
      } catch (err: any) {
        console.error('Error al importar Excel de docentes:', err);
        alert(`Error al procesar el archivo Excel: ${err.message || 'Formato no soportado'}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  }

  function handleSeleccionarDocente(doc: any) {
    if (!doc) return;
    const nombre = (doc.nombre_completo || doc.nombre || '').trim().toUpperCase();
    const curp = (doc.curp || doc.CURP || '').trim().toUpperCase();
    const rfc = (doc.rfc || doc.RFC || '').trim().toUpperCase();

    const email = (
      doc.email ||
      doc.correo ||
      doc.correo_institucional ||
      ''
    ).trim().toLowerCase();

    const tel = (doc.telefono || doc.tel || doc.celular || '').trim();
    const depto = doc.departamento || doc.depto || doc.adscripcion || datosCurso?.departamento || '';
    const puesto = doc.puesto || (doc.es_fd ? 'Funcionario Docente' : 'Docente');
    const nivelEst = doc.nivel_estudios || doc.grado || doc.grado_academico || (nombre.startsWith('DR') ? 'Doctorado' : (nombre.startsWith('M.C') || nombre.startsWith('MTRO')) ? 'Maestría' : nombre.startsWith('ING') ? 'Ingeniería' : 'Licenciatura');
    const tipo = (doc.es_fd || (doc.tipo && doc.tipo === 'FD') || puesto.toLowerCase().includes('funcionario')) ? 'FD' : 'D';

    let gen = doc.genero || doc.sexo;
    if (!gen) {
      gen = esMujer(nombre) ? 'Femenino' : 'Masculino';
    } else if (gen === 'H' || gen === 'Hombre' || gen === 'Masculino') {
      gen = 'Masculino';
    } else if (gen === 'M' || gen === 'Mujer' || gen === 'Femenino') {
      gen = 'Femenino';
    }

    const tarjeta = (doc.tarjeta || doc.no_tarjeta || doc.clave || '').trim();

    setNuevoNombre(nombre);
    setNuevoCurp(curp);
    setNuevoRfc(rfc);
    setNuevoEmail(email);
    setNuevoTelefono(tel);
    setNuevoDepartamento(limpiarPrefijosDocente(depto));
    setNuevoPuesto(puesto);
    setNuevoNivelEstudios(nivelEst);
    setNuevoTipo(tipo);
    setNuevoGenero(gen);
    setNuevaTarjeta(tarjeta);

    setDocenteSeleccionadoNombre(nombre);
    setMostrarSugerencias(false);
    setDocenteSeleccionadoIndex(-1);
    setDocenteAutocompletado(true);
    setNuevoRfcEditado(true);
    setNuevoCurpEditado(true);
    setNuevoEmailEditado(true);
  }

  function handleAbrirModalNuevo() {
    setNuevoNombre('');
    setNuevoRfc('');
    setNuevoCurp('');
    setNuevoEmail('');
    setNuevoTelefono('');
    setNuevoDepartamento(datosCurso?.departamento || '');
    setNuevoPuesto('Docente');
    setNuevoNivelEstudios('Licenciatura');
    setNuevoTipo('D');
    setNuevoGenero('Masculino');
    setNuevaTarjeta('');
    setNuevoRfcEditado(false);
    setNuevoCurpEditado(false);
    setNuevoEmailEditado(false);
    setMostrarSugerencias(false);
    setDocenteSeleccionadoIndex(-1);
    setDocenteAutocompletado(false);
    setMostrarModalNuevo(true);
    cargarCatalogoDocentes();
  }

  function handleGuardarNuevoParticipante(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;

    const rfcCurp = calcularRfcCurp(nuevoNombre, nuevoRfc, nuevoCurp);
    const rfcFinal = (nuevoRfc.trim() || rfcCurp.rfc).toUpperCase();
    const curpFinal = (nuevoCurp.trim() || rfcCurp.curp).toUpperCase();
    const deptoFinal = (nuevoDepartamento.trim() || datosCurso?.departamento || 'DOCENTE ITD').toUpperCase();
    const puestoFinal = (nuevoPuesto.trim() || (nuevoTipo === 'FD' ? 'Funcionario Docente' : 'Docente')).toUpperCase();
    const emailFinal = (nuevoEmail.trim() || `${nuevoNombre.trim().split(' ')[0].toLowerCase()}@itdurango.edu.mx`).toLowerCase();
    const telefonoFinal = nuevoTelefono.trim();
    const generoFinal = nuevoGenero || (esMujer(nuevoNombre) ? 'Femenino' : 'Masculino');
    const tarjetaFinal = nuevaTarjeta.trim();
    const nivelEstudiosFinal = nuevoNivelEstudios || 'Licenciatura';

    const nuevo: any = {
      id: `p-nuevo-${Date.now()}`,
      nombre_completo: nuevoNombre.trim().toUpperCase(),
      rfc: rfcFinal,
      curp: curpFinal,
      email: emailFinal,
      telefono: telefonoFinal,
      departamento: deptoFinal,
      puesto: puestoFinal,
      puesto_departamento: `${puestoFinal} - ${deptoFinal}`,
      nivel: nuevoTipo === 'FD' ? 'Funcionario Docente' : 'Docente',
      nivel_estudios: nivelEstudiosFinal,
      es_fd: nuevoTipo === 'FD',
      es_d: nuevoTipo === 'D',
      genero: generoFinal,
      tarjeta: tarjetaFinal,
      asistencias: { L: true, M: true, M2: true, J: true, V: true }
    };

    // Actualizar estado en pantalla
    setParticipantes((prev) => {
      const lista = [...prev, nuevo];
      lista.sort((a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || ''));
      return lista;
    });

    // Guardar/actualizar en el catálogo oficial de docentes (Supabase)
    supabase
      .from('docentes')
      .upsert(
        {
          nombre_completo: nuevo.nombre_completo,
          curp: nuevo.curp,
          rfc: nuevo.rfc,
          email: nuevo.email,
          telefono: nuevo.telefono,
          genero: nuevo.genero,
          nivel: nuevo.nivel,
          departamento: nuevo.departamento,
          puesto: nuevo.puesto,
          nivel_estudios: nuevo.nivel_estudios,
          activo: true
        },
        { onConflict: 'nombre_completo' }
      )
      .then(
        () => {},
        (err: any) => console.warn('Aviso al guardar docente en Supabase:', err)
      );

    // Inscribir al curso actual en Supabase
    if (datosCurso?.id) {
      supabase
        .from('inscripciones')
        .insert({
          curso_id: datosCurso.id,
          folio_curso: datosCurso.folio || '',
          nombre_completo: nuevo.nombre_completo,
          rfc: nuevo.rfc,
          curp: nuevo.curp,
          email: nuevo.email,
          telefono: nuevo.telefono,
          departamento: nuevo.departamento,
          puesto: nuevo.puesto,
          nivel: nuevo.nivel,
          nivel_estudios: nuevo.nivel_estudios,
          es_fd: nuevo.es_fd,
          es_d: nuevo.es_d,
          genero: nuevo.genero,
          tarjeta: nuevo.tarjeta,
          estado: 'activo'
        })
        .then(
          () => {},
          (err: any) => console.warn('Aviso Supabase inscripciones:', err)
        );
    }

    setMostrarModalNuevo(false);
  }

  function handleAjustarAUnaHoja() {
    if (participantes.length <= 15) return;
    const sobrantes = participantes.slice(15);
    const primeros15 = participantes.slice(0, 15);
    setParticipantesEliminados((prev) => [...prev, ...sobrantes]);
    setParticipantes(primeros15);
    setPaginaVista(1);
  }

  function handleRestaurarParticipantes() {
    setParticipantes((prev) => {
      const combinados = [...prev, ...participantesEliminados];
      combinados.sort((a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || ''));
      return combinados;
    });
    setParticipantesEliminados([]);
  }

      function renderHojaIndividual(numeroPagina: number) {
    if (!datosCurso) return null;
    const filas = obtenerFilasDePagina(numeroPagina);
    const esUltima = numeroPagina === totalPaginas;

    return (
      <div
        key={`hoja-${numeroPagina}`}
        className="pagina-impresion bg-white text-slate-900 p-6 sm:p-8 max-w-[279mm] w-full mx-auto border border-slate-300 shadow-sm font-sans text-xs leading-tight mb-8 relative rounded-sm"
      >
        {/* ENCABEZADO OFICIAL */}
        <div className="border border-slate-300 flex items-stretch mb-3 rounded-sm overflow-hidden">
          <div className="w-36 sm:w-44 border-r border-slate-300 p-2 flex items-center justify-center text-center bg-slate-50 shrink-0">
            <img
              src={LOGO_TECNM_URL}
              alt="Logo TecNM / ITD"
              className="logo-tecnm max-h-14 max-w-[145px] w-auto h-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="flex-1 p-2.5 text-center flex flex-col justify-center bg-white">
            <h1 style={{ color: '#1B396A' }} className="font-bold text-sm sm:text-base tracking-wide">
              INSTITUTO TECNOLÓGICO DE DURANGO
            </h1>
            <p className="text-[11px] sm:text-xs font-medium text-slate-700 mt-0.5">
              Formato de Lista de Asistencia
            </p>
            <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">
              Referencia: NMX-CC-9001-IMNC-2008 · 6.2.2
            </p>
          </div>

          <div className="w-44 border-l border-slate-300 text-[9px] sm:text-[9.5px] shrink-0 bg-slate-50">
            <div className="border-b border-slate-200 px-2.5 py-1 flex justify-between">
              <span className="text-slate-500">Código</span>
              <span className="font-semibold text-slate-800">ITD-AD-FO-8</span>
            </div>
            <div className="border-b border-slate-200 px-2.5 py-1 flex justify-between">
              <span className="text-slate-500">Revisión</span>
              <span className="font-semibold text-slate-800">1</span>
            </div>
            <div className="border-b border-slate-200 px-2.5 py-1 flex justify-between">
              <span className="text-slate-500">Página</span>
              <span className="font-semibold text-slate-800">{numeroPagina} de {totalPaginas}</span>
            </div>
            <div className="px-2.5 py-1 flex justify-between">
              <span className="text-slate-500">Fecha</span>
              <span className="text-slate-700">{new Date().toLocaleDateString('es-MX')}</span>
            </div>
          </div>
        </div>

        {/* METADATOS DEL CURSO */}
        <div className="border border-slate-300 mb-3 text-[10.5px] rounded-sm overflow-hidden">
          <div
            style={{ backgroundColor: '#1B396A', color: '#ffffff' }}
            className="border-b border-slate-300 font-semibold py-1.5 px-3 text-center uppercase tracking-wide text-[10px]"
          >
            {datosCurso.modalidad || 'CURSO PRESENCIAL'}
          </div>
          <div className="flex border-b border-slate-200">
            <div className="flex-1 py-1.5 px-3 border-r border-slate-200 flex items-center gap-2 text-slate-700">
              <span className="text-slate-400">Hoja</span>
              <span className="font-semibold text-slate-900">{numeroPagina}</span>
              <span className="text-slate-400">de</span>
              <span className="font-semibold text-slate-900">{totalPaginas}</span>
            </div>
            <div className="w-64 py-1.5 px-3 flex items-center justify-between">
              <span className="text-slate-400">Folio</span>
              <span style={{ color: '#1B396A' }} className="font-mono font-semibold">{datosCurso.folio}</span>
            </div>
          </div>
          <div className="flex border-b border-slate-200 py-1.5 px-3">
            <span className="text-slate-400 mr-2 shrink-0">Curso</span>
            <span className="font-medium uppercase text-slate-800">{datosCurso.nombre}</span>
          </div>
          <div className="flex border-b border-slate-200 py-1.5 px-3">
            <span className="text-slate-400 mr-2 shrink-0">Instructor(a)</span>
            <span className="font-medium text-slate-800">{datosCurso.instructor}</span>
          </div>
          <div className="flex flex-wrap text-[9.5px]">
            <div className="flex-1 py-1.5 px-3 border-r border-slate-200 flex items-center gap-1.5 min-w-[200px]">
              <span className="text-slate-400">Periodo</span>
              <span className="text-slate-700">{datosCurso.periodo}</span>
            </div>
            <div className="w-36 py-1.5 px-3 border-r border-slate-200 flex items-center gap-1.5">
              <span className="text-slate-400">Duración</span>
              <span className="text-slate-700">{datosCurso.duracion}</span>
            </div>
            <div className="w-44 py-1.5 px-3 flex items-center gap-1.5">
              <span className="text-slate-400">Horario</span>
              <span className="text-slate-700">{datosCurso.horario}</span>
            </div>
          </div>
        </div>

        {/* TABLA DE PARTICIPANTES */}
        <div className="overflow-x-auto rounded-sm border border-slate-300">
          <table className="w-full border-collapse text-[9px] min-w-[650px]">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th rowSpan={2} className="border-b border-r border-slate-200 px-1 py-1.5 text-center w-8 font-semibold">No.</th>
                <th rowSpan={2} className="border-b border-r border-slate-200 px-2 py-1.5 text-left font-semibold">Nombre del Participante</th>
                <th rowSpan={2} className="border-b border-r border-slate-200 px-1.5 py-1.5 text-left w-36 font-semibold">R.F.C. / CURP</th>
                <th rowSpan={2} className="border-b border-r border-slate-200 px-2 py-1.5 text-left font-semibold">Puesto y departamento de adscripción</th>
                <th colSpan={2} className="border-b border-r border-slate-200 px-1 py-1 text-center font-semibold">Nivel</th>
                <th colSpan={5} className="border-b border-slate-200 px-1 py-1 text-center font-semibold">Asistencia</th>
                <th rowSpan={2} className="border-b border-slate-200 px-1 py-1.5 text-center w-6 print:hidden"></th>
              </tr>
              <tr className="bg-slate-50 text-slate-500 text-[8.5px]">
                <th className="border-b border-r border-slate-200 px-1 py-1 text-center w-7" title="Funcionario Docente">FD</th>
                <th className="border-b border-r border-slate-200 px-1 py-1 text-center w-7" title="Docente">D</th>
                <th className="border-b border-r border-slate-200 px-1 py-1 text-center w-6">L</th>
                <th className="border-b border-r border-slate-200 px-1 py-1 text-center w-6">M</th>
                <th className="border-b border-r border-slate-200 px-1 py-1 text-center w-6">M</th>
                <th className="border-b border-r border-slate-200 px-1 py-1 text-center w-6">J</th>
                <th className="border-b border-slate-200 px-1 py-1 text-center w-6">V</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ participante: p, indexGlobal }) => {
                if (!p) {
                  return (
                    <tr key={`empty-${numeroPagina}-${indexGlobal}`} className="h-5">
                      <td className="border-b border-r border-slate-100 text-center text-slate-300">{indexGlobal}</td>
                      <td className="border-b border-r border-slate-100"></td>
                      <td className="border-b border-r border-slate-100"></td>
                      <td className="border-b border-r border-slate-100"></td>
                      <td className="border-b border-r border-slate-100 text-center"></td>
                      <td className="border-b border-r border-slate-100 text-center"></td>
                      <td className="border-b border-r border-slate-100 text-center"></td>
                      <td className="border-b border-r border-slate-100 text-center"></td>
                      <td className="border-b border-r border-slate-100 text-center"></td>
                      <td className="border-b border-r border-slate-100 text-center"></td>
                      <td className="border-b border-slate-100 text-center"></td>
                      <td className="border-b border-slate-100 text-center print:hidden"></td>
                    </tr>
                  );
                }
                 return (
                  <tr
                    key={p.id || indexGlobal}
                    onMouseEnter={() => setFilaHover(indexGlobal)}
                    onMouseLeave={() => setFilaHover(null)}
                    className={`h-5.5 transition-colors ${indexGlobal % 2 === 0 ? 'bg-slate-50' : 'bg-white'} hover:bg-slate-100`}
                  >

                    <td className="border-b border-r border-slate-100 text-center text-slate-500 font-medium">{indexGlobal}</td>
                    <td className="border-b border-r border-slate-100 px-2 py-0.5 font-medium uppercase text-slate-800">{p.nombre_completo}</td>
                    <td className="border-b border-r border-slate-100 px-1.5 py-0.5 font-mono text-[8px] text-slate-600">{p.curp || p.rfc}</td>
                    <td className="border-b border-r border-slate-100 px-2 py-0.5 text-[8.5px] uppercase text-slate-600">{p.puesto_departamento}</td>
                    <td style={{ color: '#1B396A' }} className="border-b border-r border-slate-100 text-center font-semibold">{p.es_fd ? 'X' : ''}</td>
                    <td style={{ color: '#1B396A' }} className="border-b border-r border-slate-100 text-center font-semibold">{p.es_d ? 'X' : ''}</td>
                    <td className="border-b border-r border-slate-100 text-center"></td>
                    <td className="border-b border-r border-slate-100 text-center"></td>
                    <td className="border-b border-r border-slate-100 text-center"></td>
                    <td className="border-b border-r border-slate-100 text-center"></td>
                    <td className="border-b border-slate-100 text-center"></td>
                    <td className="border-b border-slate-100 text-center print:hidden p-0">
                      {filaHover === indexGlobal && (
                        <button
                          onClick={() => handleEliminarParticipante(p.id || indexGlobal - 1)}
                          className="text-slate-400 hover:text-red-600 font-medium px-1 transition text-[10px]"
                          title="Quitar participante de la lista"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-[8.5px] font-medium text-slate-400 mt-2 mb-4">
          <span>FD = Funcionario docente</span>
          <span className="ml-8">D = Docente</span>
        </div>

        {esUltima ? (
          <div className="flex justify-between items-start text-[9.5px] pt-2 mb-4 gap-8">
            <div className="flex-1 text-center">
              <div className="border-t border-slate-400 w-4/5 mx-auto mb-1"></div>
              <p className="font-semibold text-slate-800">Nombre y firma del instructor (a)</p>
              <p className="font-medium text-slate-600 text-[9px] mt-0.5">{datosCurso.instructor}</p>
              <div className="text-left text-[8.5px] text-slate-500 mt-2 space-y-0.5 pl-4">
                <p>R.F.C.: <span className="font-mono text-slate-700">{datosCurso.instructor_rfc || '_________________________'}</span></p>
                <p>CURP: <span className="font-mono text-slate-700">{datosCurso.instructor_curp || '_________________________'}</span></p>
              </div>
            </div>

            <div className="flex-1 text-center">
              <div className="border-t border-slate-400 w-4/5 mx-auto mb-1"></div>
              <p className="font-semibold text-slate-800">Nombre y firma del coordinador (a)</p>
              <p style={{ color: '#1B396A' }} className="font-bold text-[10px] mt-0.5">Alejandro Calderón Rentería</p>
              <p className="font-medium text-slate-600 text-[9px] mt-0.5">Coordinador de Actualización Docente</p>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-xs font-medium text-slate-500 italic border-y border-dashed border-slate-300 my-3">
            Continúa en la Hoja {numeroPagina + 1} de {totalPaginas}
          </div>
        )}

        <div className="flex justify-between items-center text-[8.5px] font-medium text-slate-400 border-t border-slate-200 pt-2">
          <span>ITD-AD-FO-8</span>
          <span>Revisión: 1 · Hoja {numeroPagina} de {totalPaginas}</span>
        </div>
      </div>
    );
  }

    return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-start p-0 sm:p-3 md:p-5 z-50 overflow-hidden select-none"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.7)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="bg-white rounded-none sm:rounded-xl max-w-6xl w-full h-full sm:max-h-[96vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">

        {/* BARRA SUPERIOR */}
        <div
          style={{ backgroundColor: '#1B396A' }}
          className="px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 z-30"
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              style={{ color: 'rgba(255,255,255,0.9)' }}
              className="px-3 py-2 rounded-lg text-xs sm:text-sm font-medium hover:opacity-75 transition-opacity flex items-center gap-1.5 shrink-0"
              title="Cerrar vista y volver a la lista de cursos"
            >
              <span className="text-sm leading-none">←</span>
              <span>Regresar</span>
            </button>

            <div style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} className="w-px h-6 hidden sm:block" />

            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{ color: 'rgba(255,255,255,0.55)' }} className="text-[10px] sm:text-xs font-medium tracking-wide">
                  ITD-AD-FO-8 · Rev. 1
                </span>
                <span style={{ color: 'rgba(255,255,255,0.3)' }} className="text-[10px]">·</span>
                <span
                  style={{ borderColor: 'rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.85)' }}
                  className="border font-mono px-1.5 py-0.5 rounded text-[10px] sm:text-xs"
                >
                  {datosCurso?.folio}
                </span>
              </div>
              <h2 className="font-semibold text-xs sm:text-sm text-white tracking-wide truncate max-w-sm sm:max-w-md md:max-w-lg mt-0.5" title={datosCurso?.nombre}>
                {datosCurso?.nombre}
              </h2>
            </div>
          </div>

          {/* GRUPO DE EXPORTACIÓN */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div style={{ borderColor: 'rgba(255,255,255,0.25)' }} className="flex items-center rounded-lg overflow-hidden border">
              <button
                onClick={handlePDF}
                disabled={descargandoPDF}
                style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.25)' }}
                className={`px-3.5 py-2 text-xs sm:text-sm font-medium hover:opacity-75 transition-opacity flex items-center gap-1.5 border-r ${
                  descargandoPDF ? 'opacity-60 cursor-wait' : ''
                }`}
                title="Descargar documento oficial en archivo PDF (.pdf)"
              >
                <span className="text-sm leading-none">{descargandoPDF ? '…' : '⭳'}</span>
                <span>{descargandoPDF ? 'Generando' : 'PDF'}</span>
              </button>
              <button
                onClick={handlePrint}
                style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.25)' }}
                className="px-3.5 py-2 text-xs sm:text-sm font-medium hover:opacity-75 transition-opacity flex items-center gap-1.5 border-r"
                title="Imprimir formato oficial o Guardar como PDF desde el navegador"
              >
                <span className="text-sm leading-none">⎙</span>
                <span>Imprimir</span>
              </button>
              <button
                onClick={handleExcel}
                style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#ffffff' }}
                className="px-3.5 py-2 text-xs sm:text-sm font-medium hover:opacity-75 transition-opacity flex items-center gap-1.5"
                title="Descargar libro en formato Excel (.xlsx)"
              >
                <span className="text-sm leading-none">▤</span>
                <span>Excel</span>
              </button>
            </div>

            <button
              onClick={onClose}
              style={{ color: 'rgba(255,255,255,0.7)' }}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-75 transition-opacity"
              title="Cerrar vista previa (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* BARRA DE NAVEGACIÓN Y GESTIÓN */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0 z-20">
          <div className="flex flex-wrap items-center gap-1.5">
            {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                onClick={() => setPaginaVista(num)}
                style={
                  paginaVista === num
                    ? { backgroundColor: '#1B396A', color: '#ffffff', borderColor: '#1B396A' }
                    : { backgroundColor: '#ffffff', color: '#475569', borderColor: '#e2e8f0' }
                }
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors border"
              >
                Hoja {num} de {totalPaginas}
              </button>
            ))}
            {totalPaginas > 1 && (
              <button
                onClick={() => setPaginaVista('todas')}
                style={
                  paginaVista === 'todas'
                    ? { backgroundColor: '#1B396A', color: '#ffffff', borderColor: '#1B396A' }
                    : { backgroundColor: '#ffffff', color: '#475569', borderColor: '#e2e8f0' }
                }
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors border"
              >
                Ver todas ({totalPaginas})
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {participantes.length > 15 && (
              <button
                onClick={handleAjustarAUnaHoja}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:border-slate-300 transition-colors"
                title="Quitar participantes excedentes para dejar exactamente 15 y que quede en 1 sola hoja"
              >
                Dejar en 1 hoja (15)
              </button>
            )}

            {participantesEliminados.length > 0 && (
              <button
                onClick={handleRestaurarParticipantes}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:border-slate-300 transition-colors"
                title="Restaurar participantes que fueron removidos"
              >
                Restaurar ({participantesEliminados.length})
              </button>
            )}

            <button
              onClick={handleAbrirModalNuevo}
              style={{ backgroundColor: '#1B396A', color: '#ffffff' }}
              className="px-3.5 py-1.5 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity"
              title="Registrar manualmente un nuevo participante en la lista"
            >
              + Agregar participante
            </button>

            <button
              onClick={() => setMostrarGestor(!mostrarGestor)}
              style={
                mostrarGestor
                  ? { backgroundColor: '#1e293b', color: '#ffffff', borderColor: '#1e293b' }
                  : { backgroundColor: '#ffffff', color: '#475569', borderColor: '#e2e8f0' }
              }
              className="px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors border"
            >
              Gestionar ({participantes.length})
            </button>
          </div>
        </div>

        {mostrarGestor && (
          <div className="bg-white border-b border-slate-200 p-4 text-xs flex flex-col gap-2.5 shrink-0 z-10">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">
                Participantes en la lista ({participantes.length} · {totalPaginas} {totalPaginas === 1 ? 'hoja' : 'hojas'})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAbrirModalNuevo}
                  style={{ color: '#1B396A' }}
                  className="px-2.5 py-1 hover:bg-slate-50 border border-slate-200 rounded-md text-xs font-medium transition-colors"
                >
                  + Agregar docente
                </button>
                <button
                  onClick={() => setMostrarGestor(false)}
                  className="text-slate-400 hover:text-slate-700 text-xs font-medium px-2 py-1 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg divide-y divide-slate-100">
              {participantes.map((p, idx) => (
                <div key={p.id || idx} className="px-3 py-2 flex items-center justify-between hover:bg-white transition-colors">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="w-5 text-slate-400 font-mono text-[10px]">{idx + 1}.</span>
                    <span className="font-medium text-slate-800 uppercase">{p.nombre_completo}</span>
                    <span className="text-slate-400 text-[10px] font-mono">{p.curp || p.rfc}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{p.puesto_departamento}</span>
                  </div>
                  <button
                    onClick={() => handleEliminarParticipante(p.id || idx)}
                    className="text-slate-400 hover:text-red-600 text-xs font-medium transition-colors ml-2 shrink-0"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONTENIDO */}
        <div className="relative p-4 sm:p-8 overflow-y-auto bg-slate-100 flex-1 select-text">
          {cargando || !datosCurso ? (
            <div className="bg-white p-12 text-center text-slate-400 font-medium rounded-xl border border-slate-200 max-w-md mx-auto my-12">
              Cargando participantes y formato oficial del curso…
            </div>
          ) : (
            <div id="formato-oficial-itd-impresion-contenedor">
              {paginaVista === 'todas' ? (
                Array.from({ length: totalPaginas }, (_, i) => i + 1).map((num) =>
                  renderHojaIndividual(num)
                )
              ) : (
                renderHojaIndividual(paginaVista as number)
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: NUEVO PARTICIPANTE */}
      {mostrarModalNuevo && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-60 overflow-y-auto"
          style={{ backgroundColor: 'rgba(2, 6, 23, 0.6)', backdropFilter: 'blur(2px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setMostrarModalNuevo(false);
          }}
        >
          <div className="bg-white rounded-xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="font-semibold text-base text-slate-900">
                  Inscripción extemporánea / Registro de docente
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Escriba el nombre o CURP para autocompletar desde la base de datos.
                </p>
              </div>
              <button
                onClick={() => setMostrarModalNuevo(false)}
                className="text-slate-400 hover:text-slate-700 font-medium text-lg p-1 rounded-lg hover:bg-slate-50 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* ESTADO Y HERRAMIENTAS DEL CATÁLOGO */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  catalogoDocentes.length > 0 ? 'bg-emerald-500' : 'bg-slate-300'
                }`} />
                <span className="text-xs text-slate-500">
                  {catalogoDocentes.length > 0
                    ? `${catalogoDocentes.length} docentes en la base de datos`
                    : 'Sin docentes cargados aún'}
                </span>
                {errorSupabaseMsg && (
                  <span className="text-[10px] text-red-500">— {errorSupabaseMsg}</span>
                )}
              </div>

              <div className="flex items-center gap-3 text-[11px]">
                <button
                  type="button"
                  onClick={() => cargarCatalogoDocentes()}
                  disabled={cargandoDocentesSupabase}
                  style={{ color: '#1B396A' }}
                  className="hover:opacity-75 font-medium transition-opacity disabled:opacity-50"
                >
                  {cargandoDocentesSupabase ? 'Cargando…' : 'Recargar'}
                </button>
                <span className="text-slate-200">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarTodosDocentes((prev) => !prev);
                    setMostrarSugerencias(true);
                  }}
                  style={{ color: '#1B396A' }}
                  className="font-medium hover:opacity-75 transition-opacity"
                >
                  {mostrarTodosDocentes ? 'Ocultar catálogo' : `Ver todo (${catalogoDocentes.length})`}
                </button>
                <span className="text-slate-200">|</span>
                <label style={{ color: '#1B396A' }} className="font-medium cursor-pointer hover:opacity-75 transition-opacity">
                  Importar Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleImportarArchivoDocentes}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <form onSubmit={handleGuardarNuevoParticipante} className="space-y-5 text-xs">
              {/* BÚSQUEDA */}
              <div className="relative">
                <label className="block font-medium text-slate-700 mb-1.5">
                  Nombre, apellido o CURP del docente *
                </label>

                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Ej. JOSÉ…, CARA75…, LAURA AGUIRRE…"
                    value={nuevoNombre}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNuevoNombre(val);
                      setMostrarSugerencias(true);
                      setDocenteSeleccionadoIndex(-1);
                      setDocenteAutocompletado(false);
                    }}
                    onFocus={() => setMostrarSugerencias(true)}
                    onKeyDown={(e) => {
                      if (mostrarSugerencias && sugerenciasDocentes.length > 0) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setDocenteSeleccionadoIndex((prev) => (prev + 1) % sugerenciasDocentes.length);
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setDocenteSeleccionadoIndex((prev) => (prev <= 0 ? sugerenciasDocentes.length - 1 : prev - 1));
                        } else if (e.key === 'Enter' && docenteSeleccionadoIndex >= 0) {
                          e.preventDefault();
                          handleSeleccionarDocente(sugerenciasDocentes[docenteSeleccionadoIndex]);
                        } else if (e.key === 'Escape') {
                          setMostrarSugerencias(false);
                        }
                      }
                    }}
                    className={`w-full rounded-lg border px-3.5 py-2.5 text-xs uppercase focus:ring-2 focus:ring-blue-900 focus:border-blue-900 outline-none transition-colors ${
                      docenteAutocompletado
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 bg-white'
                    }`}
                    autoFocus
                    autoComplete="off"
                  />

                  {nuevoNombre && (
                    <button
                      type="button"
                      onClick={() => {
                        setNuevoNombre('');
                        setNuevoRfc('');
                        setNuevoCurp('');
                        setNuevoEmail('');
                        setNuevoTelefono('');
                        setNuevoDepartamento(datosCurso?.departamento || '');
                        setNuevoPuesto('Docente');
                        setNuevoNivelEstudios('Licenciatura');
                        setNuevoTipo('D');
                        setNuevoGenero('Masculino');
                        setNuevaTarjeta('');
                        setNuevoRfcEditado(false);
                        setNuevoCurpEditado(false);
                        setNuevoEmailEditado(false);
                        setMostrarSugerencias(false);
                        setDocenteAutocompletado(false);
                        setDocenteSeleccionadoNombre('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 text-xs font-medium"
                      title="Limpiar campos"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {mostrarSugerencias && sugerenciasDocentes.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-y-auto divide-y divide-slate-100">
                    <div className="px-3.5 py-2 bg-slate-50 text-slate-500 text-[10px] font-medium uppercase tracking-wide flex justify-between items-center sticky top-0">
                      <span>{sugerenciasDocentes.length} docente(s) encontrados</span>
                      <span className="text-slate-400 font-normal normal-case">Clic para autollenar</span>
                    </div>
                    {sugerenciasDocentes.map((doc, idx) => (
                      <button
                        key={`${doc.id || doc.nombre_completo}-${idx}`}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSeleccionarDocente(doc);
                        }}
                        onClick={() => handleSeleccionarDocente(doc)}
                        onMouseEnter={() => setDocenteSeleccionadoIndex(idx)}
                        className={`w-full text-left px-3.5 py-2.5 transition-colors flex flex-col gap-1 border-b border-slate-50 last:border-0 ${
                          docenteSeleccionadoIndex === idx ? 'bg-slate-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-xs text-slate-800">{doc.nombre_completo}</span>
                          <span
                            style={
                              doc.es_fd
                                ? { backgroundColor: '#f1f5f9', color: '#475569' }
                                : { backgroundColor: 'rgba(27,57,106,0.1)', color: '#1B396A' }
                            }
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          >
                            {doc.es_fd ? 'FD' : 'D'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-slate-400">
                          {doc.departamento && <span>{doc.departamento}</span>}
                          {doc.curp && <span className="font-mono">{doc.curp}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {mostrarSugerencias && nuevoNombre.trim().length >= 1 && sugerenciasDocentes.length === 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-lg p-3.5 text-xs text-slate-500">
                    No se encontró "{nuevoNombre}" en el catálogo. Puede llenar los datos manualmente abajo.
                  </div>
                )}

                {docenteAutocompletado && (
                  <p className="text-[11px] text-emerald-700 font-medium mt-2 flex items-center gap-1.5">
                    <span>✓</span>
                    <span>Datos de {docenteSeleccionadoNombre || 'el docente'} autocompletados.</span>
                  </p>
                )}
              </div>

              {/* CLAVES OFICIALES */}
              <div className="space-y-3">
                <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide">
                  Claves oficiales
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">C.U.R.P.</label>
                    <input
                      type="text"
                      maxLength={18}
                      placeholder="CARA750101HDGRNN01"
                      value={nuevoCurp}
                      onChange={(e) => { setNuevoCurp(e.target.value.toUpperCase()); setNuevoCurpEditado(true); }}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono uppercase bg-white focus:ring-2 focus:ring-blue-900 focus:border-blue-900 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">R.F.C.</label>
                    <input
                      type="text"
                      maxLength={13}
                      placeholder="CARA750101ABC"
                      value={nuevoRfc}
                      onChange={(e) => { setNuevoRfc(e.target.value.toUpperCase()); setNuevoRfcEditado(true); }}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono uppercase bg-white focus:ring-2 focus:ring-blue-900 focus:border-blue-900 outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* CONTACTO */}
              <div className="space-y-3">
                <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide">
                  Datos de contacto
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Correo institucional</label>
                    <input
                      type="email"
                      placeholder="docente@itdurango.edu.mx"
                      value={nuevoEmail}
                      onChange={(e) => { setNuevoEmail(e.target.value.toLowerCase()); setNuevoEmailEditado(true); }}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-blue-900 focus:border-blue-900 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Teléfono / celular</label>
                    <input
                      type="tel"
                      placeholder="618-123-4567"
                      value={nuevoTelefono}
                      onChange={(e) => setNuevoTelefono(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-blue-900 focus:border-blue-900 outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* ADSCRIPCIÓN */}
              <div className="space-y-3">
                <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide">
                  Adscripción y puesto
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Departamento</label>
                    <input
                      type="text"
                      list="lista-deptos-itd"
                      placeholder="Ej. Sistemas y Computación"
                      value={nuevoDepartamento}
                      onChange={(e) => setNuevoDepartamento(e.target.value.toUpperCase())}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs uppercase bg-white focus:ring-2 focus:ring-blue-900 focus:border-blue-900 outline-none transition-colors"
                    />
                    <datalist id="lista-deptos-itd">
                      {(DEPARTAMENTOS_ITD || []).map((dep: string) => (
                        <option key={dep} value={dep.toUpperCase()} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Puesto / categoría</label>
                    <input
                      type="text"
                      placeholder="Ej. Profesor de carrera titular C"
                      value={nuevoPuesto}
                      onChange={(e) => setNuevoPuesto(e.target.value.toUpperCase())}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs uppercase bg-white focus:ring-2 focus:ring-blue-900 focus:border-blue-900 outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="flex gap-5 pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="nivelPuesto" value="D" checked={nuevoTipo === 'D'} onChange={() => setNuevoTipo('D')} />
                    <span className="text-slate-700">D — Docente</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="nivelPuesto" value="FD" checked={nuevoTipo === 'FD'} onChange={() => setNuevoTipo('FD')} />
                    <span className="text-slate-700">FD — Funcionario Docente</span>
                  </label>
                </div>
              </div>

              {/* ESTUDIOS Y DATOS PERSONALES */}
              <div className="space-y-3">
                <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide">
                  Nivel de estudios y datos personales
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Grado académico</label>
                    <select
                      value={nuevoNivelEstudios}
                      onChange={(e) => setNuevoNivelEstudios(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-blue-900 focus:border-blue-900 outline-none transition-colors"
                    >
                      <option value="Licenciatura">Licenciatura</option>
                      <option value="Especialidad">Especialidad</option>
                      <option value="Maestría">Maestría</option>
                      <option value="Doctorado">Doctorado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Género</label>
                    <select
                      value={nuevoGenero}
                      onChange={(e) => setNuevoGenero(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-blue-900 focus:border-blue-900 outline-none transition-colors"
                    >
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMostrarModalNuevo(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium text-xs transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#1B396A', color: '#ffffff' }}
                  className="px-5 py-2 hover:opacity-90 font-semibold rounded-lg text-xs transition-opacity"
                >
                  Guardar e inscribir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}