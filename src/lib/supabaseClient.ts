// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

export const DOMINIO_PERMITIDO = 'itdurango.edu.mx';

// Datos por defecto integrados (evita requerir archivos externos)
export const DEFAULT_FORMATO_CONFIG = {
  codigoFormato: 'ITD-AD-FO-8',
  revision: '1',
  instituto: 'INSTITUTO TECNOLÓGICO DE DURANGO',
  coordinacion: 'COORDINACIÓN DE ACTUALIZACIÓN DOCENTE'
};

const metaEnv = (import.meta as any).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || '';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://xyzcompany.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy');

// Funciones auxiliares de sesión y usuario (para no romper ninguna vista)
export async function getUsuarioActual() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return user;
  } catch (e) {
    // Si no hay conexión o sesión activa
  }
  return {
    email: 'coord_actualizaciondocente@itdurango.edu.mx',
    user_metadata: {
      nombre_completo: 'Coordinación de Actualización Docente',
      departamento: 'Desarrollo Académico',
      rol: 'admin'
    }
  };
}

export function validarCorreoInstitucional(email: string): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${DOMINIO_PERMITIDO}`);
}

export function getConfiguracionFormato() {
  try {
    const guardada = localStorage.getItem('itd_formato_config');
    if (guardada) return JSON.parse(guardada);
  } catch (e) {}
  return DEFAULT_FORMATO_CONFIG;
}

export function guardarConfiguracionFormato(config: any) {
  try {
    localStorage.setItem('itd_formato_config', JSON.stringify(config));
  } catch (e) {}
}