function fmt(n: number) {
  return n.toLocaleString('es-AR')
}

export default function AnnouncementBar({
  gratisCaba = 40000,
  gratisAmba = 60000,
  gratisInterior = 120000,
}: {
  gratisCaba?: number
  gratisAmba?: number
  gratisInterior?: number
}) {
  return (
    <div className="w-full bg-brand-purple text-white text-xs font-medium py-2 px-4 text-center">
      🚚 <span className="font-bold">Envío gratis:</span> CABA +${fmt(gratisCaba)} · AMBA +${fmt(gratisAmba)} · Interior del país +${fmt(gratisInterior)}
    </div>
  )
}
