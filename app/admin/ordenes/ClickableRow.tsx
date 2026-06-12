'use client'

export function ClickableRow({
  href,
  children,
  className,
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <tr
      className={`${className ?? ''} cursor-pointer`}
      onClick={() => { window.location.href = href }}
    >
      {children}
    </tr>
  )
}
