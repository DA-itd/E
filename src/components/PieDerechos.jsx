export default function PieDerechos() {
  const anio = new Date().getFullYear()
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-itd-guinda text-white text-center text-xs py-2 px-4">
      D.R. © Alejandro Calderón Rentería. {anio}
    </div>
  )
}
