export interface Participante {
  id: string;
  nombre_completo: string;
  rfc?: string;
  curp: string;
  email: string;
  telefono?: string;
  genero?: 'Masculino' | 'Femenino' | 'Otro' | string;
  puesto?: string;
  departamento: string;
  puesto_departamento?: string;
  nivel?: string; // e.g. 'Docente', 'Funcionario Docente', 'Base', etc.
  es_fd?: boolean; // Funcionario Docente
  es_d?: boolean;  // Docente
  tarjeta?: string;
  folio_personal?: string;
  asistencias?: { [key: string]: boolean }; // e.g. { L: true, M: true, M2: true, J: true, V: true }
}

export interface Convocatoria {
  id: string;
  nombre: string;
  anio: number;
  mes: string;
}

export interface Curso {
  id: string;
  nombre: string;
  folio: string;
  clave?: string;
  instructor: string;
  instructor_rfc?: string;
  instructor_curp?: string;
  periodo: string;
  semana?: string;
  horas?: number;
  duracion?: string;
  horario: string;
  lugar?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  departamento: string;
  status: 'activo' | 'borrador' | 'concluido';
  modalidad?: 'PRESENCIAL' | 'VIRTUAL' | 'HÍBRIDO';
  dias_semana?: string[]; // e.g. ['L', 'M', 'M', 'J', 'V']
  convocatoria_id?: string;
  convocatorias?: Convocatoria;
  participantes?: Participante[];
  inscripciones?: { count: number }[];
}

export interface FormatoConfig {
  institucion: string;
  nombreDocumento: string;
  referenciaNorma: string;
  codigo: string;
  revision: string;
  pagina: string;
  fechaEmision: string;
  tipoCurso: string; // 'CURSO PRESENCIAL'
  coordinadorNombre: string;
  coordinadorPuesto: string;
  departamentoEmisor: string;
}

export interface UsuarioDocente {
  id: string;
  nombre_completo: string;
  email: string;
  departamento: string;
  curp?: string;
  rfc?: string;
  telefono?: string;
  puesto?: string;
  puesto_departamento?: string;
  nivel?: string;
  es_fd?: boolean;
  es_d?: boolean;
  genero?: string;
  tarjeta?: string;
  rol?: 'admin' | 'coordinador' | 'docente';
}

export interface PermisoDepartamento {
  id: string;
  email: string;
  nombre_completo: string;
  departamento: string;
  fecha_asignacion: string;
  asignado_por?: string;
  activo: boolean;
}
