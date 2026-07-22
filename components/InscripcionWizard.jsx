import { useState } from 'react'
import WizardHeader from './WizardHeader'
import PasoDatos from './steps/PasoDatos'
import PasoCursos from './steps/PasoCursos'
import PasoConfirmar from './steps/PasoConfirmar'
import PasoFinalizado from './steps/PasoFinalizado'

export default function InscripcionWizard({ docente, pasoInicial = 1, onDocenteActualizado, onIrAMisCursos }) {
  const [paso, setPaso] = useState(pasoInicial)
  const [docenteLocal, setDocenteLocal] = useState(docente)
  const [seleccionCursos, setSeleccionCursos] = useState([])
  const [todosCursos, setTodosCursos] = useState([])

  function handleDatosSiguiente(docenteActualizado) {
    setDocenteLocal(docenteActualizado)
    onDocenteActualizado(docenteActualizado)
    setPaso(2)
  }

  function handleCursosSiguiente(seleccion, cursos) {
    setSeleccionCursos(seleccion)
    setTodosCursos(cursos)
    setPaso(3)
  }

  function handleFinalizado() {
    setPaso(4)
  }

  return (
    <div>
      <div className="flex justify-end px-2 pt-2">
        <button
          onClick={onIrAMisCursos}
          className="rounded-lg bg-white border border-itd-navy/20 text-itd-navy text-sm font-medium px-4 py-2 shadow-sm hover:bg-itd-sand transition-colors"
        >
          📋 Ver Mis Cursos
        </button>
      </div>
      <WizardHeader pasoActual={paso} />

      {paso === 1 && <PasoDatos docente={docenteLocal} onSiguiente={handleDatosSiguiente} />}

      {paso === 2 && (
        <PasoCursos
          docente={docenteLocal}
          onSiguiente={handleCursosSiguiente}
          onRegresar={() => setPaso(1)}
        />
      )}

      {paso === 3 && (
        <PasoConfirmar
          docente={docenteLocal}
          cursosSeleccionados={seleccionCursos}
          todosCursos={todosCursos}
          onFinalizado={handleFinalizado}
          onRegresar={() => setPaso(2)}
        />
      )}

      {paso === 4 && <PasoFinalizado onVolverAInicio={onIrAMisCursos} />}
    </div>
  )
}
