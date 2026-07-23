// Genera un "Código de Verificación" reproducible a partir del nombre del
// titular y la fecha del curso YA FORMATEADA (el mismo texto que produce
// formatearRangoFechas) -- no de la fecha/hora en que se genera el
// documento. Así el mismo folio siempre produce el mismo código, sin
// importar cuándo se descargue o se vuelva a verificar.
//
// IMPORTANTE: debe llamarse con los MISMOS insumos en los dos lugares
// donde se usa (constancias.js al generar el PDF, y ValidadorConstancias.jsx
// al verificar), o el código no va a coincidir.
//
// Formato de salida: XXXX-XXXX-<folio sin prefijo ni guiones>
// Ej.: folio TNM-054-09-2026-10 -> 0CC4-4FE2-09202610

function normalizarTexto(texto) {
  return (texto || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// Hash FNV-1a de 32 bits -- determinista, sincrónico, sin dependencias.
function hashFNV1a(cadena) {
  let hash = 0x811c9dc5
  for (let i = 0; i < cadena.length; i++) {
    hash ^= cadena.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0')
}

/**
 * @param {string} nombreCompleto  Nombre del titular del documento
 * @param {string} fechaTexto      Fecha del curso ya formateada (ej. "DEL 19 AL 23 DE ENERO DEL 2026")
 * @param {string} folio           Folio completo, ej. "TNM-054-09-2026-10"
 */
export function generarCodigoVerificacion(nombreCompleto, fechaTexto, folio) {
  const base = `${normalizarTexto(nombreCompleto)}|${normalizarTexto(fechaTexto)}`
  const hash8 = hashFNV1a(base)
  const sufijoFolio = (folio || '').replace(/^TNM-054-/, '').replace(/-/g, '')
  return `${hash8.slice(0, 4)}-${hash8.slice(4, 8)}-${sufijoFolio}`
}