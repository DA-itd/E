// src/utils/rfcCurpHelper.js
export function limpiarTitulosNombre(nombre) {
  if (!nombre) return '';
  return nombre
    .replace(/^(DR\.|DRA\.|ING\.|M\.C\.|M\.I\.|M\.A\.|M\.E\.|LIC\.|MTRO\.|MTRA\.|PROF\.|PROFA\.|C\.P\.|DOCENTE)\s+/i, '')
    .replace(/^(DR|DRA|ING|LIC|MTRO|MTRA|PROF|PROFA|CP)\s+/i, '')
    .trim();
}

function esMujer(nombre) {
  const n = (nombre || '').toUpperCase();
  const nombresFemeninos = [
    'MARIA', 'MARÍA', 'AGUEDA', 'ÁGUEDA', 'CLAUDIA', 'LAURA', 'PATRICIA', 'ANA', 'ROSA', 'CARMEN',
    'GUADALUPE', 'MARTHA', 'ADRIANA', 'LETICIA', 'SILVIA', 'ELBA', 'LUCIA', 'LUCÍA', 'VERONICA',
    'VERÓNICA', 'GABRIELA', 'MONICA', 'MÓNICA', 'ALMA', 'BEATRIZ', 'BLANCA', 'DIANA', 'ELIZABETH',
    'ERIKA', 'GLORIA', 'IRMA', 'ISABEL', 'JUANA', 'KARINA', 'LIDIA', 'LORENA', 'LUZ', 'MARGARITA'
  ];
  return nombresFemeninos.some((fem) => n.includes(fem));
}

function primeraVocalInterna(palabra) {
  const p = (palabra || '').slice(1).toUpperCase();
  const match = p.match(/[AEIOUÁÉÍÓÚ]/);
  return match ? match[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '') : 'A';
}

function primeraConsonanteInterna(palabra) {
  const p = (palabra || '').slice(1).toUpperCase();
  const match = p.match(/[BCDFGHJKLMNPQRSTVWXYZ]/);
  return match ? match[0] : 'X';
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function generarRfcCurpSintetico(nombreCompleto, rfcExistente, curpExistente) {
  const curpLimpia = (curpExistente || '').trim().toUpperCase();
  const rfcLimpio = (rfcExistente || '').trim().toUpperCase();

  // Si ya tiene CURP de 18 caracteres en la BD
  if (curpLimpia && curpLimpia.length >= 18 && curpLimpia !== 'NO REGISTRADO') {
    const rfcCalc = rfcLimpio && rfcLimpio.length >= 10 ? rfcLimpio : curpLimpia.slice(0, 10);
    return { rfc: rfcCalc, curp: curpLimpia };
  }

  // Si tiene RFC pero no CURP completa
  if (rfcLimpio && rfcLimpio.length >= 10 && rfcLimpio !== 'NO REGISTRADO') {
    const base10 = rfcLimpio.slice(0, 10);
    const genero = esMujer(nombreCompleto || '') ? 'M' : 'H';
    const curpGenerada = `${base10}${genero}DGRLL0${Math.abs(hashString(nombreCompleto || '') % 9) + 1}`;
    return { rfc: rfcLimpio, curp: curpGenerada };
  }

  // Si no tiene ninguno (2022-2025), se genera con nombre y apellidos
  const limpio = limpiarTitulosNombre(nombreCompleto || 'DOCENTE ITD')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const partes = limpio.split(/\s+/).filter(Boolean);

  let apPaterno = 'HERNANDEZ';
  let apMaterno = 'LOPEZ';
  let nombres = 'JUAN';

  if (partes.length >= 3) {
    nombres = partes.slice(0, partes.length - 2).join(' ');
    apPaterno = partes[partes.length - 2];
    apMaterno = partes[partes.length - 1];
  } else if (partes.length === 2) {
    nombres = partes[0];
    apPaterno = partes[1];
    apMaterno = 'X';
  } else if (partes.length === 1) {
    nombres = partes[0];
    apPaterno = 'X';
    apMaterno = 'X';
  }

  const l1 = apPaterno[0] || 'X';
  const l2 = primeraVocalInterna(apPaterno);
  const l3 = apMaterno[0] || 'X';
  const primerNombre = nombres.split(' ')[0] || 'X';
  const l4 = primerNombre[0] || 'X';
  const cuatroLetras = `${l1}${l2}${l3}${l4}`.toUpperCase();

  const hash = Math.abs(hashString(limpio));
  const anio = 70 + (hash % 25);
  const mes = String((hash % 12) + 1).padStart(2, '0');
  const dia = String((hash % 28) + 1).padStart(2, '0');
  const fechaSeis = `${anio}${mes}${dia}`;

  const genero = esMujer(limpio) ? 'M' : 'H';
  const c1 = primeraConsonanteInterna(apPaterno);
  const c2 = primeraConsonanteInterna(apMaterno);
  const c3 = primeraConsonanteInterna(primerNombre);

  const homoclaveRFC = String.fromCharCode(65 + (hash % 26)) + String.fromCharCode(65 + ((hash >> 2) % 26)) + (hash % 9);
  const rfcCalculado = `${cuatroLetras}${fechaSeis}${homoclaveRFC}`;
  const curpCalculada = `${cuatroLetras}${fechaSeis}${genero}DG${c1}${c2}${c3}0${(hash % 9) + 1}`;

  return {
    rfc: rfcCalculado,
    curp: curpCalculada
  };
}