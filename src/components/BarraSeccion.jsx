export default function BarraSeccion({ titulo, subTabs, tabActiva, onCambiarTab, onMenu }) {
  return (
    <div className="bg-itd-navy text-white">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <button
          onClick={onMenu}
          className="text-sm text-white/80 hover:text-white flex items-center gap-1"
        >
          ← Menú principal
        </button>
        <p className="font-display text-sm font-medium">{titulo}</p>
      </div>
      {subTabs && (
        <nav className="max-w-5xl mx-auto px-4 flex gap-1 border-t border-white/10">
          {subTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onCambiarTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tabActiva === tab.id
                  ? 'border-itd-gold text-white'
                  : 'border-transparent text-white/60 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
