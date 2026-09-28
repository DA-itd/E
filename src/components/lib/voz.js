// Utilidades de accesibilidad por voz.
// Usa las APIs nativas del navegador (sin librerías externas):
// - SpeechSynthesis para leer texto en voz alta
// - SpeechRecognition (webkit) para dictado de voz a texto
// Funciona mejor en Chrome/Edge. En navegadores sin soporte, los botones
// se ocultan solos (ver hooks de soporte abajo).

export function haySoporteVoz() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function haySoporteDictado() {
  return typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
}

export function leerTexto(texto) {
  if (!haySoporteVoz() || !texto) return
  window.speechSynthesis.cancel() // corta cualquier lectura previa

  const decir = () => {
    const utterance = new SpeechSynthesisUtterance(texto)
    utterance.lang = 'es-MX'
    utterance.rate = 1
    window.speechSynthesis.speak(utterance)
  }

  // En la primera carga de la página, la lista de voces a veces aún no está
  // lista y speak() no suena -- se espera a que termine de cargar.
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = decir
  } else {
    decir()
  }
}

export function detenerLectura() {
  if (haySoporteVoz()) window.speechSynthesis.cancel()
}

/**
 * Los navegadores bloquean el audio automático hasta que el usuario haya
 * interactuado con la página (clic, toque o tecla) en esa misma carga.
 * Esta función intenta leer de inmediato, y si el navegador la bloquea,
 * se dispara en cuanto ocurra la primera interacción -- así se siente
 * "automático" sin necesitar que el usuario presione la bocina.
 */
export function leerEnCuantoSePueda(texto) {
  if (!haySoporteVoz() || !texto) return
  let yaSonó = false

  const quitarListeners = () => {
    document.removeEventListener('click', disparar)
    document.removeEventListener('keydown', disparar)
    document.removeEventListener('touchstart', disparar)
  }

  const disparar = () => {
    if (yaSonó) return
    leerTexto(texto)
    quitarListeners()
  }

  // Intento inmediato: si el navegador sí lo permite, marca que ya sonó
  // (vía el evento "start" de la síntesis) y cancela el disparador pendiente.
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(texto)
  utterance.lang = 'es-MX'
  utterance.onstart = () => {
    yaSonó = true
    quitarListeners()
  }
  window.speechSynthesis.speak(utterance)

  document.addEventListener('click', disparar, { once: true })
  document.addEventListener('keydown', disparar, { once: true })
  document.addEventListener('touchstart', disparar, { once: true })
}

/**
 * Crea un controlador de dictado por voz.
 * Uso:
 *   const dictado = crearDictado((texto) => setValor(texto))
 *   dictado.iniciar() / dictado.detener()
 */
export function crearDictado(onResultado) {
  const Recognition = window.webkitSpeechRecognition || window.SpeechRecognition
  if (!Recognition) return null

  const recognition = new Recognition()
  recognition.lang = 'es-MX'
  recognition.continuous = false
  recognition.interimResults = false

  recognition.onresult = (event) => {
    const texto = event.results[0][0].transcript
    onResultado(texto)
  }

  return {
    iniciar: () => recognition.start(),
    detener: () => recognition.stop(),
    onEstadoCambio: (cb) => {
      recognition.onstart = () => cb(true)
      recognition.onend = () => cb(false)
      recognition.onerror = () => cb(false)
    },
  }
}
