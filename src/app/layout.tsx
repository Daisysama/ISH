import type { Metadata } from 'next'

import '@/frontend/styles/tokens.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'FromISH · 伊始',
  description: '有点子？上伊始！找乐子？也上伊始！',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
