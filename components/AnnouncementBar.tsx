function fmt(n: number) {
  return n.toLocaleString('es-AR')
}

export default function AnnouncementBar({
  gratisAmba = 60000,
  gratisInterior = 120000,
}: {
  gratisAmba?: number
  gratisInterior?: number
}) {
  return (
    <div className="w-full bg-brand-purple text-white text-xs font-medium py-2 px-4 text-center">
      🚚 <span className="font-bold">Envío gratis:</span> AMBA en compras +${fmt(gratisAmba)} · Interior del país en compras +${fmt(gratisInterior)}
    </div>
  )
}
