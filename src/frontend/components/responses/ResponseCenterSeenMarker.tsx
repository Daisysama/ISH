'use client'

import { useEffect } from 'react'

import { markOutgoingResponseDecisionsSeenAction } from '@/backend/responses/actions'

export function ResponseCenterSeenMarker({ shouldMark }: { shouldMark: boolean }) {
  useEffect(() => {
    if (!shouldMark) return
    void markOutgoingResponseDecisionsSeenAction()
  }, [shouldMark])

  return null
}
