// src/components/BarraSeccion.jsx
export default function BarraSeccion({ titulo, subTabs, tabActiva, onCambiarTab, onMenu }) {
  return (
    <div className="bg-itd-navy text-white">
      {/* Encabezado Principal */}
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onMenu}
          className="text-sm text-white/70 hover:text-white flex items-center gap-1 transition-colors"
        >
          ← Menú principal
        </button>
        <p className="font-display text-sm font-semibold tracking-wide uppercase text-white/90">
          {titulo}
        </p>
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