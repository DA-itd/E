// src/lib/version.js
// La versión viene de package.json (vite.config.ts la inyecta como __APP_VERSION__).
// Se actualiza sola con `npm version`: no hay que editar nada a mano.
const completa = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'

export const VERSION_COMPLETA = completa // ej. 2.2.0
export const VERSION = `v${completa.split('.').slice(0, 2).join('.')}` // ej. v2.2