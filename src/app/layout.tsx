import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'ISH · 伊始',
  description: '有个想法？找人一起把它做出来。',
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
