// src/components/CintilloMes.jsx
import React from 'react'

export const CONMEMORACIONES_MES = {
  0: { lema: 'Inicio de Periodo y Actualización Docente', icono: '🎯', bg: '#1B396A', texto: '#ffffff', linea: '#3B82F6' },
  1: { lema: 'Mes de la Constitución y la Bandera Nacional', icono: '🇲🇽', bg: '#781834', texto: '#ffffff', linea: '#991B1B' },
  2: { lema: 'Mes de la Primavera y Equidad de Género', icono: '💜', bg: '#581C87', texto: '#ffffff', linea: '#7E22CE' },
  3: { lema: 'Mes de la Creatividad e Innovación Académica', icono: '💡', bg: '#0369A1', texto: '#ffffff', linea: '#0284C7' },
  4: { lema: 'Mes del Maestro y Reconocimiento Docente', icono: '🎓', bg: '#1B396A', texto: '#ffffff', linea: '#2563EB' },
  5: { lema: 'Mes del Medio Ambiente y Sustentabilidad', icono: '🌿', bg: '#0E5A3C', texto: '#ffffff', linea: '#16A34A' },
  6: { lema: 'Periodo Intersemestral y Capacitación Continua', icono: '📚', bg: '#1E293B', texto: '#ffffff', linea: '#334155' },
  7: { lema: 'Mes del Orgullo Guinda y Aniversario del ITD', icono: '🏛️', bg: '#781834', texto: '#ffffff', linea: '#D97706' },
  8: { lema: 'Mes de la Patria y Orgullo Mexicano', icono: '🇲🇽', bg: '#781834', texto: '#ffffff', linea: '#16A34A' },
  // OCTUBRE ROSA: Fondo claro suave, línea rosa mexicana distintiva y texto vino oscuro
  9: { 
    lema: 'Mes de la Sensibilización sobre el Cáncer de Mama (Octubre Rosa)', 
    icono: '🎀', 
    bg: '#FFF0F5',       // Blanco / rosa suave pastel
    texto: '#831843',    // Rosa vino oscuro (máxima legibilidad)
    linea: '#E11D48',    // Línea rosa mexicana viva distintiva
  },
  10: { lema: 'Mes de la Revolución Mexicana y Nuestras Tradiciones', icono: '🇲🇽', bg: '#781834', texto: '#ffffff', linea: '#991B1B' },
  11: { lema: 'Mes de la Fraternidad y Cierre de Ciclo Institucional', icono: '✨', bg: '#0F2942', texto: '#ffffff', linea: '#F59E0B' },
}

export default function CintilloMes({ className = '' }) {
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]
  const numMes = new Date().getMonth()
  const mesActual = meses[numMes]
  const conmemoracion = CONMEMORACIONES_MES[numMes] || {
    lema: 'Actualización Docente',
    icono: '🏛️',
    bg: '#781834',
    texto: '#ffffff',
    linea: '#781834',
  }

  return (
    <div
      role="complementary"
      className={`w-full py-2 px-4 shadow-xs transition-colors duration-500 border-b-2 ${className}`}
      style={{
        backgroundColor: conmemoracion.bg,
        color: conmemoracion.texto,
        borderBottomColor: conmemoracion.linea,
      }}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 text-xs font-medium">
        <div className="flex items-center gap-3">
          <span className="text-lg leading-none select-none">{conmemoracion.icono}</span>
          <span className="tracking-wide">
            {mesActual} &nbsp;·&nbsp; <strong className="font-semibold">{conmemoracion.lema}</strong>
          </span>
        </div>

        {/* Adorno derecho */}
        {numMes === 9 ? (
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold bg-[#FCE7F3] text-[#BE185D] border border-[#F472B6] px-2.5 py-0.5 rounded-full shadow-2xs">
            <span>🎗️ Octubre Rosa</span>
          </div>
        ) : (numMes === 8 || numMes === 10) ? (
          <div className="hidden sm:flex items-center gap-1 opacity-70">
            <span className="w-4 h-1 bg-green-500 rounded-full" />
            <span className="w-4 h-1 bg-white rounded-full" />
            <span className="w-4 h-1 bg-red-500 rounded-full" />
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 opacity-70 text-[11px] font-semibold">
            <span>TecNM · ITD</span>
          </div>
        )}
      </div>
    </div>
  )
}