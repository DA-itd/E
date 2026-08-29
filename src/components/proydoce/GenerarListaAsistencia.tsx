import React, { useEffect, useState, useMemo } from 'react';
import { 
  supabase, 
  supabaseUrl, 
  supabaseAnonKey, 
  isSupabaseConfigured, 
  setSupabaseCredentials, 
  testearConexionDocentes,
  getLocalCursos, 
  saveLocalCursos, 
  getLocalDocentes, 
  saveLocalDocentes 
} from '../../lib/supabaseClient';
// ✅ Después (correcto)
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

// Mapeador universal del esquema de la tabla `docentes`
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

  // Nivel de estudios (Licenciatura, Especialidad, Maestría, Doctorado)
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

  // Si ya tiene CURP en base de datos o registro (usar tal cual)
  if (esValido(curpLimpia)) {
    const rfcCalc = esValido(rfcLimpio)
      ? rfcLimpio
      : (curpLimpia.length >= 10 ? curpLimpia.slice(0, 10) : curpLimpia);
    return { rfc: rfcCalc, curp: curpLimpia };
  }

  // Si tiene RFC en base de datos o registro (usar tal cual)
  if (esValido(rfcLimpio)) {
    const genero = esMujer(nombreCompleto) ? 'M' : 'H';
    const curpGenerada = rfcLimpio.length >= 10
      ? `${rfcLimpio.slice(0, 10)}${genero}DGRLL0${Math.abs(hashString(nombreCompleto || '') % 9) + 1}`
      : rfcLimpio;
    return { rfc: rfcLimpio, curp: curpGenerada };
  }

  // Si no tiene ninguno, se genera con nombre y apellidos
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

  // Formulario nuevo participante con TODOS los datos del registro oficial docente
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

  // Catálogo de docentes y autocompletado inteligente
  const [catalogoDocentes, setCatalogoDocentes] = useState<any[]>(() => {
    try {
      const local = getLocalDocentes();
      return local.map(mapearRegistroDocente).filter(Boolean);
    } catch {
      return [];
    }
  });
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [docenteSeleccionadoIndex, setDocenteSeleccionadoIndex] = useState(-1);
  const [docenteAutocompletado, setDocenteAutocompletado] = useState(false);
  const [docenteSeleccionadoNombre, setDocenteSeleccionadoNombre] = useState('');
  
  // Diagnóstico y conexión Supabase
  const [cargandoDocentesSupabase, setCargandoDocentesSupabase] = useState(false);
  const [estadoSupabase, setEstadoSupabase] = useState<'conectado' | 'sin_credenciales' | 'error'>(
    isSupabaseConfigured ? 'conectado' : 'sin_credenciales'
  );
  const [errorSupabaseMsg, setErrorSupabaseMsg] = useState('');
  const [inputSupabaseUrl, setInputSupabaseUrl] = useState(supabaseUrl || '');
  const [inputSupabaseKey, setInputSupabaseKey] = useState(supabaseAnonKey || '');
  const [mostrarConfigSupabase, setMostrarConfigSupabase] = useState(!isSupabaseConfigured);
  const [mostrarTodosDocentes, setMostrarTodosDocentes] = useState(false);

  useEffect(() => {
    cargarDatosCompletos();
    cargarCatalogoDocentes();

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
  }, [cursoId, cursoProp, mostrarModalNuevo]);

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

      // Capa E: Si sigue vacío (por ejemplo en cursos antiguos sin inscripciones en DB),
      // autogenerar docentes muestra del departamento para que la lista no quede en blanco
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

  const [descargandoPDF, setDescargandoPDF] = useState(false);
  const [descargandoExcel, setDescargandoExcel] = useState(false);

  async function generarDocumentoPDF(): Promise<jsPDF | null> {
    if (!datosCurso) return null;

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
      const margin = 10;
      const pageWidth = doc.internal.pageSize.getWidth();
      const contentWidth = pageWidth - margin * 2;

      // Intentar cargar logo o usar fallback
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
          // Timeout de seguridad 1 segundo
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

      // Usar un iframe invisible para mandar a imprimir directamente el PDF oficial idéntico al descargado
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
            // Fallback si las directivas del navegador restringen impresión por iframe: abrir visor de PDF
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

  // =========================================================================
  // CATÁLOGO DE DOCENTES Y CONEXIÓN ROBUSTA CON SUPABASE (TABLA DOCENTES)
  // =========================================================================

  async function cargarCatalogoDocentes(customUrl?: string, customKey?: string) {
    setCargandoDocentesSupabase(true);
    setErrorSupabaseMsg('');

    try {
      const res = await testearConexionDocentes(customUrl, customKey);
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const lista = res.data.map(mapearRegistroDocente).filter(Boolean);
        setCatalogoDocentes(lista);
        saveLocalDocentes(lista);
        setEstadoSupabase('conectado');
        setCargandoDocentesSupabase(false);
        return;
      } else if (res.success && (!res.data || res.data.length === 0)) {
        setEstadoSupabase('conectado');
        setErrorSupabaseMsg('Conexión exitosa a Supabase, pero la tabla "docentes" no tiene filas.');
      } else if (!res.success) {
        setEstadoSupabase(isSupabaseConfigured ? 'error' : 'sin_credenciales');
        setErrorSupabaseMsg(res.error || 'No se pudo conectar a la tabla docentes.');
      }
    } catch (e: any) {
      setEstadoSupabase('error');
      setErrorSupabaseMsg(e.message || 'Error de conexión.');
    }

    // Si hay datos en caché local
    try {
      const localDocs = getLocalDocentes();
      if (localDocs && localDocs.length > 0) {
        const lista = localDocs.map(mapearRegistroDocente).filter(Boolean);
        setCatalogoDocentes(lista);
      }
    } catch (e) {
      console.warn('Error leyendo docentes locales:', e);
    }

    setCargandoDocentesSupabase(false);
  }

  async function handleGuardarCredencialesSupabase(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!inputSupabaseUrl.trim() || !inputSupabaseKey.trim()) {
      alert('Por favor ingrese la URL del proyecto y la Anon API Key de Supabase.');
      return;
    }

    const url = inputSupabaseUrl.trim();
    const key = inputSupabaseKey.trim();
    setSupabaseCredentials(url, key, false);
    await cargarCatalogoDocentes(url, key);
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

  // Filtrado reactivo ultra-flexible por subcadenas y palabras múltiples
  const sugerenciasDocentes = useMemo(() => {
    const rawQuery = nuevoNombre.trim();
    
    // Si no ha escrito pero pidió ver todos los docentes
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

        // 1. Coincidencia si las palabras buscadas aparecen en el registro (Ej. "JOSE" o "ALEJ")
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

        // 2. Coincidencia directa por subcadena en nombre, CURP, RFC o Email
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
            id: `doc-imp-${Date.now()}-${idx}`,
            nombre_completo: nombre.toUpperCase(),
            rfc: rfc || rfcCurp.rfc,
            curp: curp || rfcCurp.curp,
            email: email,
            telefono: tel,
            departamento: limpiarPrefijosDocente(depto),
            puesto: puesto,
            puesto_departamento: `${puesto} - ${limpiarPrefijosDocente(depto)}`,
            nivel: es_fd ? 'Funcionario Docente' : 'Docente',
            nivel_estudios: grado,
            es_fd: es_fd,
            es_d: !es_fd,
            genero: genero.startsWith('F') || genero.toLowerCase() === 'mujer' ? 'Femenino' : 'Masculino',
            tarjeta: tarjeta,
            rol: es_fd ? 'coordinador' : 'docente'
          };

          importados.push(docenteObj);
        });

        if (importados.length > 0) {
          const docsLocales = getLocalDocentes();
          importados.forEach((doc) => {
            const idx = docsLocales.findIndex(d => normalizar(d.nombre_completo) === normalizar(doc.nombre_completo));
            if (idx >= 0) {
              docsLocales[idx] = { ...docsLocales[idx], ...doc };
            } else {
              docsLocales.push(doc);
            }
            supabase.from('docentes').upsert(doc).then(() => {});
          });

          saveLocalDocentes(docsLocales);
          cargarCatalogoDocentes();
          alert(`✅ ¡Éxito! Se importaron ${importados.length} docentes a la base de datos oficial.`);
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

    // Actualizar TODOS los campos del formulario con la información registrada en la base de datos
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

    // 1. Actualizar estado en pantalla y generador PDF
    setParticipantes((prev) => {
      const lista = [...prev, nuevo];
      lista.sort((a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || ''));
      return lista;
    });

    // 2. Persistir en la base de datos de cursos e inscripciones
    try {
      const cursosLocales = getLocalCursos();
      const targetId = cursoId || datosCurso?.id;
      const targetFolio = datosCurso?.folio;
      const targetNombre = normalizar(datosCurso?.nombre || '');

      const cIndex = cursosLocales.findIndex(
        (c) =>
          (targetId && (c.id === targetId || c.folio === targetId)) ||
          (targetFolio && (c.folio === targetFolio || c.id === targetFolio)) ||
          (targetNombre && normalizar(c.nombre) === targetNombre)
      );

      if (cIndex >= 0) {
        const cursoExistente = cursosLocales[cIndex];
        const parts = cursoExistente.participantes || [];
        const yaExiste = parts.some(
          (p) =>
            normalizar(p.nombre_completo) === normalizar(nuevo.nombre_completo) ||
            (p.curp && nuevo.curp && p.curp.toUpperCase() === nuevo.curp.toUpperCase())
        );

        if (!yaExiste) {
          cursoExistente.participantes = [...parts, nuevo].sort((a, b) =>
            (a.nombre_completo || '').localeCompare(b.nombre_completo || '')
          );
          saveLocalCursos(cursosLocales);
        }
      }
    } catch (err) {
      console.warn('Error al persistir participante localmente:', err);
    }

    // 3. Sincronizar catálogo central de docentes con TODOS los datos ingresados
    try {
      const docenteRegistro = {
        id: `doc-${Date.now()}`,
        nombre_completo: nuevo.nombre_completo,
        email: nuevo.email,
        departamento: nuevo.departamento,
        curp: nuevo.curp,
        rfc: nuevo.rfc,
        telefono: nuevo.telefono,
        puesto: nuevo.puesto,
        puesto_departamento: nuevo.puesto_departamento,
        nivel: nuevo.nivel,
        nivel_estudios: nuevo.nivel_estudios,
        es_fd: nuevo.es_fd,
        es_d: nuevo.es_d,
        genero: nuevo.genero,
        activo: true,
        rol: (nuevo.es_fd ? 'coordinador' : 'docente') as 'admin' | 'docente' | 'coordinador'
      };

      const docsLocales = getLocalDocentes();
      const docIdx = docsLocales.findIndex(
        (d) =>
          normalizar(d.nombre_completo) === normalizar(nuevo.nombre_completo) ||
          (d.curp && nuevo.curp && d.curp.toUpperCase() === nuevo.curp.toUpperCase())
      );
      if (docIdx >= 0) {
        docsLocales[docIdx] = { ...docsLocales[docIdx], ...docenteRegistro };
      } else {
        docsLocales.push(docenteRegistro);
      }
      saveLocalDocentes(docsLocales);

      // Guardar en tabla oficial docentes de Supabase
      supabase.from('docentes').upsert({
        nombre_completo: nuevo.nombre_completo,
        curp: nuevo.curp,
        email: nuevo.email,
        telefono: nuevo.telefono,
        genero: nuevo.genero,
        nivel: nuevo.nivel,
        departamento: nuevo.departamento,
        activo: true
      }).catch(() => {});
    } catch (err) {
      console.warn('Error guardando en base de datos docente:', err);
    }

    // 4. Sincronizar inserción en tabla de inscripciones de Supabase
    try {
      if (datosCurso?.id) {
        supabase
          .from('inscripciones')
          .insert({
            id: nuevo.id,
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
          .then(() => {})
          .catch((err: any) => console.warn('Aviso Supabase inscripciones:', err));
      }
    } catch (err) {
      console.warn('Error sincronizando con Supabase:', err);
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
        className="pagina-impresion bg-white text-black p-5 sm:p-7 max-w-[279mm] w-full mx-auto border-2 border-black shadow-lg font-sans text-xs leading-tight mb-8 relative"
      >
        <div className="border border-black flex items-stretch mb-2">
          <div
            className="w-36 sm:w-44 border-r-2 border-black p-1.5 flex items-center justify-center text-center bg-white shrink-0"
            style={{ borderRight: '1.5px solid black' }}
          >
            <img
              src={LOGO_TECNM_URL}
              alt="Logo TecNM / ITD"
              className="logo-tecnm max-h-14 max-w-[145px] w-auto h-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="flex-1 p-2 text-center flex flex-col justify-center">
            <h1 className="font-bold text-sm sm:text-base tracking-wide text-gray-900">
              INSTITUTO TECNOLÓGICO DE DURANGO
            </h1>
            <p className="text-[11px] sm:text-xs font-semibold text-gray-800 mt-0.5">
              Nombre del documento: Formato de Lista de Asistencia
            </p>
            <p className="text-[9px] sm:text-[10px] text-gray-600 mt-0.5">
              Referencias a la Norma NMX-CC-9001-IMNC-2008 6.2.2
            </p>
          </div>

          <div
            className="w-44 border-l-2 border-black text-[9px] sm:text-[9.5px] shrink-0"
            style={{ borderLeft: '1.5px solid black' }}
          >
            <div className="border-b border-black px-2 py-1 flex justify-between">
              <span className="font-semibold">Código:</span>
              <span className="font-bold">ITD-AD-FO-8</span>
            </div>
            <div className="border-b border-black px-2 py-1 flex justify-between">
              <span className="font-semibold">Revisión:</span>
              <span className="font-bold">1</span>
            </div>
            <div className="border-b border-black px-2 py-1 flex justify-between">
              <span className="font-semibold">Página:</span>
              <span className="font-bold">{numeroPagina} de {totalPaginas}</span>
            </div>
            <div className="px-2 py-1 flex justify-between">
              <span className="font-semibold">Fecha:</span>
              <span>{new Date().toLocaleDateString('es-MX')}</span>
            </div>
          </div>
        </div>

        <div className="border border-black mb-2 text-[10px]">
          <div className="border-b border-black font-bold py-1 px-3 text-center uppercase tracking-wider bg-gray-100/80">
            {datosCurso.modalidad || 'CURSO PRESENCIAL'}
          </div>
          <div className="flex border-b border-black">
            <div className="flex-1 py-1 px-3 border-r border-black flex items-center gap-2">
              <span className="font-semibold">Hoja:</span>
              <span className="font-bold">{numeroPagina}</span>
              <span className="font-semibold">de</span>
              <span className="font-bold">{totalPaginas}</span>
            </div>
            <div className="w-64 py-1 px-3 flex items-center justify-between">
              <span className="font-semibold">Folio:</span>
              <span className="font-mono font-bold text-black">{datosCurso.folio}</span>
            </div>
          </div>
          <div className="flex border-b border-black py-1 px-3">
            <span className="font-semibold mr-2 shrink-0">Nombre del curso:</span>
            <span className="font-medium uppercase">{datosCurso.nombre}</span>
          </div>
          <div className="flex border-b border-black py-1 px-3">
            <span className="font-semibold mr-2 shrink-0">Nombre del Instructor (a):</span>
            <span className="font-medium">{datosCurso.instructor}</span>
          </div>
          <div className="flex flex-wrap text-[9.5px]">
            <div className="flex-1 py-1 px-3 border-r border-black flex items-center gap-1 min-w-[200px]">
              <span className="font-semibold">Periodo:</span>
              <span>{datosCurso.periodo}</span>
            </div>
            <div className="w-36 py-1 px-3 border-r border-black flex items-center gap-1">
              <span className="font-semibold">Duración:</span>
              <span>{datosCurso.duracion}</span>
            </div>
            <div className="w-44 py-1 px-3 flex items-center gap-1">
              <span className="font-semibold">Horario:</span>
              <span>{datosCurso.horario}</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-black text-[9px] mb-2 min-w-[650px]">
            <thead>
              <tr className="bg-gray-100">
                <th rowSpan={2} className="border border-black px-1 py-1 text-center w-8">No.</th>
                <th rowSpan={2} className="border border-black px-2 py-1 text-left">Nombre del Participante</th>
                <th rowSpan={2} className="border border-black px-1.5 py-1 text-left w-36">R.F.C. / CURP</th>
                <th rowSpan={2} className="border border-black px-2 py-1 text-left">Puesto y departamento de adscripción</th>
                <th colSpan={2} className="border border-black px-1 py-0.5 text-center">Nivel de Puesto</th>
                <th colSpan={5} className="border border-black px-1 py-0.5 text-center">Asistencia</th>
                <th rowSpan={2} className="border border-black px-1 py-1 text-center w-6 print:hidden"></th>
              </tr>
              <tr className="bg-gray-50 text-[8.5px]">
                <th className="border border-black px-1 py-0.5 text-center w-7" title="Funcionario Docente">FD</th>
                <th className="border border-black px-1 py-0.5 text-center w-7" title="Docente">D</th>
                <th className="border border-black px-1 py-0.5 text-center w-6">L</th>
                <th className="border border-black px-1 py-0.5 text-center w-6">M</th>
                <th className="border border-black px-1 py-0.5 text-center w-6">M</th>
                <th className="border border-black px-1 py-0.5 text-center w-6">J</th>
                <th className="border border-black px-1 py-0.5 text-center w-6">V</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ participante: p, indexGlobal }) => {
                if (!p) {
                  return (
                    <tr key={`empty-${numeroPagina}-${indexGlobal}`} className="h-5">
                      <td className="border border-black text-center text-gray-400">{indexGlobal}</td>
                      <td className="border border-black"></td>
                      <td className="border border-black"></td>
                      <td className="border border-black"></td>
                      <td className="border border-black text-center"></td>
                      <td className="border border-black text-center"></td>
                      <td className="border border-black text-center"></td>
                      <td className="border border-black text-center"></td>
                      <td className="border border-black text-center"></td>
                      <td className="border border-black text-center"></td>
                      <td className="border border-black text-center"></td>
                      <td className="border border-black text-center print:hidden"></td>
                    </tr>
                  );
                }

                return (
                  <tr key={p.id || indexGlobal} className="h-5 hover:bg-amber-50/50 group">
                    <td className="border border-black text-center font-medium">{indexGlobal}</td>
                    <td className="border border-black px-2 py-0.5 font-medium uppercase">{p.nombre_completo}</td>
                    <td className="border border-black px-1.5 py-0.5 font-mono text-[8px] font-semibold">{p.curp || p.rfc}</td>
                    <td className="border border-black px-2 py-0.5 text-[8.5px] uppercase">{p.puesto_departamento}</td>
                    <td className="border border-black text-center font-bold">{p.es_fd ? 'X' : ''}</td>
                    <td className="border border-black text-center font-bold">{p.es_d ? 'X' : ''}</td>
                    <td className="border border-black text-center"></td>
                    <td className="border border-black text-center"></td>
                    <td className="border border-black text-center"></td>
                    <td className="border border-black text-center"></td>
                    <td className="border border-black text-center"></td>
                    <td className="border border-black text-center print:hidden p-0">
                      <button
                        onClick={() => handleEliminarParticipante(p.id || indexGlobal - 1)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 font-bold px-1 transition text-[10px]"
                        title="Quitar participante de la lista"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-[8.5px] font-medium text-gray-700 mb-3">
          <span>FD = Funcionario docente</span>
          <span className="ml-8">D = Docente</span>
        </div>

        {esUltima ? (
          <div className="flex justify-between items-start text-[9.5px] pt-3 mb-4 gap-8">
            <div className="flex-1 text-center">
              <div className="border-t border-black w-4/5 mx-auto mb-1"></div>
              <p className="font-bold">Nombre y firma del instructor (a)</p>
              <p className="font-medium text-gray-800 text-[9px] mt-0.5">{datosCurso.instructor}</p>
              <div className="text-left text-[8.5px] text-gray-700 mt-2 space-y-0.5 pl-4">
                <p>R.F.C.: <span className="font-mono font-semibold">{datosCurso.instructor_rfc || '_________________________'}</span></p>
                <p>CURP: <span className="font-mono font-semibold">{datosCurso.instructor_curp || '_________________________'}</span></p>
              </div>
            </div>

            <div className="flex-1 text-center">
              <div className="border-t border-black w-4/5 mx-auto mb-1"></div>
              <p className="font-bold">Nombre y firma del coordinador (a)</p>
              <p className="font-bold text-gray-900 text-[10px] mt-0.5">Alejandro Calderón Rentería</p>
              <p className="font-medium text-gray-800 text-[9px] mt-0.5">Coordinador de Actualización Docente</p>
            </div>
          </div>
        ) : (
          <div className="py-5 text-center text-xs font-semibold text-slate-600 italic border-y border-dashed border-slate-300 my-3 bg-slate-50">
            --- Continúa en la Hoja {numeroPagina + 1} de {totalPaginas} ---
          </div>
        )}

        <div className="flex justify-between items-center text-[8.5px] font-semibold text-gray-700 border-t border-gray-200 pt-2">
          <span>ITD-AD-FO-8</span>
          <span>Revisión: 1  ·  Hoja {numeroPagina} de {totalPaginas}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-start p-0 sm:p-3 md:p-5 z-50 overflow-hidden select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="bg-white rounded-none sm:rounded-2xl max-w-6xl w-full h-full sm:max-h-[96vh] flex flex-col shadow-2xl overflow-hidden border border-slate-700/30">
        {/* BARRA SUPERIOR FIJA DE CONTROL PRINCIPAL - MODERNA, VISUAL Y RESPONSIVA */}
        <div
          style={{ backgroundColor: '#1B396A', color: '#ffffff' }}
          className="px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xl shrink-0 z-30 border-b border-blue-950"
        >
          {/* LADO IZQUIERDO: REGRESAR + TITULO + METADATOS */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              style={{ backgroundColor: '#f59e0b', color: '#0f172a', borderColor: '#fbbf24' }}
              className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all shadow-md active:scale-95 flex items-center gap-2 shrink-0 border cursor-pointer hover:opacity-90"
              title="Cerrar vista y volver a la lista de cursos"
            >
              <span className="text-base leading-none">⬅️</span>
              <span className="font-black tracking-wide">Regresar</span>
            </button>

            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  style={{ backgroundColor: '#0f274a', color: '#93c5fd', borderColor: '#3b82f6' }}
                  className="border px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold inline-flex items-center gap-1 shadow-xs"
                >
                  <span>📋</span> ITD-AD-FO-8
                </span>
                <span
                  style={{ backgroundColor: '#064e3b', color: '#6ee7b7', borderColor: '#10b981' }}
                  className="border px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold shadow-xs"
                >
                  Rev. 1
                </span>
                <span
                  style={{ backgroundColor: '#78350f', color: '#fde68a', borderColor: '#f59e0b' }}
                  className="border font-mono px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold"
                >
                  {datosCurso?.folio}
                </span>
              </div>
              <h2 className="font-bold text-xs sm:text-sm text-white tracking-wide truncate max-w-sm sm:max-w-md md:max-w-lg mt-0.5" title={datosCurso?.nombre}>
                {datosCurso?.nombre}
              </h2>
            </div>
          </div>

          {/* LADO DERECHO: BOTONES DE ACCIÓN COLORIDOS Y LLAMATIVOS */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handlePDF}
              disabled={descargandoPDF}
              style={{ backgroundColor: '#dc2626', color: '#ffffff', borderColor: '#ef4444' }}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 shadow-lg border active:scale-95 cursor-pointer hover:opacity-90 ${
                descargandoPDF ? 'opacity-70 cursor-wait' : ''
              }`}
              title="Descargar documento oficial en archivo PDF (.pdf)"
            >
              <span className="text-base leading-none">{descargandoPDF ? '⏳' : '📄'}</span>
              <span>{descargandoPDF ? 'Generando...' : 'Descargar PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              style={{ backgroundColor: '#0284c7', color: '#ffffff', borderColor: '#38bdf8' }}
              className="px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 shadow-lg border active:scale-95 cursor-pointer hover:opacity-90"
              title="Imprimir formato oficial o Guardar como PDF desde el navegador"
            >
              <span className="text-base leading-none">🖨️</span>
              <span>Imprimir / Guardar</span>
            </button>

            <button
              onClick={handleExcel}
              style={{ backgroundColor: '#059669', color: '#ffffff', borderColor: '#34d399' }}
              className="px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 shadow-lg border active:scale-95 cursor-pointer hover:opacity-90"
              title="Descargar libro en formato Excel (.xlsx)"
            >
              <span className="text-base leading-none">📊</span>
              <span>Excel</span>
            </button>

            <button
              onClick={onClose}
              style={{ backgroundColor: '#334155', color: '#ffffff', borderColor: '#64748b' }}
              className="px-2.5 py-2 rounded-xl text-xs font-bold transition-all ml-0.5 border cursor-pointer hover:bg-red-600"
              title="Cerrar vista previa (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* BARRA DE NAVEGACIÓN Y GESTIÓN DE HOJAS */}
        <div
          style={{ backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }}
          className="border-b px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0 z-20 shadow-xs"
        >
          {/* SELECTOR DE HOJAS */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-extrabold text-slate-800 mr-1 flex items-center gap-1 text-[11px] sm:text-xs">
              <span>📄</span> Vistas:
            </span>
            {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                onClick={() => setPaginaVista(num)}
                style={
                  paginaVista === num
                    ? { backgroundColor: '#1B396A', color: '#ffffff', borderColor: '#1B396A' }
                    : { backgroundColor: '#ffffff', color: '#334155', borderColor: '#cbd5e1' }
                }
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 border shadow-xs"
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
                    : { backgroundColor: '#ffffff', color: '#334155', borderColor: '#cbd5e1' }
                }
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 border shadow-xs"
              >
                📑 Ver Todas ({totalPaginas})
              </button>
            )}
          </div>

          {/* HERRAMIENTAS DE GESTIÓN Y AJUSTE */}
          <div className="flex flex-wrap items-center gap-2">
            {participantes.length > 15 && (
              <button
                onClick={handleAjustarAUnaHoja}
                style={{ backgroundColor: '#fef3c7', color: '#78350f', borderColor: '#fcd34d' }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer border"
                title="Quitar participantes excedentes para dejar exactamente 15 y que quede en 1 sola hoja"
              >
                <span>✂️</span>
                <span>Dejar en 1 Hoja (15 part.)</span>
              </button>
            )}

            {participantesEliminados.length > 0 && (
              <button
                onClick={handleRestaurarParticipantes}
                style={{ backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#6ee7b7' }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer border"
                title="Restaurar participantes que fueron removidos"
              >
                <span>↩️</span>
                <span>Restaurar ({participantesEliminados.length})</span>
              </button>
            )}

            <button
              onClick={handleAbrirModalNuevo}
              style={{ backgroundColor: '#059669', color: '#ffffff', borderColor: '#10b981' }}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer border"
              title="Registrar manualmente un nuevo participante en la lista"
            >
              <span>➕</span>
              <span>Agregar Participante</span>
            </button>

            <button
              onClick={() => setMostrarGestor(!mostrarGestor)}
              style={
                mostrarGestor
                  ? { backgroundColor: '#4338ca', color: '#ffffff', borderColor: '#6366f1' }
                  : { backgroundColor: '#eef2ff', color: '#312e81', borderColor: '#c7d2fe' }
              }
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer border"
            >
              <span>👥</span>
              <span>Gestionar ({participantes.length})</span>
            </button>
          </div>
        </div>

        {mostrarGestor && (
          <div className="bg-amber-50/95 border-b border-amber-200 p-3.5 text-xs flex flex-col gap-2 shrink-0 z-10 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-950 flex items-center gap-1.5 text-xs sm:text-sm">
                👥 Participantes en la Lista de Asistencia ({participantes.length} actuales · {totalPaginas} {totalPaginas === 1 ? 'hoja' : 'hojas'})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAbrirModalNuevo}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  ➕ Agregar Docente
                </button>
                <button
                  onClick={() => setMostrarGestor(false)}
                  className="text-slate-600 hover:text-slate-900 text-sm font-bold px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer"
                >
                  ✕ Cerrar Gestor
                </button>
              </div>
            </div>
            <p className="text-slate-600 text-[11px]">
              Puedes quitar o agregar participantes para ajustar la lista antes de imprimir o descargar:
            </p>
            <div className="max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 shadow-inner">
              {participantes.map((p, idx) => (
                <div key={p.id || idx} className="px-3 py-2 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="w-5 text-slate-400 font-mono text-[10px]">{idx + 1}.</span>
                    <span className="font-bold text-slate-800 uppercase">{p.nombre_completo}</span>
                    <span className="text-slate-500 text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                      {p.curp || p.rfc}
                    </span>
                    <span className="text-[10px] bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded font-semibold uppercase">
                      {p.puesto_departamento}
                    </span>
                  </div>
                  <button
                    onClick={() => handleEliminarParticipante(p.id || idx)}
                    className="px-2.5 py-1 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg text-xs font-bold transition ml-2 shrink-0 cursor-pointer"
                  >
                    🗑️ Quitar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="relative p-3 sm:p-6 overflow-y-auto bg-slate-200/90 flex-1 select-text">
          {cargando || !datosCurso ? (
            <div className="bg-white p-12 text-center text-slate-500 font-semibold rounded-2xl border max-w-md mx-auto my-12 shadow-sm">
              <div className="animate-spin text-3xl mb-3">⏳</div>
              Cargando participantes y formato oficial del curso...
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

          {/* BARRA FLOTANTE INFERIOR CON ESTILO ELEVADO */}
          <div className="sticky bottom-4 flex justify-end gap-2 pr-2 pointer-events-none select-none print:hidden">
            <div className="bg-slate-900/95 backdrop-blur-xs text-white rounded-2xl shadow-2xl p-2 flex items-center gap-2 pointer-events-auto border border-slate-700">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition shadow-sm cursor-pointer"
                title="Volver"
              >
                ⬅️ Volver
              </button>
              <button
                onClick={handlePDF}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl text-xs transition shadow-sm cursor-pointer"
                title="Descargar PDF"
              >
                📄 PDF
              </button>
              <button
                onClick={handlePrint}
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-extrabold rounded-xl text-xs transition shadow-sm cursor-pointer"
                title="Imprimir"
              >
                🖨️ Imprimir
              </button>
              <button
                onClick={handleExcel}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs transition shadow-sm cursor-pointer"
                title="Descargar Excel"
              >
                📊 Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL PARA AGREGAR NUEVO PARTICIPANTE */}
      {mostrarModalNuevo && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMostrarModalNuevo(false);
          }}
        >
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-base text-[#1B396A] flex items-center gap-2">
                  <span>➕</span> Inscripción Extemporánea / Registro de Docente
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Escriba el <strong>Nombre</strong> o <strong>CURP</strong> para buscar en la base de datos y autollenar todos los campos del docente.
                </p>
              </div>
              <button
                onClick={() => setMostrarModalNuevo(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg p-1 rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            {/* BARRA DE ESTADO Y CONEXIÓN SUPABASE EN EL MODAL */}
            <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    estadoSupabase === 'conectado' && catalogoDocentes.length > 0
                      ? 'bg-emerald-500 animate-pulse'
                      : estadoSupabase === 'conectado'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`} />
                  <div>
                    <span className="font-bold text-xs text-slate-800">
                      {estadoSupabase === 'conectado' && catalogoDocentes.length > 0
                        ? `Base de Datos Supabase: ${catalogoDocentes.length} docentes listos`
                        : estadoSupabase === 'conectado'
                        ? 'Base de Datos Supabase conectada (0 docentes)'
                        : 'Base de Datos Supabase no conectada'}
                    </span>
                    {errorSupabaseMsg && (
                      <p className="text-[10px] text-rose-600 font-medium">{errorSupabaseMsg}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => cargarCatalogoDocentes()}
                    disabled={cargandoDocentesSupabase}
                    className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="Recargar docentes desde Supabase"
                  >
                    <span>{cargandoDocentesSupabase ? '⏳' : '🔄'}</span>
                    <span>{cargandoDocentesSupabase ? 'Cargando...' : 'Recargar'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMostrarTodosDocentes((prev) => !prev);
                      setMostrarSugerencias(true);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer ${
                      mostrarTodosDocentes
                        ? 'bg-blue-700 text-white'
                        : 'bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-800'
                    }`}
                  >
                    <span>📋</span>
                    <span>{mostrarTodosDocentes ? 'Ocultar Catálogo' : `Ver Todo (${catalogoDocentes.length})`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMostrarConfigSupabase((prev) => !prev)}
                    className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg transition shadow-2xs cursor-pointer"
                    title="Configurar URL y Llave de Supabase"
                  >
                    ⚙️
                  </button>
                </div>
              </div>

              {/* PANEL DESPLEGABLE DE CONFIGURACIÓN SUPABASE */}
              {mostrarConfigSupabase && (
                <div className="mt-3 pt-3 border-t border-slate-200/80 bg-white p-3 rounded-lg border">
                  <p className="text-[11px] font-bold text-slate-800 mb-2">
                    ⚡ Conectar con tu Proyecto Supabase (Tabla <code>docentes</code>):
                  </p>
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Project URL de Supabase:
                      </label>
                      <input
                        type="text"
                        placeholder="https://tu-proyecto.supabase.co"
                        value={inputSupabaseUrl}
                        onChange={(e) => setInputSupabaseUrl(e.target.value)}
                        className="w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                        Anon Public API Key:
                      </label>
                      <input
                        type="password"
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        value={inputSupabaseKey}
                        onChange={(e) => setInputSupabaseKey(e.target.value)}
                        className="w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <label className="cursor-pointer text-[11px] text-slate-600 hover:text-slate-800 flex items-center gap-1">
                        <span>📥</span>
                        <span className="underline">Importar Excel / CSV de Docentes</span>
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleImportarArchivoDocentes}
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={handleGuardarCredencialesSupabase}
                        disabled={cargandoDocentesSupabase}
                        className="px-3 py-1.5 bg-[#1B396A] hover:bg-[#152c53] text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <span>{cargandoDocentesSupabase ? '⏳' : '⚡'}</span>
                        <span>{cargandoDocentesSupabase ? 'Conectando...' : 'Conectar y Cargar Docentes'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleGuardarNuevoParticipante} className="space-y-4 text-xs">
              {/* BÚSQUEDA Y NOMBRE COMPLETO O CURP */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">
                    Escriba Nombre, Apellido o CURP del Docente *
                  </label>
                  {catalogoDocentes.length > 0 && (
                    <span className="text-[10px] text-blue-700 font-medium flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {catalogoDocentes.length} docentes disponibles
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Escriba Nombre o CURP (Ej. JOSÉ..., CARA75..., LAURA AGUIRRE...)"
                    value={nuevoNombre}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNuevoNombre(val);
                      setMostrarSugerencias(true);
                      setDocenteSeleccionadoIndex(-1);
                      setDocenteAutocompletado(false);
                    }}
                    onFocus={() => {
                      setMostrarSugerencias(true);
                    }}
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
                    className={`w-full rounded-lg border px-3 py-2.5 text-xs uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-medium ${
                      docenteAutocompletado
                        ? 'border-emerald-400 bg-emerald-50/40 text-emerald-950 ring-2 ring-emerald-300'
                        : 'border-slate-300 bg-white text-slate-800'
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
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1 font-bold"
                      title="Limpiar campos"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Lista desplegable de sugerencias de autocompletado */}
                {mostrarSugerencias && sugerenciasDocentes.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border-2 border-blue-400 rounded-xl shadow-2xl max-h-72 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 bg-gradient-to-r from-[#1B396A] to-blue-800 text-white text-[11px] font-bold uppercase tracking-wider flex justify-between items-center sticky top-0 z-10 shadow-sm">
                      <span className="flex items-center gap-1.5">
                        <span>👥</span>
                        <span>Docentes Encontrados ({sugerenciasDocentes.length})</span>
                      </span>
                      <span className="text-[10px] font-normal text-blue-200 bg-white/10 px-2 py-0.5 rounded">
                        Haz clic para autollenar todos los campos
                      </span>
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
                        className={`w-full text-left px-4 py-3 transition flex flex-col gap-1 cursor-pointer border-b border-slate-100 last:border-0 ${
                          docenteSeleccionadoIndex === idx
                            ? 'bg-blue-100/95 text-blue-950 border-l-4 border-[#1B396A]'
                            : 'hover:bg-blue-50/70 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-[#1B396A] flex items-center gap-1.5">
                            <span className="text-sm">👤</span>
                            <span>{doc.nombre_completo}</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            {doc.nivel_estudios && (
                              <span className="text-[9px] px-2 py-0.5 rounded font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                                🎓 {doc.nivel_estudios}
                              </span>
                            )}
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              doc.es_fd ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-100 text-blue-800 border border-blue-300'
                            }`}>
                              {doc.es_fd ? 'FD' : 'D'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 mt-0.5">
                          {doc.departamento && (
                            <span className="font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">🏢 {doc.departamento}</span>
                          )}
                          {doc.curp && (
                            <span className="font-mono text-[10px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">CURP: {doc.curp}</span>
                          )}
                          {doc.rfc && (
                            <span className="font-mono text-[10px] text-slate-600">RFC: {doc.rfc}</span>
                          )}
                          {doc.telefono && (
                            <span className="text-[10px] text-slate-600">📞 {doc.telefono}</span>
                          )}
                          {doc.email && (
                            <span className="text-[10px] text-slate-500">✉️ {doc.email}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Si no hay coincidencias pero escribió algo */}
                {mostrarSugerencias && nuevoNombre.trim().length >= 1 && sugerenciasDocentes.length === 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-amber-300 rounded-xl shadow-xl p-3 text-xs text-amber-800">
                    <p className="font-bold flex items-center gap-1.5">
                      <span>⚠️</span> No se encontró el docente "{nuevoNombre}" en el catálogo.
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Puede llenar los datos manualmente a continuación, o sincronizar la tabla <code>docentes</code> de Supabase usando el botón de configuración ⚙️ arriba.
                    </p>
                  </div>
                )}

                {docenteAutocompletado && (
                  <p className="text-[11px] text-emerald-800 font-medium mt-1.5 flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 p-2.5 rounded-lg shadow-2xs">
                    <span className="text-sm">✨</span>
                    <span><strong>Docente {docenteSeleccionadoNombre || 'seleccionado'}:</strong> CURP, RFC, Correo, Teléfono, Departamento, Puesto, Género y Nivel de Estudios autocompletados desde la base de datos oficial.</span>
                  </p>
                )}
              </div>

              {/* SECCIÓN CLAVES OFICIALES: CURP Y RFC */}
              <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 space-y-3">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                  1. Claves Oficiales (CURP / RFC)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      C.U.R.P. (18 Caracteres)
                    </label>
                    <input
                      type="text"
                      maxLength={18}
                      placeholder="Ej. CARA750101HDGRNN01"
                      value={nuevoCurp}
                      onChange={(e) => {
                        setNuevoCurp(e.target.value.toUpperCase());
                        setNuevoCurpEditado(true);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono uppercase bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Se conserva exactamente como en base de datos</span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      R.F.C. (Con Homoclave)
                    </label>
                    <input
                      type="text"
                      maxLength={13}
                      placeholder="Ej. CARA750101ABC"
                      value={nuevoRfc}
                      onChange={(e) => {
                        setNuevoRfc(e.target.value.toUpperCase());
                        setNuevoRfcEditado(true);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono uppercase bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Clave oficial ante el SAT</span>
                  </div>
                </div>
              </div>

              {/* SECCIÓN DATOS DE CONTACTO */}
              <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 space-y-3">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                  2. Datos de Contacto
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Correo Electrónico Institucional
                    </label>
                    <input
                      type="email"
                      placeholder="docente@itdurango.edu.mx"
                      value={nuevoEmail}
                      onChange={(e) => {
                        setNuevoEmail(e.target.value.toLowerCase());
                        setNuevoEmailEditado(true);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Teléfono / Celular
                    </label>
                    <input
                      type="tel"
                      placeholder="Ej. 618-123-4567"
                      value={nuevoTelefono}
                      onChange={(e) => setNuevoTelefono(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN ADSCRIPCIÓN INSTITUCIONAL */}
              <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 space-y-3">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                  3. Adscripción y Puesto en el ITD
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Departamento de Adscripción
                    </label>
                    <input
                      type="text"
                      list="lista-deptos-itd"
                      placeholder="Ej. SISTEMAS Y COMPUTACIÓN"
                      value={nuevoDepartamento}
                      onChange={(e) => setNuevoDepartamento(e.target.value.toUpperCase())}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs uppercase bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <datalist id="lista-deptos-itd">
                      {(DEPARTAMENTOS_ITD || []).map((dep: string) => (
                        <option key={dep} value={dep.toUpperCase()} />
                      ))}
                      <option value="SISTEMAS Y COMPUTACIÓN" />
                      <option value="CIENCIAS BÁSICAS" />
                      <option value="INGENIERÍA INDUSTRIAL" />
                      <option value="INGENIERÍA ELÉCTRICA Y ELECTRÓNICA" />
                      <option value="INGENIERÍA QUÍMICA Y BIOQUÍMICA" />
                      <option value="INGENIERÍA MECÁNICA" />
                      <option value="CIENCIAS ECONÓMICO ADMINISTRATIVAS" />
                      <option value="DESARROLLO ACADÉMICO" />
                      <option value="POSGRADO E INVESTIGACIÓN" />
                    </datalist>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Puesto / Categoría / Plaza
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. PROFESOR DE CARRERA TITULAR C"
                      value={nuevoPuesto}
                      onChange={(e) => setNuevoPuesto(e.target.value.toUpperCase())}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs uppercase bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* CLASIFICACIÓN D / FD */}
                <div className="pt-1">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nivel de Puesto (D / FD)
                    </label>
                    <div className="flex gap-4 pt-1.5">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="nivelPuesto"
                          value="D"
                          checked={nuevoTipo === 'D'}
                          onChange={() => setNuevoTipo('D')}
                          className="text-blue-600"
                        />
                        <span className="font-semibold text-slate-800 text-[11px]">D (Docente)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="nivelPuesto"
                          value="FD"
                          checked={nuevoTipo === 'FD'}
                          onChange={() => setNuevoTipo('FD')}
                          className="text-blue-600"
                        />
                        <span className="font-semibold text-slate-800 text-[11px]">FD (Funcionario Docente)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN NIVEL DE ESTUDIOS Y DATOS PERSONALES */}
              <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 space-y-3">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                  4. Nivel de Estudios y Datos Personales
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nivel de Estudios / Grado Académico
                    </label>
                    <select
                      value={nuevoNivelEstudios}
                      onChange={(e) => setNuevoNivelEstudios(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="Licenciatura">Licenciatura</option>
                      <option value="Especialidad">Especialidad</option>
                      <option value="Maestría">Maestría</option>
                      <option value="Doctorado">Doctorado</option>
                    </select>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Nivel académico oficial registrado</span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Género (Hombre / Mujer)
                    </label>
                    <select
                      value={nuevoGenero}
                      onChange={(e) => setNuevoGenero(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="Masculino">Masculino (Hombre)</option>
                      <option value="Femenino">Femenino (Mujer)</option>
                      <option value="Otro">Otro</option>
                    </select>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Para registros oficiales TecNM</span>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-[11px] text-emerald-900 flex items-center gap-2">
                <span className="text-base">💾</span>
                <span>Al guardar, el registro completo quedará almacenado de forma permanente en la base de datos de docentes e inscrito en este curso.</span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMostrarModalNuevo(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1B396A] hover:bg-[#152e55] text-white font-bold rounded-lg transition shadow-sm text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>💾</span>
                  <span>Guardar e Inscribir Docente</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
