import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://htkiilwlnglqvcfzekwg.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0a2lpbHdsbmdscXZjZnpla3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3OTE5MzYsImV4cCI6MjA5OTM2NzkzNn0.vJslFfPV1YwBWXLc9IXFbLAY4hGZQeKk4AVToBEzQQ8'

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseUrl.includes('none.supabase.co')
)

// Si las variables de entorno aún no están inyectadas en el entorno, se inicializa un cliente inerte
// para evitar que la aplicación truene con "Error: supabaseUrl is required."
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://none.supabase.co', 'none')

// Dominio institucional permitido para el login
export const DOMINIO_PERMITIDO = 'itdurango.edu.mx'

export function getLocalDocentes() {
  try {
    return JSON.parse(localStorage.getItem('itd_docentes_cache') || '[]')
  } catch {
    return []
  }
}

export function getLocalCursos() {
  try {
    return JSON.parse(localStorage.getItem('itd_cursos_cache') || '[]')
  } catch {
    return []
  }
}

export function saveLocalCursos(cursos) {
  try {
    localStorage.setItem('itd_cursos_cache', JSON.stringify(cursos))
  } catch (err) {
    console.warn('Error guardando cursos locales:', err)
  }
}
