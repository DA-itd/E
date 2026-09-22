// src/lib/bannerFechas.js
// Config de "banners" especiales para el login. Cada entrada define un
// rango de fechas (mes-día, sin año) y cómo se ve el banner. Para
// agregar, quitar o mover una fecha, solo edita este arreglo — no hace
// falta tocar Login.jsx.
//
// El orden importa: se usa la PRIMERA que haga match, así que las fechas
// más específicas (un solo día) deben ir ANTES que los rangos largos que
// las contienen (ej. "16 de septiembre" antes que "todo septiembre").
//
// Nota: la comparación es por texto "MM-DD", así que no uses un rango que
// cruce el fin de año (ej. inicioMD:'12-20' finMD:'01-05' NO funciona —
// divide eso en dos entradas, una que termine en '12-31' y otra que
// empiece en '01-01').
export const FECHAS_ESPECIALES = [
  {
    id: 'independencia',
    inicioMD: '09-16',
    finMD: '09-16',
    icono: '🇲🇽',
    texto: '16 de septiembre — Día de la Independencia. ¡Viva México!',
    bg: 'linear-gradient(90deg, #639922, #ffffff 55%, #E24B4A)',
    color: '#173404',
  },
  {
    id: 'mes-patrio',
    inicioMD: '09-01',
    finMD: '09-30',
    icono: '🇲🇽',
    texto: 'Septiembre, mes de la Patria',
    bg: '#EAF3DE',
    color: '#173404',
  },
  {
    id: 'aniversario-itd',
    inicioMD: '08-02',
    finMD: '08-02',
    icono: '🎉',
    texto: '2 de agosto — Aniversario del Instituto Tecnológico de Durango',
    bg: '#FAC775',
    color: '#412402',
  },
  {
    id: 'primavera',
    inicioMD: '03-21',
    finMD: '03-21',
    icono: '🌸',
    texto: '21 de marzo — ¡Bienvenida primavera!',
    bg: '#F0997B',
    color: '#4A1B0C',
  },
  {
    id: 'mes-cancer-mama',
    inicioMD: '10-01',
    finMD: '10-31',
    icono: '🎗️',
    texto: 'Octubre, mes de sensibilización sobre el cáncer de mama',
    bg: 'linear-gradient(90deg, #F4C0D1, #ED93B1)',
    color: '#72243E',
  },
]

function hoyComoMD() {
  const hoy = new Date()
  const mm = String(hoy.getMonth() + 1).padStart(2, '0')
  const dd = String(hoy.getDate()).padStart(2, '0')
  return `${mm}-${dd}`
}

export function obtenerBannerFechaEspecial() {
  const hoyMD = hoyComoMD()
  return FECHAS_ESPECIALES.find((f) => hoyMD >= f.inicioMD && hoyMD <= f.finMD) || null
}