import React, { useState, useEffect } from 'react';
import LogoITD from './LogoITD';
import { getPermisosDepartamentos } from '../lib/supabaseClient';

interface Props {
  vistaActiva: 'listas' | 'nuevo_curso' | 'instructivo';
  onCambiarVista: (vista: 'listas' | 'nuevo_curso' | 'instructivo') => void;
  onAbrirConfiguracion: () => void;
  usuarioEmail: string;
  departamentoAsignado?: string;
  esAdmin: boolean;
  onCambiarUsuario: (email: string) => void;
}

export default function Navbar({
  vistaActiva,
  onCambiarVista,
  onAbrirConfiguracion,
  usuarioEmail,
  departamentoAsignado,
  esAdmin,
  onCambiarUsuario,
}: Props) {
  const [mostrarMenuUsuario, setMostrarMenuUsuario] = useState(false);
  const [permisos, setPermisos] = useState<any[]>([]);

  useEffect(() => {
    setPermisos(getPermisosDepartamentos());
  }, [mostrarMenuUsuario]);

  return (
    <header style={{ backgroundColor: '#1B396A' }} className="text-white shadow-md sticky top-0 z-30 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo e Institución */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center p-0.5 shadow-sm border border-amber-400 overflow-hidden shrink-0">
              <LogoITD className="w-full h-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base text-white tracking-tight">
                  Instituto Tecnológico de Durango
                </span>
                <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded bg-white/20 text-white font-mono font-semibold">
                  ITD-AD-FO-8
                </span>
              </div>
              <p className="text-[11px] text-slate-200 hidden sm:block">
                {esAdmin
                  ? 'Coordinación de Actualización Docente · Desarrollo Académico'
                  : `Portal de Listas de Asistencia · ${departamentoAsignado || 'Departamento'}`}
              </p>
            </div>
          </div>

          {/* Menú de Navegación */}
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => onCambiarVista('listas')}
              style={vistaActiva === 'listas' ? { backgroundColor: '#ffffff', color: '#1B396A' } : { backgroundColor: 'rgba(255, 255, 255, 0.12)', color: '#ffffff' }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <span>📋</span>
              <span>Listas de Asistencia</span>
            </button>

            {/* Solo Admin puede ver "Nuevo Curso" */}
            {esAdmin && (
              <button
                onClick={() => onCambiarVista('nuevo_curso')}
                style={vistaActiva === 'nuevo_curso' ? { backgroundColor: '#ffffff', color: '#1B396A' } : { backgroundColor: 'rgba(255, 255, 255, 0.12)', color: '#ffffff' }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              >
                <span>➕</span>
                <span>Nuevo Curso</span>
              </button>
            )}

            <button
              onClick={() => onCambiarVista('instructivo')}
              style={vistaActiva === 'instructivo' ? { backgroundColor: '#ffffff', color: '#1B396A' } : { backgroundColor: 'rgba(255, 255, 255, 0.12)', color: '#ffffff' }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <span>ℹ️</span>
              <span className="hidden sm:inline">Guía de Formato</span>
            </button>

            {/* Configuración solo para Admin */}
            {esAdmin && (
              <button
                onClick={onAbrirConfiguracion}
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.12)' }}
                className="p-2 rounded-xl text-white hover:bg-white/20 transition-colors text-sm"
                title="Configuración de Formato y Firmas"
              >
                ⚙️
              </button>
            )}

            <div className="h-6 w-px bg-white/30 mx-1 hidden sm:block"></div>

            {/* Selector de Usuario / Sesión Activa */}
            <div className="relative">
              <button
                onClick={() => setMostrarMenuUsuario(!mostrarMenuUsuario)}
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: 'rgba(255, 255, 255, 0.35)' }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold text-white transition-colors"
                title="Cambiar de usuario o departamento para probar"
              >
                <span>👤</span>
                <span className="max-w-[120px] sm:max-w-[170px] truncate text-left">
                  {esAdmin ? '👑 Admin (Coordinador)' : `🏢 ${departamentoAsignado || usuarioEmail}`}
                </span>
                <span className="text-[10px] text-white/80">▼</span>
              </button>

              {mostrarMenuUsuario && (
                <div 
                  style={{ backgroundColor: '#ffffff', color: '#1e293b' }}
                  className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-300 p-4 z-50 animate-in fade-in"
                >
                  <div className="border-b border-slate-200 pb-2.5 mb-2.5">
                    <p style={{ color: '#64748b' }} className="text-[11px] font-bold uppercase tracking-wider">Usuario y Rol Activo</p>
                    <p style={{ color: '#1B396A' }} className="text-xs font-bold truncate mt-0.5">{usuarioEmail}</p>
                    <p style={{ color: '#475569' }} className="text-[11px] mt-0.5">
                      {esAdmin ? '👑 Administrador Global (Todos los departamentos)' : `🏢 Departamento: ${departamentoAsignado}`}
                    </p>
                  </div>

                  <p style={{ color: '#475569' }} className="text-[11px] font-bold mb-1.5 px-1">Cambiar de cuenta / Probar vista:</p>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {/* Opción Admin */}
                    <button
                      onClick={() => {
                        onCambiarUsuario('coord_actualizaciondocente@itdurango.edu.mx');
                        setMostrarMenuUsuario(false);
                      }}
                      style={esAdmin ? { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', color: '#1e3a8a' } : { backgroundColor: '#f8fafc', color: '#334155' }}
                      className="w-full text-left p-2.5 rounded-xl text-xs transition flex items-center justify-between border border-slate-200 hover:border-slate-400"
                    >
                      <div>
                        <p style={{ color: '#1e3a8a' }} className="font-bold text-xs">👑 Coordinador (Admin Global)</p>
                        <p style={{ color: '#64748b' }} className="text-[10px] font-mono mt-0.5">coord_actualizaciondocente@itdurango.edu.mx</p>
                      </div>
                      {esAdmin && <span style={{ color: '#1d4ed8' }} className="font-bold text-sm">✓</span>}
                    </button>

                    {/* Usuarios dados de alta en departamentos */}
                    {permisos.map((p) => {
                      const esSeleccionado = usuarioEmail.toLowerCase() === p.email.toLowerCase();
                      return (
                        <button
                          key={p.id || p.email}
                          onClick={() => {
                            onCambiarUsuario(p.email);
                            setMostrarMenuUsuario(false);
                          }}
                          style={esSeleccionado ? { backgroundColor: '#fffbeb', borderColor: '#fde68a', color: '#78350f' } : { backgroundColor: '#f8fafc', color: '#334155' }}
                          className="w-full text-left p-2.5 rounded-xl text-xs transition flex items-center justify-between border border-slate-200 hover:border-slate-400"
                        >
                          <div className="min-w-0 pr-2">
                            <p style={{ color: '#1e293b' }} className="font-bold text-xs truncate">🏢 {p.nombre_completo || p.departamento}</p>
                            <p style={{ color: '#92400e' }} className="text-[10px] font-semibold truncate mt-0.5">{p.departamento}</p>
                            <p style={{ color: '#64748b' }} className="text-[10px] font-mono truncate">{p.email}</p>
                          </div>
                          {esSeleccionado && <span style={{ color: '#b45309' }} className="font-bold text-sm">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}