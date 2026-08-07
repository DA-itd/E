import { useEffect, useState } from 'react'
import { supabase, DOMINIO_PERMITIDO } from './lib/supabaseClient'
import Login from './components/Login'
import MenuPrincipal from './components/MenuPrincipal'
import BarraSeccion from './components/BarraSeccion'
import InscripcionWizard from './components/InscripcionWizard'
import MisInscripciones from './components/MisInscripciones'
import DescargaConstancias from './components/DescargaConstancias'
import AdminAsistencia from './components/AdminAsistencia'
import AdminAdministradores from './components/AdminAdministradores'
import AdminConvocatorias from './components/AdminConvocatorias'
import AdminPreregistro from './components/AdminPreregistro'
import AdminReportes from './components/AdminReportes'
import AdminReporteRH from './components/AdminReporteRH'
import AdminBuscarDocente from './components/AdminBuscarDocente'
import HistorialCursos from './components/HistorialCursos'
import PreregistroCurso from './components/PreregistroCurso'
import ValidarConstancia from './components/ValidarConstancia'

export default function App() {
  const parametros = new URLSearchParams(window.location.search)
  const folioAValidar = parametros.get('validar')

  const [sesion, setSesion] = useState(undefined) // undefined = cargando, null = sin sesión
  const [docente, setDocente] = useState(undefined) // undefined = cargando, null = no encontrado
  const [errorDominio, setErrorDominio] = useState(false)
  const [esAdmin, setEsAdmin] = useState(false)

  const [seccion, setSeccion] = useState('menu') // 'menu' | 'inscripcion' | 'historial' | 'preregistro' | 'constancias' | 'administracion'
  const [subTabInscripcion, setSubTabInscripcion] = useState('wizard') // 'wizard' | 'mis-cursos'
  const [subTabAdmin, setSubTabAdmin] = useState('asistencia') // 'asistencia' | 'convocatorias' | 'buscar-docente' | 'reportes' | 'administradores'
  const [prefillCurso, setPrefillCurso] = useState(null) // datos que "pasan" de Preregistro a Convocatorias
  const [pasoInicialWizard, setPasoInicialWizard] = useState(1)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      manejarSesion(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_evento, session) => {
      manejarSesion(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function manejarSesion(session) {
    if (!session) {
      setSesion(null)
      setDocente(undefined)
      return
    }

    const email = session.user.email || ''
    if (!email.toLowerCase().endsWith('@' + DOMINIO_PERMITIDO)) {
      setErrorDominio(true)
      await supabase.auth.signOut()
      setSesion(null)
      return
    }

    setErrorDominio(false)
    setSesion(session)

    const { data: docenteData } = await supabase
      .from('docentes')
      .select('*')
      .ilike('email', email)
      .maybeSingle()

    setDocente(docenteData || null)

    const { data: adminRows } = await supabase.from('administradores').select('email').ilike('email', email)
    setEsAdmin((adminRows || []).length > 0)
  }

  function irAMenu() {
    setSeccion('menu')
  }

  function irASeccion(id) {
    setSeccion(id)
    if (id === 'inscripcion') {
      setSubTabInscripcion('wizard')
      setPasoInicialWizard(1)
    }
  }

  function irAInscribirmeOtroCurso() {
    setPasoInicialWizard(2)
    setSubTabInscripcion('wizard')
  }

  if (folioAValidar) {
    return <ValidarConstancia folio={folioAValidar} tipo={parametros.get('tipo')} />
  }

  if (sesion === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-itd-navyDark/50">
        Cargando…
      </div>
    )
  }

  if (!sesion) {
    return (
      <>
        <Login />
        {errorDominio && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-itd-guinda text-white text-sm px-4 py-2 rounded-lg shadow-lg">
            Solo se permite el acceso con correo @{DOMINIO_PERMITIDO}
          </div>
        )}
      </>
    )
  }

  if (docente === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-itd-navyDark/50">
        Cargando…
      </div>
    )
  }

  if (!docente) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-lg border border-itd-navy/10 p-8">
          <h2 className="font-display text-xl font-semibold text-itd-navy mb-2">
            Correo no encontrado en el catálogo
          </h2>
          <p className="text-sm text-itd-navyDark/70 mb-6">
            Tu cuenta <strong>{sesion.user.email}</strong> inició sesión correctamente,
            pero no está registrada en el catálogo de docentes/personal de Desarrollo
            Académico. Contacta a la Coordinación para darte de alta.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-itd-navy underline"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  if (seccion === 'menu') {
    return <MenuPrincipal docente={docente} esAdmin={esAdmin} onIr={irASeccion} />
  }

  return (
    <div className="min-h-screen">
      {seccion === 'inscripcion' && (
        <>
          <BarraSeccion
            titulo="Inscripción a Cursos"
            subTabs={[
              { id: 'wizard', label: 'Inscribirme' },
              { id: 'mis-cursos', label: 'Mis cursos' },
            ]}
            tabActiva={subTabInscripcion}
            onCambiarTab={(id) => {
              setSubTabInscripcion(id)
              if (id === 'wizard') setPasoInicialWizard(1)
            }}
            onMenu={irAMenu}
          />
          <main className="max-w-5xl mx-auto px-4 py-8">
            {subTabInscripcion === 'wizard' ? (
              <InscripcionWizard
                docente={docente}
                pasoInicial={pasoInicialWizard}
                onDocenteActualizado={setDocente}
                onIrAMisCursos={() => setSubTabInscripcion('mis-cursos')}
              />
            ) : (
              <MisInscripciones docente={docente} onIrAInscribirme={irAInscribirmeOtroCurso} />
            )}
          </main>
        </>
      )}

      {seccion === 'historial' && (
        <>
          <BarraSeccion titulo="Historial de Cursos" onMenu={irAMenu} />
          <main className="max-w-5xl mx-auto px-4 py-8">
            <HistorialCursos docente={docente} />
          </main>
        </>
      )}

      {seccion === 'preregistro' && (
        <>
          <BarraSeccion titulo="Preregistro de Curso" onMenu={irAMenu} />
          <main className="max-w-5xl mx-auto px-4 py-8">
            <PreregistroCurso docente={docente} />
          </main>
        </>
      )}

      {seccion === 'constancias' && (
        <>
          <BarraSeccion titulo="Descarga de Constancias" onMenu={irAMenu} />
          <main className="max-w-5xl mx-auto px-4 py-8">
            <DescargaConstancias docente={docente} />
          </main>
        </>
      )}

      {seccion === 'administracion' && esAdmin && (
        <>
          <BarraSeccion
            titulo="Administración"
            subTabs={[
              { id: 'asistencia', label: 'Asistencia' },
              { id: 'preregistro', label: 'Preregistro' },
              { id: 'convocatorias', label: 'Convocatorias y cursos' },
              { id: 'buscar-docente', label: 'Buscar docente' },
              { id: 'reportes', label: 'Reportes' },
              { id: 'reporte-rh', label: 'Reporte RH' },
              { id: 'administradores', label: 'Administradores' },
            ]}
            tabActiva={subTabAdmin}
            onCambiarTab={setSubTabAdmin}
            onMenu={irAMenu}
          />
          <main className="max-w-5xl mx-auto px-4 py-8">
            {subTabAdmin === 'asistencia' && <AdminAsistencia />}
            {subTabAdmin === 'preregistro' && (
              <AdminPreregistro
                onAprobar={(datos) => {
                  setPrefillCurso(datos)
                  setSubTabAdmin('convocatorias')
                }}
              />
            )}
            {subTabAdmin === 'convocatorias' && (
              <AdminConvocatorias prefill={prefillCurso} onPrefillConsumido={() => setPrefillCurso(null)} />
            )}
            {subTabAdmin === 'buscar-docente' && <AdminBuscarDocente />}
            {subTabAdmin === 'reportes' && <AdminReportes />}
            {subTabAdmin === 'reporte-rh' && <AdminReporteRH />}
            {subTabAdmin === 'administradores' && <AdminAdministradores />}
          </main>
        </>
      )}
    </div>
  )
}
