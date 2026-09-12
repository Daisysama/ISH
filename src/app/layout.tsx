import type { Metadata } from 'next'

import { SITE_URL } from '@/shared/site'
import '@/frontend/styles/tokens.css'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'FromISH · 伊始', template: '%s' },
  description: '有点子？上伊始！找乐子？也上伊始！',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'FromISH · 伊始',
    description: '创作者把想法咩出来，玩家提前遇见还没长大的作品。',
    url: '/',
    siteName: 'FromISH',
    type: 'website',
    locale: 'zh_CN',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>
}
