'use client'

import { useState } from 'react'

export function OneTimeNewBadge({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(show)

  if (!visible) return null

  return (
    <button
      aria-label="标记这条新结果为已看"
      className="one-time-new-badge"
      type="button"
      title="新结果 · 点击收起"
      onClick={() => setVisible(false)}
    >
      <span aria-hidden="true" />
      新
    </button>
  )
}
