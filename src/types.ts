export interface Curso {
  id?: string;
  nombre: string;
  instructor?: string;
  horas?: number | string;
  horario?: string;
  lugar?: string;
  periodo?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  departamento?: string;
  modalidad?: string;
  status?: string;
  objetivo?: string;
  folio?: string;
  clave?: string;
  semana?: string;
  instructorCurp?: string;
  instructorRfc?: string;
  participantes?: Participante[];
  created_at?: string;
  [key: string]: any;
}

export interface Participante {
  id: string;
  nombre?: string;
  nombre_completo?: string;
  curp?: string;
  rfc?: string;
  puesto?: string;
  departamento?: string;
  tipo_docente?: 'FD' | 'D';
  asistencias?: Record<string, boolean>;
  es_fd?: boolean;
  es_d?: boolean;
  email?: string;
  telefono?: string;
  [key: string]: any;
}

export interface FormatoConfig {
  codigo?: string;
  revision?: string;
  fechaEmision?: string;
  dias?: string[];
  horasPorDia?: number;
}
