import { createClient } from '@supabase/supabase-js';
import { Curso, UsuarioDocente, FormatoConfig } from '../types';
import { MOCK_CURSOS_INICIALES, MOCK_USUARIOS_DOCENTES, DEFAULT_FORMATO_CONFIG } from '../data/mockData';

export const DOMINIO_PERMITIDO = 'itdurango.edu.mx';

const metaEnv = (import.meta as any).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || '';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://your-project.supabase.co');

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMockSupabase();

// Local Storage Keys
const LOCAL_STORAGE_CURSOS_KEY = 'itd_asistencia_cursos';
const LOCAL_STORAGE_DOCENTES_KEY = 'itd_asistencia_docentes';
const LOCAL_STORAGE_FORMATO_KEY = 'itd_asistencia_formato_config';

export function getLocalCursos(): Curso[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CURSOS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_CURSOS_KEY, JSON.stringify(MOCK_CURSOS_INICIALES));
      return MOCK_CURSOS_INICIALES;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading local cursos:', e);
    return MOCK_CURSOS_INICIALES;
  }
}

export function saveLocalCursos(cursos: Curso[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_CURSOS_KEY, JSON.stringify(cursos));
  } catch (e) {
    console.error('Error saving local cursos:', e);
  }
}

export function getLocalFormatoConfig(): FormatoConfig {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_FORMATO_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_FORMATO_KEY, JSON.stringify(DEFAULT_FORMATO_CONFIG));
      return DEFAULT_FORMATO_CONFIG;
    }
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_FORMATO_CONFIG;
  }
}

export function saveLocalFormatoConfig(config: FormatoConfig): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_FORMATO_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Error saving formato config:', e);
  }
}

export function getLocalDocentes(): UsuarioDocente[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DOCENTES_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_DOCENTES_KEY, JSON.stringify(MOCK_USUARIOS_DOCENTES));
      return MOCK_USUARIOS_DOCENTES;
    }
    return JSON.parse(raw);
  } catch (e) {
    return MOCK_USUARIOS_DOCENTES;
  }
}

export function saveLocalDocentes(docentes: UsuarioDocente[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_DOCENTES_KEY, JSON.stringify(docentes));
  } catch (e) {
    console.error('Error saving local docentes:', e);
  }
}

// ----------------------------------------------------
// Departmental List Permissions (Delegados por Departamento)
// ----------------------------------------------------
const LOCAL_STORAGE_PERMISOS_KEY = 'itd_permisos_departamentos';

const MOCK_PERMISOS_INICIALES: any[] = [];

export function getPermisosDepartamentos(): any[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PERMISOS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_PERMISOS_KEY, JSON.stringify(MOCK_PERMISOS_INICIALES));
      return MOCK_PERMISOS_INICIALES;
    }
    return JSON.parse(raw);
  } catch (e) {
    return MOCK_PERMISOS_INICIALES;
  }
}

export function guardarPermisoDepartamento(permiso: any): any[] {
  try {
    const permisos = getPermisosDepartamentos();
    // Reemplazar si ya existe para ese email, o agregar
    const filtrados = permisos.filter(p => p.email.toLowerCase() !== permiso.email.toLowerCase());
    filtrados.push({
      ...permiso,
      id: permiso.id || `perm-${Date.now()}`,
      fecha_asignacion: permiso.fecha_asignacion || new Date().toISOString().split('T')[0],
      activo: true
    });
    localStorage.setItem(LOCAL_STORAGE_PERMISOS_KEY, JSON.stringify(filtrados));
    return filtrados;
  } catch (e) {
    console.error('Error guardando permiso:', e);
    return getPermisosDepartamentos();
  }
}

export function eliminarPermisoDepartamento(id: string): any[] {
  try {
    const permisos = getPermisosDepartamentos();
    const filtrados = permisos.filter(p => p.id !== id && p.email !== id);
    localStorage.setItem(LOCAL_STORAGE_PERMISOS_KEY, JSON.stringify(filtrados));
    return filtrados;
  } catch (e) {
    console.error('Error eliminando permiso:', e);
    return getPermisosDepartamentos();
  }
}

export function obtenerDepartamentoAsignadoUsuario(email: string): string | null {
  if (!email) return null;
  const normalizado = email.trim().toLowerCase();
  const permisos = getPermisosDepartamentos();
  const perm = permisos.find(p => p.email.toLowerCase() === normalizado && p.activo !== false);
  return perm ? perm.departamento : null;
}


function createMockSupabase(): any {
  return {
    auth: {
      async getSession() {
        return {
          data: {
            session: {
              user: {
                email: 'coord_actualizaciondocente@itdurango.edu.mx',
                user_metadata: { name: 'Alejandro Calderon Rentería' }
              }
            }
          }
        };
      },
      onAuthStateChange(callback: any) {
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      async signOut() {
        return { error: null };
      }
    },
    from(tableName: string) {
      return {
        insert(records: any) {
          const arr = Array.isArray(records) ? records : [records];
          if (tableName === 'inscripciones') {
            const cursos = getLocalCursos();
            arr.forEach((rec) => {
              const c = cursos.find((item) => item.id === rec.curso_id || item.folio === rec.folio_curso);
              if (c) {
                if (!c.participantes) c.participantes = [];
                const yaExiste = c.participantes.some(
                  (p) =>
                    p.nombre_completo === rec.nombre_completo ||
                    (p.curp && rec.curp && p.curp.toUpperCase() === rec.curp.toUpperCase())
                );
                if (!yaExiste) {
                  c.participantes.push({
                    id: rec.id || `p-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                    nombre_completo: rec.nombre_completo,
                    rfc: rec.rfc,
                    curp: rec.curp,
                    email: rec.email || `${(rec.nombre_completo || '').split(' ')[0].toLowerCase()}@itdurango.edu.mx`,
                    departamento: rec.departamento || c.departamento || 'DOCENTE ITD',
                    puesto: rec.puesto || 'Docente',
                    nivel: rec.nivel || 'Docente',
                    es_fd: Boolean(rec.es_fd),
                    es_d: Boolean(rec.es_d !== undefined ? rec.es_d : !rec.es_fd),
                    asistencias: { L: true, M: true, M2: true, J: true, V: true }
                  });
                }
              }
            });
            saveLocalCursos(cursos);
          } else if (tableName === 'docentes') {
            const docs = getLocalDocentes();
            arr.forEach((rec) => {
              const idx = docs.findIndex((d) => 
                (rec.id && d.id === rec.id) || 
                (rec.nombre_completo && d.nombre_completo?.toUpperCase() === rec.nombre_completo.toUpperCase()) ||
                (rec.curp && d.curp && d.curp.toUpperCase() === rec.curp.toUpperCase())
              );
              if (idx >= 0) {
                docs[idx] = { ...docs[idx], ...rec };
              } else {
                docs.push({
                  id: rec.id || `doc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                  nombre_completo: rec.nombre_completo || '',
                  email: rec.email || '',
                  departamento: rec.departamento || 'DOCENTE ITD',
                  curp: rec.curp || '',
                  rfc: rec.rfc || '',
                  telefono: rec.telefono || '',
                  puesto: rec.puesto || 'Docente',
                  nivel: rec.nivel || (rec.es_fd ? 'Funcionario Docente' : 'Docente'),
                  es_fd: Boolean(rec.es_fd),
                  es_d: Boolean(rec.es_d !== undefined ? rec.es_d : !rec.es_fd),
                  genero: rec.genero || '',
                  tarjeta: rec.tarjeta || '',
                  rol: rec.rol || 'docente'
                });
              }
            });
            saveLocalDocentes(docs);
          }
          return {
            select: async () => ({ data: arr, error: null }),
            async then(resolve: any) {
              resolve({ data: arr, error: null });
            }
          };
        },
        upsert(records: any) {
          return this.insert(records);
        },
        update(updates: any) {
          return {
            eq: (col: string, val: any) => ({
              async then(resolve: any) {
                resolve({ data: updates, error: null });
              }
            })
          };
        },
        delete() {
          return {
            eq: (col: string, val: any) => ({
              async then(resolve: any) {
                resolve({ data: null, error: null });
              }
            })
          };
        },
        select(cols?: string) {
          const buildInscripcionesMock = (cursoIdFilter?: string, cursoIdsFilter?: string[]) => {
            const cursos = getLocalCursos();
            const docs = getLocalDocentes();
            let rows: any[] = [];
            cursos.forEach(c => {
              if (cursoIdFilter && c.id !== cursoIdFilter && c.folio !== cursoIdFilter) return;
              if (cursoIdsFilter && !cursoIdsFilter.includes(c.id) && !cursoIdsFilter.includes(c.folio)) return;

              (c.participantes || []).forEach((p, idx) => {
                rows.push({
                  id: `ins-${c.id}-${idx}`,
                  curso_id: c.id,
                  docente_id: p.id || docs[idx % (docs.length || 1)]?.id || `doc-${idx}`,
                  folio_personal: `${c.folio || 'FOL'}-${String(idx + 1).padStart(2, '0')}`,
                  estado: 'activo',
                  nombre_completo: p.nombre_completo,
                  curp: p.curp,
                  rfc: p.rfc,
                  departamento: p.departamento,
                  email: p.email,
                  folio_curso: c.folio
                });
              });
            });
            return rows;
          };

          const getDataForTable = () => {
            if (tableName === 'cursos') return getLocalCursos();
            if (tableName === 'docentes') return getLocalDocentes();
            if (tableName === 'inscripciones') return buildInscripcionesMock();
            if (tableName === 'convocatorias') return [{ id: 'conv-2026-1', anio: 2026, mes: 'Enero' }];
            return [];
          };

          const createQueryObject = (filters: any[] = []): any => {
            return {
              eq(col: string, val: any) {
                return createQueryObject([...filters, { type: 'eq', col, val }]);
              },
              ilike(col: string, val: any) {
                return createQueryObject([...filters, { type: 'ilike', col, val }]);
              },
              in(col: string, vals: any[]) {
                return createQueryObject([...filters, { type: 'in', col, vals }]);
              },
              not(col: string, op: string, val: any) {
                return createQueryObject([...filters, { type: 'not', col, val }]);
              },
              order(col: string, opts?: any) {
                return createQueryObject([...filters, { type: 'order', col, opts }]);
              },
              limit(num: number) {
                return createQueryObject([...filters, { type: 'limit', num }]);
              },
              maybeSingle: async () => {
                let data = getDataForTable();
                filters.forEach(f => {
                  if (f.type === 'eq') data = data.filter((item: any) => String(item[f.col]).toLowerCase() === String(f.val).toLowerCase());
                  if (f.type === 'ilike') data = data.filter((item: any) => String(item[f.col] || '').toLowerCase().includes(String(f.val).toLowerCase()));
                });
                return { data: data[0] || null, error: null };
              },
              single: async () => {
                let data = getDataForTable();
                filters.forEach(f => {
                  if (f.type === 'eq') data = data.filter((item: any) => String(item[f.col]).toLowerCase() === String(f.val).toLowerCase());
                  if (f.type === 'ilike') data = data.filter((item: any) => String(item[f.col] || '').toLowerCase().includes(String(f.val).toLowerCase()));
                });
                return { data: data[0] || null, error: data[0] ? null : new Error('No encontrado') };
              },
              async then(resolve: any) {
                let data = getDataForTable();
                filters.forEach(f => {
                  if (f.type === 'eq') {
                    if (tableName === 'inscripciones' && f.col === 'curso_id') {
                      data = buildInscripcionesMock(f.val);
                    } else {
                      data = data.filter((item: any) => String(item[f.col] || '').toLowerCase() === String(f.val).toLowerCase());
                    }
                  }
                  if (f.type === 'ilike') {
                    data = data.filter((item: any) => String(item[f.col] || '').toLowerCase().includes(String(f.val).toLowerCase()));
                  }
                  if (f.type === 'in') {
                    if (tableName === 'inscripciones' && f.col === 'curso_id') {
                      data = buildInscripcionesMock(undefined, f.vals);
                    } else {
                      data = data.filter((item: any) => f.vals.includes(item[f.col]) || f.vals.includes(item.id));
                    }
                  }
                  if (f.type === 'limit') {
                    data = data.slice(0, f.num);
                  }
                });
                resolve({ data, error: null });
              }
            };
          };

          return createQueryObject();
        }
      };
    }
  };
}
