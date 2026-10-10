// src/components/BarraSeccion.jsx
import { VERSION, VERSION_COMPLETA } from '../lib/version'

export default function BarraSeccion({ titulo, subTabs, tabActiva, onCambiarTab, onMenu }) {
  return (
    <div className="bg-itd-navy text-white">
      {/* Encabezado Principal */}
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onMenu}
          className="text-sm text-white/70 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
        >
          ← Menú principal
        </button>
        <div className="flex items-center gap-2">
          <p className="font-display text-sm font-semibold tracking-wide uppercase text-white/90">
            {titulo}
          </p>
          <span title={`Versión ${VERSION_COMPLETA}`} className="px-1.5 py-0.5 rounded bg-white/10 text-white/75 font-mono text-[10px] font-semibold border border-white/20">
            {VERSION}
          </span>
        </div>
      </div>

      {/* Menú Secundario (Tabs) */}
      {subTabs && subTabs.length > 0 && (
        <div className="border-t border-white/10 bg-itd-navy/95">
          <nav className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap gap-2">
            {subTabs.map((tab) => {
              const activo = tabActiva === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onCambiarTab(tab.id)}
                  className={`
                    px-4 py-2 text-xs font-medium rounded-lg transition-all
                    ${
                      activo
                        ? 'bg-itd-gold text-itd-navy shadow-sm'
                        : 'bg-white/5 text-white/70 hover:bg-white/15 hover:text-white border border-white/5'
                    }
                  `}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}