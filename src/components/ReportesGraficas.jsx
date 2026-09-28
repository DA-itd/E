import { useState, useEffect } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Line, ComposedChart
} from 'recharts'
import { calcularHistoricoMultianual } from '../lib/reportes'

const COLOR_HOMBRE = '#2563eb'
const COLOR_MUJER = '#db2777'
const COLOR_DOCENTE = '#16a34a'
const COLOR_PROFESIONAL = '#d97706'
const COLOR_NAVY = '#1b396a'
const COLOR_LIC = '#0284c7'
const COLOR_POS = '#7c3aed'
const COLOR_SIN_PART = '#dc2626'

function TarjetaGrafica({ titulo, subtitulo, children, alto = 280 }) {
  return (
    <div className="rounded-2xl border border-itd-navy/10 bg-white p-5 shadow-sm min-w-0 transition-all hover:shadow-md">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-itd-navy truncate">{titulo}</h3>
        {subtitulo && <p className="text-xs text-itd-navyDark/60 mt-0.5">{subtitulo}</p>}
      </div>
      <div style={{ width: '100%', height: alto, minHeight: alto }} className="relative min-w-0">
        {children}
      </div>
    </div>
  )
}

export default function ReportesGraficas({ reporte, anioSeleccionado, tipoPeriodo }) {
  const r = reporte
  const [historico, setHistorico] = useState([])
  const [cargandoHistorico, setCargandoHistorico] = useState(false)
  const [subPestana, setSubPestana] = useState('periodo')

  useEffect(() => {
    async function cargarHistorico() {
      setCargandoHistorico(true)
      try {
        const datos = await calcularHistoricoMultianual([2022, 2023, 2024, 2025, 2026])
        setHistorico(datos)
      } catch (err) {
        console.error('Error al cargar histórico:', err)
      }
      setCargandoHistorico(false)
    }
    cargarHistorico()
  }, [])

  const datosGenero = [
    { nombre: 'Hombres', valor: r.porGenero.Hombre },
    { nombre: 'Mujeres', valor: r.porGenero.Mujer },
  ]
  const datosTipo = [
    { nombre: 'Docente', valor: r.porTipo.Docente },
    { nombre: 'Profesional', valor: r.porTipo.Profesional },
  ]
  const datosNivel = [
    { nombre: 'Licenciatura', valor: r.licenciatura?.total || 0 },
    { nombre: 'Posgrado', valor: r.posgrado?.total || 0 },
  ]
  const datosParticipacionVsSinParticipar = [
    { nombre: 'Docentes Participantes', valor: r.docentesUnicos },
    { nombre: 'Sin Participar', valor: r.sinParticipar.total },
  ]
  const datosDistribucion = [
    { nombre: '1 curso', cantidad: r.distribucionPorNumeroCursos[1] },
    { nombre: '2 cursos', cantidad: r.distribucionPorNumeroCursos[2] },
    { nombre: '3 cursos', cantidad: r.distribucionPorNumeroCursos[3] },
    { nombre: '4 cursos', cantidad: r.distribucionPorNumeroCursos[4] },
    { nombre: '5 cursos', cantidad: r.distribucionPorNumeroCursos[5] },
    { nombre: '6+ cursos', cantidad: r.distribucionPorNumeroCursos['6+'] },
  ]
  const datosGeneroPorTipo = [
    { nombre: 'Docente', Hombres: r.generoPorTipo.Docente.Hombre, Mujeres: r.generoPorTipo.Docente.Mujer },
    { nombre: 'Profesional', Hombres: r.generoPorTipo.Profesional.Hombre, Mujeres: r.generoPorTipo.Profesional.Mujer },
  ]
  const datosDemandados = [...r.cursosMasDemandados].reverse().map((c) => ({
    nombre: c.nombre.length > 45 ? c.nombre.slice(0, 45) + '…' : c.nombre,
    cantidad: c.cantidad,
  }))
  const datosDemandadosGenero = [...r.cursosMasDemandados].reverse().map((c) => ({
    nombre: c.nombre.length > 35 ? c.nombre.slice(0, 35) + '…' : c.nombre,
    Hombres: c.Hombre,
    Mujeres: c.Mujer,
  }))
  const datosDepartamento = [...r.porDepartamento].reverse().map((d) => ({
    nombre: d.nombre,
    cantidad: d.cantidad,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
        <div className="flex rounded-lg border border-itd-navy/20 overflow-hidden bg-white shadow-sm">
          <button
            onClick={() => setSubPestana('periodo')}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              subPestana === 'periodo' ? 'bg-itd-navy text-white' : 'text-itd-navyDark hover:bg-slate-100'
            }`}
          >
            📊 Gráficas del Periodo Seleccionado
          </button>
          <button
            onClick={() => setSubPestana('historico')}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              subPestana === 'historico' ? 'bg-itd-navy text-white' : 'text-itd-navyDark hover:bg-slate-100'
            }`}
          >
            📈 Evolución y Acumulado Multianual (2022 - 2026)
          </button>
        </div>
        <p className="text-xs text-itd-navyDark/60 font-medium">
          {subPestana === 'periodo' ? `Periodo: ${r.rango.inicio} al ${r.rango.fin}` : 'Consolidado histórico de todos los años'}
        </p>
      </div>

      {subPestana === 'historico' ? (
        cargandoHistorico ? (
          <div className="p-12 text-center text-itd-navy font-medium">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-itd-navy mb-2"></div>
            <p>Calculando estadísticas históricas multianuales…</p>
          </div>
        ) : (
          <div className="space-y-6">
            <TarjetaGrafica
              titulo="1. Evolución de Inscripciones y Crecimiento Acumulado (2022 - 2026)"
              subtitulo="Barras: Inscripciones por año. Línea dorada: Inscripciones acumuladas."
              alto={320}
            >
              <ResponsiveContainer>
                <ComposedChart data={historico} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="anio" tick={{ fontWeight: 'bold' }} />
                  <YAxis yAxisId="left" orientation="left" stroke={COLOR_NAVY} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" stroke={COLOR_PROFESIONAL} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="totalInscripciones" name="Inscripciones en el año" fill={COLOR_NAVY} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="totalAcumulado" name="Total Acumulado" stroke={COLOR_PROFESIONAL} strokeWidth={3} dot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </TarjetaGrafica>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TarjetaGrafica
                titulo="2. Inscripciones por Tipo de Curso por Año"
                subtitulo="Formación Docente vs Actualización Profesional"
                alto={280}
              >
                <ResponsiveContainer>
                  <BarChart data={historico} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="anio" tick={{ fontWeight: 'bold' }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="tipoDocente" name="Tipo Docente" fill={COLOR_DOCENTE} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tipoProfesional" name="Tipo Profesional" fill={COLOR_PROFESIONAL} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </TarjetaGrafica>

              <TarjetaGrafica
                titulo="3. Inscripciones por Género por Año"
                subtitulo="Participación de Mujeres y Hombres por año"
                alto={280}
              >
                <ResponsiveContainer>
                  <BarChart data={historico} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="anio" tick={{ fontWeight: 'bold' }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="hombres" name="Hombres" fill={COLOR_HOMBRE} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="mujeres" name="Mujeres" fill={COLOR_MUJER} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </TarjetaGrafica>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TarjetaGrafica
                titulo="4. Participación por Nivel Educativo (Licenciatura vs Posgrado)"
                subtitulo="Inscripciones de Licenciatura vs Posgrado"
                alto={280}
              >
                <ResponsiveContainer>
                  <BarChart data={historico} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="anio" tick={{ fontWeight: 'bold' }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="licenciatura" name="Licenciatura" fill={COLOR_LIC} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="posgrado" name="Posgrado" fill={COLOR_POS} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </TarjetaGrafica>

              <TarjetaGrafica
                titulo="5. Docentes Participantes vs Sin Participar"
                subtitulo="Cobertura de la plantilla por año"
                alto={280}
              >
                <ResponsiveContainer>
                  <BarChart data={historico} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="anio" tick={{ fontWeight: 'bold' }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="docentesUnicos" name="Docentes que Participaron" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sinParticipar" name="Sin Participar" fill={COLOR_SIN_PART} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </TarjetaGrafica>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <TarjetaGrafica titulo="Distribución por Género" alto={220}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={datosGenero} dataKey="valor" nameKey="nombre" innerRadius={45} outerRadius={70} paddingAngle={2}>
                    <Cell fill={COLOR_HOMBRE} />
                    <Cell fill={COLOR_MUJER} />
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </TarjetaGrafica>

            <TarjetaGrafica titulo="Tipo de Curso" alto={220}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={datosTipo} dataKey="valor" nameKey="nombre" innerRadius={45} outerRadius={70} paddingAngle={2}>
                    <Cell fill={COLOR_DOCENTE} />
                    <Cell fill={COLOR_PROFESIONAL} />
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </TarjetaGrafica>

            <TarjetaGrafica titulo="Nivel (Lic. vs Posgrado)" alto={220}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={datosNivel} dataKey="valor" nameKey="nombre" innerRadius={45} outerRadius={70} paddingAngle={2}>
                    <Cell fill={COLOR_LIC} />
                    <Cell fill={COLOR_POS} />
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </TarjetaGrafica>

            <TarjetaGrafica titulo="Participantes vs Sin Participar" alto={220}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={datosParticipacionVsSinParticipar} dataKey="valor" nameKey="nombre" innerRadius={45} outerRadius={70} paddingAngle={2}>
                    <Cell fill="#16a34a" />
                    <Cell fill={COLOR_SIN_PART} />
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </TarjetaGrafica>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TarjetaGrafica titulo="Cursos Más Demandados" alto={Math.max(260, datosDemandados.length * 28)}>
              <ResponsiveContainer>
                <BarChart data={datosDemandados} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="nombre" width={200} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill={COLOR_NAVY} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </TarjetaGrafica>

            <TarjetaGrafica titulo="Participación por Departamento" alto={Math.max(260, datosDepartamento.length * 28)}>
              <ResponsiveContainer>
                <BarChart data={datosDepartamento} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="nombre" width={170} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill={COLOR_POS} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </TarjetaGrafica>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TarjetaGrafica titulo="Cursos Tomados por Docente" subtitulo="Frecuencia de participación docente">
              <ResponsiveContainer>
                <BarChart data={datosDistribucion}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill={COLOR_NAVY} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </TarjetaGrafica>

            <TarjetaGrafica titulo="Hombres y Mujeres por Tipo de Curso">
              <ResponsiveContainer>
                <BarChart data={datosGeneroPorTipo}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Hombres" fill={COLOR_HOMBRE} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Mujeres" fill={COLOR_MUJER} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </TarjetaGrafica>
          </div>

          <TarjetaGrafica titulo="Mujeres y Hombres Registrados por Curso Más Demandado" alto={Math.max(240, datosDemandadosGenero.length * 30)}>
            <ResponsiveContainer>
              <BarChart data={datosDemandadosGenero} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="nombre" width={190} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Hombres" fill={COLOR_HOMBRE} radius={[0, 4, 4, 0]} />
                <Bar dataKey="Mujeres" fill={COLOR_MUJER} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </TarjetaGrafica>
        </div>
      )}
    </div>
  )
}
