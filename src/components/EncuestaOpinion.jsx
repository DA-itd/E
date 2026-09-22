import { useState } from 'react'
import { guardarRespuestaEncuesta } from '../lib/encuesta'

const PREGUNTAS_A = [
  ['a1', 'Los cursos me ayudaron a mejorar mi desempeño como docente (función, conceptos y herramientas aplicables).'],
  ['a2', 'Los cursos contribuyeron a mi desarrollo personal y/o profesional.'],
  ['a3', 'He podido aplicar en mi práctica docente cotidiana lo aprendido en los cursos.'],
  ['a4', 'Los cursos fortalecieron mi integración y colaboración con compañeros de trabajo.'],
  ['a5', 'Los cursos me ayudaron a comprender mejor los procesos del Instituto en mi rol como docente.'],
]

const PREGUNTAS_B = [
  ['b1', 'Se expuso el objetivo y temario del curso; mostró dominio del contenido abordado.'],
  ['b2', 'Fomentó la participación, aclaró dudas y dio retroalimentación a los ejercicios realizados.'],
  ['b3', 'Inició y concluyó puntualmente las sesiones.'],
  ['b4', 'El material didáctico fue útil y legible a lo largo del curso.'],
  ['b5', 'La variedad del material didáctico fue suficiente para apoyar su aprendizaje.'],
  ['b6', 'La distribución del tiempo fue adecuada para cubrir el contenido del curso.'],
  ['b7', 'Los temas fueron suficientes para alcanzar el objetivo del curso.'],
  ['b8', 'El curso comprendió ejercicios de práctica relacionados con el contenido.'],
  ['b9', 'El curso cubrió sus expectativas.'],
  ['b10', 'Las condiciones del aula (iluminación, ventilación y aseo) fueron adecuadas.'],
  ['b11', 'Los servicios de apoyo (sanitarios, café y coordinación del curso) fueron adecuados.'],
]

const PREGUNTAS_C = [
  ['c1', 'El tema del curso respondía a una necesidad real de mi práctica docente.'],
  ['c2', 'Recomendaría este curso a otros colegas del Instituto.'],
]

const IMPEDIMENTOS_OPCIONES = ['Falta de equipo y/o material', 'Falta de apoyo en el área']

function LikertPregunta({ id, texto, valor, onCambiar }) {
  return (
    <div className="py-3 border-b border-itd-navy/5 last:border-0">
      <p className="text-sm text-itd-navyDark mb-2">{texto} *</p>
      <div className="flex items-center gap-4 sm:gap-6">
        <span className="text-xs text-itd-navyDark/50 w-24 shrink-0">En Desacuerdo</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="flex flex-col items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name={id}
              checked={valor === n}
              onChange={() => onCambiar(id, n)}
              className="h-4 w-4 accent-itd-navy"
            />
            <span className="text-xs text-itd-navyDark/50">{n}</span>
          </label>
        ))}
        <span className="text-xs text-itd-navyDark/50 w-20 shrink-0 text-right">De Acuerdo</span>
      </div>
    </div>
  )
}

export default function EncuestaOpinion({ docente, inscripcion, curso, periodoAnteriorTexto, onCompletado, onCancelar }) {
  const [respuestas, setRespuestas] = useState({})
  const [impedimentos, setImpedimentos] = useState([])
  const [otroImpedimento, setOtroImpedimento] = useState('')
  const [primeraVez, setPrimeraVez] = useState(null) // true | false | null
  const [comentarioValioso, setComentarioValioso] = useState('')
  const [comentarioSugerencias, setComentarioSugerencias] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  function setValor(id, n) {
    setRespuestas((prev) => ({ ...prev, [id]: n }))
  }

  function toggleImpedimento(op) {
    setImpedimentos((prev) => (prev.includes(op) ? prev.filter((x) => x !== op) : [...prev, op]))
  }

  const todasLasPreguntas = [...PREGUNTAS_A, ...PREGUNTAS_B, ...PREGUNTAS_C]

  async function enviar() {
    setError('')
    const faltantes = todasLasPreguntas.filter(([id]) => !respuestas[id])
    if (faltantes.length > 0) {
      return setError('Faltan preguntas de la escala 1 a 5 por responder.')
    }
    if (primeraVez === null) {
      return setError('Indica si es la primera vez que tomas un curso sobre este tema.')
    }

    const listaImpedimentos = [...impedimentos]
    if (otroImpedimento.trim()) listaImpedimentos.push(`Otro: ${otroImpedimento.trim()}`)

    setEnviando(true)
    const { error: errorDB } = await guardarRespuestaEncuesta({
      inscripcion_id: inscripcion.id,
      docente_id: docente.id,
      curso_id: curso.id,
      departamento: docente.departamento,
      genero: docente.genero,
      tipo_curso: curso.tipo,
      periodo_anterior_texto: periodoAnteriorTexto,
      a1: respuestas.a1, a2: respuestas.a2, a3: respuestas.a3, a4: respuestas.a4, a5: respuestas.a5,
      impedimentos: listaImpedimentos,
      b1: respuestas.b1, b2: respuestas.b2, b3: respuestas.b3, b4: respuestas.b4, b5: respuestas.b5,
      b6: respuestas.b6, b7: respuestas.b7, b8: respuestas.b8, b9: respuestas.b9, b10: respuestas.b10, b11: respuestas.b11,
      c1: respuestas.c1, c2: respuestas.c2,
      primera_vez: primeraVez,
      comentario_valioso: comentarioValioso.trim() || null,
      comentario_sugerencias: comentarioSugerencias.trim() || null,
    })
    setEnviando(false)

    if (errorDB) {
      setError('No se pudo guardar tu encuesta. Intenta de nuevo.')
      return
    }
    onCompletado()
  }

  return (
    <div className="bg-white rounded-2xl border border-itd-navy/10 shadow-sm p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-itd-navy mb-1">
        Encuesta de Opinión <span className="text-itd-navyDark/40 text-sm font-normal">Código: ITD-AD-FO-09</span>
      </h2>
      <p className="text-sm text-itd-navyDark/60 mb-2">
        Curso: <strong>{curso.nombre}</strong>
      </p>
      <p className="text-xs text-itd-navyDark/50 mb-6">
        Sus respuestas son confidenciales y nos ayudan a mejorar la oferta de capacitación. Necesitas
        contestarla para que se habilite la descarga de tu constancia de este curso.
      </p>

      <div className="rounded-lg bg-itd-gold/10 border border-itd-gold/30 px-4 py-3 text-xs text-itd-navyDark/70 mb-6">
        Escala: 1 = Totalmente en desacuerdo · 2 = Parcialmente en desacuerdo · 3 = Indiferente ·
        4 = Parcialmente de acuerdo · 5 = Totalmente de acuerdo
      </div>

      <h3 className="font-semibold text-itd-navy text-sm mb-1">
        SECCIÓN A — Seguimiento de cursos del periodo anterior. {periodoAnteriorTexto}
      </h3>
      <p className="text-xs text-itd-navyDark/50 mb-3">
        Pensando en los cursos en que participó durante el periodo anterior, indique su nivel de acuerdo con cada afirmación.
      </p>
      <div className="mb-4">
        {PREGUNTAS_A.map(([id, texto]) => (
          <LikertPregunta key={id} id={id} texto={texto} valor={respuestas[id]} onCambiar={setValor} />
        ))}
      </div>

      <div className="mb-8">
        <p className="text-sm text-itd-navyDark mb-2">Si algo le impidió aplicar lo aprendido, marque lo que corresponda:</p>
        <div className="space-y-2">
          {IMPEDIMENTOS_OPCIONES.map((op) => (
            <label key={op} className="flex items-center gap-2 text-sm text-itd-navyDark/80 cursor-pointer">
              <input
                type="checkbox"
                checked={impedimentos.includes(op)}
                onChange={() => toggleImpedimento(op)}
                className="h-4 w-4 accent-itd-navy"
              />
              {op}
            </label>
          ))}
          <div className="flex items-center gap-2">
            <label className="text-sm text-itd-navyDark/80">Otro:</label>
            <input
              value={otroImpedimento}
              onChange={(e) => setOtroImpedimento(e.target.value)}
              className="flex-1 rounded-lg border border-itd-navy/20 px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>

      <h3 className="font-semibold text-itd-navy text-sm mb-1">
        SECCIÓN B — Evaluación del curso actual - {curso.nombre}
      </h3>
      <div className="mb-8">
        {PREGUNTAS_B.map(([id, texto]) => (
          <LikertPregunta key={id} id={id} texto={texto} valor={respuestas[id]} onCambiar={setValor} />
        ))}
      </div>

      <h3 className="font-semibold text-itd-navy text-sm mb-1">SECCIÓN C — Pertinencia del curso</h3>
      <div className="mb-4">
        {PREGUNTAS_C.map(([id, texto]) => (
          <LikertPregunta key={id} id={id} texto={texto} valor={respuestas[id]} onCambiar={setValor} />
        ))}
      </div>
      <div className="mb-8">
        <p className="text-sm text-itd-navyDark mb-2">¿Es la primera vez que toma un curso sobre este tema? *</p>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-itd-navyDark/80 cursor-pointer">
            <input
              type="radio"
              name="primera_vez"
              checked={primeraVez === true}
              onChange={() => setPrimeraVez(true)}
              className="h-4 w-4 accent-itd-navy"
            />
            Sí, primera vez
          </label>
          <label className="flex items-center gap-2 text-sm text-itd-navyDark/80 cursor-pointer">
            <input
              type="radio"
              name="primera_vez"
              checked={primeraVez === false}
              onChange={() => setPrimeraVez(false)}
              className="h-4 w-4 accent-itd-navy"
            />
            No, ya había tomado uno similar
          </label>
        </div>
      </div>

      <h3 className="font-semibold text-itd-navy text-sm mb-1">SECCIÓN D — Comentarios y sugerencias (opcional)</h3>
      <div className="mb-4">
        <label className="text-sm text-itd-navyDark/80 mb-1 block">¿Qué fue lo más valioso del curso?</label>
        <textarea
          value={comentarioValioso}
          onChange={(e) => setComentarioValioso(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
        />
      </div>
      <div className="mb-6">
        <label className="text-sm text-itd-navyDark/80 mb-1 block">¿Qué temas o cursos le gustaría que se ofrecieran próximamente?</label>
        <textarea
          value={comentarioSugerencias}
          onChange={(e) => setComentarioSugerencias(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-itd-navy/20 px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p className="mb-4 text-sm text-itd-guinda bg-itd-guinda/5 border border-itd-guinda/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-between items-center">
        {onCancelar ? (
          <button onClick={onCancelar} className="text-sm text-itd-navyDark/60 hover:text-itd-navyDark">
            ← Regresar
          </button>
        ) : <span />}
        <button
          onClick={enviar}
          disabled={enviando}
          className="rounded-lg bg-itd-navy text-white px-6 py-2.5 text-sm font-medium hover:bg-itd-navyDark disabled:opacity-50"
        >
          {enviando ? 'Enviando…' : 'Enviar encuesta'}
        </button>
      </div>
    </div>
  )
}
