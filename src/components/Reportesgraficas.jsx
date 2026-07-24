import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

const COLOR_HOMBRE = '#3b82f6'
const COLOR_MUJER = '#ec4899'
const COLOR_DOCENTE = '#16a34a'
const COLOR_PROFESIONAL = '#f59e0b'
const COLOR_NAVY = '#1b396a'

function TarjetaGrafica({ titulo, children, alto = 260 }) {
  return (
    <div className="rounded-2xl border border-itd-navy/10 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-itd-navyDark/70 mb-2">{titulo}</h3>
      <div style={{ width: '100%', height: alto }}>{children}</div>
    </div>
  )
}

export default function ReportesGraficas({ reporte }) {
  const r = reporte

  const datosGenero = [
    { nombre: 'Hombre', valor: r.porGenero.Hombre },
    { nombre: 'Mujer', valor: r.porGenero.Mujer },
  ]
  const datosTipo = [
    { nombre: 'Docente', valor: r.porTipo.Docente },
    { nombre: 'Profesional', valor: r.porTipo.Profesional },
  ]
  const datosDistribucion = [
    { nombre: '1 curso', cantidad: r.distribucionPorNumeroCursos[1] },
    { nombre: '2 cursos', cantidad: r.distribucionPorNumeroCursos[2] },
    { nombre: '3 cursos', cantidad: r.distribucionPorNumeroCursos[3] },
    { nombre: '4 cursos', cantidad: r.distribucionPorNumeroCursos[4] },
    { nombre: '5 cursos', cantidad: r.distribucionPorNumeroCursos[5] },
    { nombre: '6+ cursos', cantidad: r.distribucionPorNumeroCursos['6+'] },
  ]
  const datosCursosDistintosPorTipo = [
    { nombre: 'Docente', cantidad: r.cursosDistintosPorTipo.Docente },
    { nombre: 'Profesional', cantidad: r.cursosDistintosPorTipo.Profesional },
  ]
  const datosParticipantesUnicosPorTipo = [
    { nombre: 'Docente', cantidad: r.docentesUnicosPorTipo.Docente },
    { nombre: 'Profesional', cantidad: r.docentesUnicosPorTipo.Profesional },
  ]
  const datosGeneroPorTipo = [
    { nombre: 'Docente', Hombre: r.generoPorTipo.Docente.Hombre, Mujer: r.generoPorTipo.Docente.Mujer },
    { nombre: 'Profesional', Hombre: r.generoPorTipo.Profesional.Hombre, Mujer: r.generoPorTipo.Profesional.Mujer },
  ]
  const datosDemandados = [...r.cursosMasDemandados].reverse().map((c) => ({
    nombre: c.nombre.length > 45 ? c.nombre.slice(0, 45) + '…' : c.nombre,
    cantidad: c.cantidad,
  }))
  const datosDemandadosGenero = [...r.cursosMasDemandados].reverse().map((c) => ({
    nombre: c.nombre.length > 35 ? c.nombre.slice(0, 35) + '…' : c.nombre,
    Hombre: c.Hombre,
    Mujer: c.Mujer,
  }))
  const datosDepartamento = [...r.porDepartamento].reverse().map((d) => ({
    nombre: d.nombre,
    cantidad: d.cantidad,
  }))

  return (
    <div className="space-y-4">
      <TarjetaGrafica titulo="Cursos Más Demandados" alto={Math.max(220, datosDemandados.length * 32)}>
        <ResponsiveContainer>
          <BarChart data={datosDemandados} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="nombre" width={220} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="cantidad" fill={COLOR_NAVY} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </TarjetaGrafica>

      <TarjetaGrafica titulo="Participación por Departamento" alto={Math.max(220, datosDepartamento.length * 32)}>
        <ResponsiveContainer>
          <BarChart data={datosDepartamento} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="nombre" width={180} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="cantidad" fill="#7c3aed" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </TarjetaGrafica>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TarjetaGrafica titulo="Distribución por Género">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={datosGenero} dataKey="valor" nameKey="nombre" innerRadius={50} outerRadius={80} paddingAngle={2}>
                <Cell fill={COLOR_HOMBRE} />
                <Cell fill={COLOR_MUJER} />
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Tipo de Curso">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={datosTipo} dataKey="valor" nameKey="nombre" innerRadius={50} outerRadius={80} paddingAngle={2}>
                <Cell fill={COLOR_DOCENTE} />
                <Cell fill={COLOR_PROFESIONAL} />
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </TarjetaGrafica>

        <TarjetaGrafica titulo="Cursos por Docente (inscripciones)">
          <ResponsiveContainer>
            <BarChart data={datosDistribucion}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="nombre" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="cantidad" fill={COLOR_NAVY} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </TarjetaGrafica>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-itd-navyDark/70 mb-2 mt-2">Indicadores Complementarios</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TarjetaGrafica titulo="Cursos Distintos por Tipo">
            <ResponsiveContainer>
              <BarChart data={datosCursosDistintosPorTipo}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="cantidad" fill={COLOR_DOCENTE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </TarjetaGrafica>

          <TarjetaGrafica titulo="Participantes Únicos por Tipo">
            <ResponsiveContainer>
              <BarChart data={datosParticipantesUnicosPorTipo}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="cantidad" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </TarjetaGrafica>

          <TarjetaGrafica titulo="Género por Tipo de Curso">
            <ResponsiveContainer>
              <BarChart data={datosGeneroPorTipo}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Hombre" fill={COLOR_HOMBRE} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Mujer" fill={COLOR_MUJER} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </TarjetaGrafica>
        </div>
      </div>

      <TarjetaGrafica titulo="Mujeres y Hombres Registrados por Curso" alto={Math.max(220, datosDemandadosGenero.length * 34)}>
        <ResponsiveContainer>
          <BarChart data={datosDemandadosGenero} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="nombre" width={200} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Hombre" fill={COLOR_HOMBRE} radius={[0, 4, 4, 0]} />
            <Bar dataKey="Mujer" fill={COLOR_MUJER} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </TarjetaGrafica>
    </div>
  )
}
