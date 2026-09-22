// src/App.jsx
import AdminRespaldo from './components/AdminRespaldo'
import { useEffect, useMemo, useState } from 'react'
import { supabase, DOMINIO_PERMITIDO } from './lib/supabaseClient'
import { obtenerConvocatoriaActivaId } from './lib/convocatorias'
import { PESTANAS_ADMIN } from './lib/permisosAdmin'
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
import AdminProgramaInstitucional from './components/AdminProgramaInstitucional'
import AdminBuscarDocente from './components/AdminBuscarDocente'
import AdminProyectosDocencia from './components/proydoce/AdminProyectosDocencia' // <-- NUEVO IMPORT
import HistorialCursos from './components/HistorialCursos'
import PreregistroCurso from './components/PreregistroCurso'
import ValidarConstancia from './components/ValidarConstancia'
import ValidadorConstancias from './components/ValidadorConstancias'
import AdminAvisos from './components/AdminAvisos'
import AdminAsistenciaHistorial from './components/AdminAsistenciaHistorial'
import AdminDocentes from './components/AdminDocentes'
import AdminFormatos from './components/AdminFormatos'
import AdminRecordatorios from './components/AdminRecordatorios.jsx'

export default function App() {
  const parametros = new URLSearchParams(window.location.search)
  const folioAValidar = parametros.get('validar')

  const [sesion, setSesion] = useState(undefined) // undefined = cargando, null = sin sesión
  const [docente, setDocente] = useState(undefined) // undefined = cargando, null = no encontrado
  const [errorDominio, setErrorDominio] = useState(false)
  // null = no es admin; objeto { email, es_superadmin, permisos } = sí es admin
  const [adminInfo, setAdminInfo] = useState(null)

  const esAdmin = !!adminInfo
  const esSuperAdmin = !!adminInfo?.es_superadmin
  const subTabsAdmin = useMemo(() => {
    if (esSuperAdmin) return [...PESTANAS_ADMIN, { id: 'administradores', label: 'Administradores' }]
    const permisos = adminInfo?.permisos || []
    return PESTANAS_ADMIN.filter((t) => permisos.includes(t.id))
  }, [esSuperAdmin, adminInfo])

  const [seccion, setSeccion] = useState('menu') // 'menu' | 'inscripcion' | 'historial' | 'preregistro' | 'constancias' | 'administracion'
  const [subTabInscripcion, setSubTabInscripcion] = useState('wizard') // 'wizard' | 'mis-cursos'
  const [subTabAdmin, setSubTabAdmin] = useState('') // se fija según subTabsAdmin una vez que carga
  const [prefillCurso, setPrefillCurso] = useState(null) // datos que "pasan" de Preregistro a Convocatorias
  const [pasoInicialWizard, setPasoInicialWizard] = useState(1)
  const [hashActual, setHashActual] = useState(window.location.hash)
  const [mostrarValidador, setMostrarValidador] = useState(false)

  useEffect(() => {
    function alCambiarHash() {
      setHashActual(window.location.hash)
    }
    window.addEventListener('hashchange', alCambiarHash)
    return () => {
      window.removeEventListener('hashchange', alCambiarHash)
    }
  }, [])

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        manejarSesion(data?.session || null)
      })
      .catch((err) => {
        console.warn('No se pudo obtener la sesión de Supabase:', err)
        manejarSesion(null)
      })

    let subscription
    try {
      const { data: listener } = supabase.auth.onAuthStateChange((_evento, session) => {
        manejarSesion(session)
      })
      subscription = listener?.subscription
    } catch (err) {
      console.warn('No se pudo suscribir a eventos de autenticación:', err)
    }

    return () => {
      subscription?.unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    if (subTabsAdmin.length === 0) return
    if (!subTabsAdmin.some((t) => t.id === subTabAdmin)) {
      setSubTabAdmin(subTabsAdmin[0].id)
    }

  }, [subTabsAdmin])

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

    const { data: adminRows } = await supabase
      .from('administradores')
      .select('email, es_superadmin, permisos')
      .ilike('email', email)
    setAdminInfo(adminRows && adminRows[0] ? adminRows[0] : null)
  }

  function irAMenu() {
    setSeccion('menu')
  }

  function irAValidador() {
    setMostrarValidador(true)
    window.location.hash = '#validar'
    setHashActual('#validar')
  }

  function irASeccion(id) {
    setSeccion(id)
    if (id === 'inscripcion') {
      setSubTabInscripcion('wizard')
      setPasoInicialWizard(1)
    }
  }

  // Al agregar un curso adicional desde "Mis cursos", solo nos saltamos la
  // pantalla de Datos Personales si el docente ya la confirmó para la
  // convocatoria que sigue vigente ahora mismo. Si cambió de convocatoria
  // desde la última vez (o nunca la ha confirmado), lo mandamos primero a
  // Datos Personales igual que a un docente nuevo.
  async function irAInscribirmeOtroCurso() {
    const convocatoriaActivaId = await obtenerConvocatoriaActivaId()
    const yaConfirmoEstaConvocatoria =
      convocatoriaActivaId && docente?.ultima_convocatoria_confirmada_id === convocatoriaActivaId

    setPasoInicialWizard(yaConfirmoEstaConvocatoria ? 2 : 1)
    setSubTabInscripcion('wizard')
  }

  if (mostrarValidador || hashActual.startsWith('#validar')) {
    return (
      <ValidadorConstancias
        onVolver={() => {
          setMostrarValidador(false)
          try {
            history.pushState('', document.title, window.location.pathname + window.location.search)
          } catch {
            window.location.hash = ''
          }
          setHashActual('')
        }}
      />
    )
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
        <Login onIrAValidar={irAValidador} />
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

  const docenteEfectivo = docente || (esAdmin ? {
    email: sesion?.user?.email,
    nombre_completo: sesion?.user?.user_metadata?.full_name || 'Administrador',
    departamento: 'Desarrollo Académico',
  } : null)

  if (!docente && !esAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-lg border border-itd-navy/10 p-8">
          <h2 className="font-display text-xl font-semibold text-itd-navy mb-2">
            Correo no encontrado en el catálogo
          </h2>
          <p className="text-sm text-itd-navyDark/70 mb-6">
            Tu cuenta <strong>{sesion?.user?.email}</strong> inició sesión correctamente,
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
    return <MenuPrincipal docente={docenteEfectivo} esAdmin={esAdmin} onIr={irASeccion} />
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
            <DescargaConstancias docente={docente} esAdmin={esAdmin} />
          </main>
        </>
      )}

      {seccion === 'administracion' && esAdmin && (
        <>
          <BarraSeccion
            titulo="Administración"
            subTabs={subTabsAdmin}
            tabActiva={subTabAdmin}
            onCambiarTab={setSubTabAdmin}
            onMenu={irAMenu}
          />
          <main className="max-w-5xl mx-auto px-4 py-8">
            {subTabAdmin === 'asistencia' && (
              <AdminAsistencia esSuperAdmin={esSuperAdmin} miDepartamento={docente.departamento || ''} />
            )}
            {subTabAdmin === 'asistencia-historial' && <AdminAsistenciaHistorial />}
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
            {subTabAdmin === 'respaldo' && <AdminRespaldo />}
            {subTabAdmin === 'reportes' && <AdminReportes />}
            {subTabAdmin === 'reporte-rh' && <AdminReporteRH />}
            {subTabAdmin === 'programa-institucional' && <AdminProgramaInstitucional />}
            {subTabAdmin === 'docentes' && <AdminDocentes />}
            {subTabAdmin === 'proyectos-docencia' && (
              <AdminProyectosDocencia
                userEmail={docente.email}
                esAdminGlobal={esSuperAdmin}
                departamentoFijo={esSuperAdmin ? '' : docente.departamento || ''}
              />
            )}
            {subTabAdmin === 'avisos' && <AdminAvisos />}
            {/* "administradores" solo se muestra como botón para el súper admin
                (ver subTabsAdmin arriba), pero además se protege aquí por si acaso */}
            {subTabAdmin === 'administradores' && esSuperAdmin && <AdminAdministradores />}
            {subTabAdmin === 'formatos' && <AdminFormatos />}
            {subTabAdmin === 'recordatorios' && <AdminRecordatorios />}
          </main>
        </>
      )}
    </div>
  )
}