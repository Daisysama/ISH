import Image from 'next/image'
import Link from 'next/link'

export function BrandIdentity({
  href = '/',
  compact = false,
}: {
  href?: string
  compact?: boolean
}) {
  return (
    <Link className={`fromish-brand ${compact ? 'fromish-brand-compact' : ''}`} href={href}>
      <span className="fromish-mark" aria-hidden="true">
        <Image
          alt=""
          fill
          priority
          sizes={compact ? '38px' : '48px'}
          src="/brand/fromish-alpha-mark.png"
        />
      </span>
      <span className="fromish-brand-copy">
        <strong>FromISH</strong>
        <small>by ISH 伊始</small>
      </span>
    </Link>
  )
}
