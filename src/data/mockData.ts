import { Curso, Convocatoria, FormatoConfig, UsuarioDocente } from '../types';

export const DEFAULT_FORMATO_CONFIG: FormatoConfig = {
  institucion: 'INSTITUTO TECNOLÓGICO DE DURANGO',
  nombreDocumento: 'Formato de Lista de Asistencia',
  referenciaNorma: 'Referencias a la Norma NMX-CC-9001-IMNC-2008 6.2.2',
  codigo: 'ITD-AD-FO-8',
  revision: '1',
  pagina: '1 de 1',
  fechaEmision: '15/noviembre/2013',
  tipoCurso: 'CURSO PRESENCIAL',
  coordinadorNombre: 'Alejandro Calderón Rentería',
  coordinadorPuesto: 'Coordinador de Actualización Docente',
  departamentoEmisor: 'Departamento de Desarrollo Académico'
};

export const MOCK_CONVOCATORIAS: Convocatoria[] = [];

export const MOCK_USUARIOS_DOCENTES: UsuarioDocente[] = [];

export const MOCK_CURSOS_INICIALES: Curso[] = [];

export const DEPARTAMENTOS_ITD = [
  'Sistemas y Computación',
  'Ciencias Básicas',
  'Ingeniería Industrial',
  'Ingeniería Eléctrica y Electrónica',
  'Ingeniería Mecánica',
  'Ingeniería Química y Bioquímica',
  'Ciencias Económico Administrativas',
  'Desarrollo Académico',
  'Posgrado e Investigación',
  'División de Estudios Profesionales'
];
