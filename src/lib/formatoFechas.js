const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

function partes(fechaISO) {
  const [anio, mes, dia] = fechaISO.split('-').map(Number)
  return { anio, mes, dia }
}

export function formatearRangoFechas(fechaInicioISO, fechaFinISO) {
  const ini = partes(fechaInicioISO)
  const fin = partes(fechaFinISO)

  if (fechaInicioISO === fechaFinISO) {
    return `${ini.dia} DE ${MESES[ini.mes - 1]} DE ${ini.anio}`
  }
  if (ini.mes === fin.mes && ini.anio === fin.anio) {
    return `DEL ${ini.dia} AL ${fin.dia} DE ${MESES[ini.mes - 1]} DE ${ini.anio}`
  }
  if (ini.anio === fin.anio) {
    return `DEL ${ini.dia} DE ${MESES[ini.mes - 1]} AL ${fin.dia} DE ${MESES[fin.mes - 1]} DE ${ini.anio}`
  }
  return `DEL ${ini.dia} DE ${MESES[ini.mes - 1]} DE ${ini.anio} AL ${fin.dia} DE ${MESES[fin.mes - 1]} DE ${fin.anio}`
}

export function formatearHora(horaHHMMSS) {
  return horaHHMMSS.slice(0, 5)
}
