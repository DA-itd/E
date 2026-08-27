import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AdminProyectosDocencia from './components/proydoce/AdminProyectosDocencia';
import FormularioNuevoCurso from './components/proydoce/FormularioNuevoCurso';
import GuiaFormato from './components/GuiaFormato';
import ConfiguracionModal from './components/ConfiguracionModal';
import { obtenerDepartamentoAsignadoUsuario } from './lib/supabaseClient';

export default function App() {
  const [vistaActiva, setVistaActiva] = useState<'listas' | 'nuevo_curso' | 'instructivo'>('listas');
  const [mostrarConfiguracion, setMostrarConfiguracion] = useState(false);
  const [usuarioEmail, setUsuarioEmail] = useState<string>(() => {
    return localStorage.getItem('itd_usuario_sesion_email') || 'coord_actualizaciondocente@itdurango.edu.mx';
  });
  const [keyRecarga, setKeyRecarga] = useState(0);

  const deptoAsignado = obtenerDepartamentoAsignadoUsuario(usuarioEmail);
  const esAdmin = !deptoAsignado && (usuarioEmail.includes('coord_') || usuarioEmail.includes('admin') || usuarioEmail.startsWith('coord_actualizaciondocente'));

  function handleCambiarUsuario(nuevoEmail: string) {
    setUsuarioEmail(nuevoEmail);
    localStorage.setItem('itd_usuario_sesion_email', nuevoEmail);
    setKeyRecarga(prev => prev + 1);
  }

  function forzarRecarga() {
    setKeyRecarga(prev => prev + 1);
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans">
      {/* Institutional Top Navbar */}
      <Navbar
        vistaActiva={vistaActiva}
        onCambiarVista={setVistaActiva}
        onAbrirConfiguracion={() => setMostrarConfiguracion(true)}
        usuarioEmail={usuarioEmail}
        departamentoAsignado={deptoAsignado || undefined}
        esAdmin={esAdmin}
        onCambiarUsuario={handleCambiarUsuario}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {vistaActiva === 'listas' && (
          <AdminProyectosDocencia
            key={`${usuarioEmail}-${keyRecarga}`}
            userEmail={usuarioEmail}
            esAdminGlobal={esAdmin}
            departamentoFijo={deptoAsignado || undefined}
            onCrearNuevoCurso={() => setVistaActiva('nuevo_curso')}
          />
        )}

        {vistaActiva === 'nuevo_curso' && (
          <FormularioNuevoCurso
            onCursoCreado={() => {
              forzarRecarga();
              setVistaActiva('listas');
            }}
            onVolver={() => setVistaActiva('listas')}
          />
        )}

        {vistaActiva === 'instructivo' && (
          <GuiaFormato />
        )}
      </main>

      {/* Institutional Footer - Hidden in print */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500 print:hidden mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Instituto Tecnológico de Durango · TecNM · Departamento de Desarrollo Académico
          </span>
          <span className="font-mono text-slate-400">
            Formato Oficial ITD-AD-FO-8 Rev. 1
          </span>
        </div>
      </footer>

      {/* Settings Modal */}
      {mostrarConfiguracion && (
        <ConfiguracionModal
          onClose={() => setMostrarConfiguracion(false)}
          onConfigGuardada={forzarRecarga}
        />
      )}
    </div>
  );
}

