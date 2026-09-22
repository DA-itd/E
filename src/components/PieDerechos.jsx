export default function PieDerechos() {
  const anio = new Date().getFullYear()
  return (
    <footer className="w-full mt-auto py-3 px-4 bg-gradient-to-r from-itd-guinda via-[#781834] to-itd-navy text-white text-center text-xs border-t border-white/10 shadow-xs">
      D.R. © Alejandro Calderón Rentería. {anio} · Instituto Tecnológico de Durango
    </footer>
  )
}
