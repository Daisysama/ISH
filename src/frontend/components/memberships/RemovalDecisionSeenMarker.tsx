'use client'

import { useEffect } from 'react'

import { markRemovalReviewDecisionsSeenAction } from '@/backend/removal-reviews/actions'

/** 进入本人该项目的复核页后，才将该项目已展示的处理结果标记为已看。 */
export function RemovalDecisionSeenMarker({ projectId, shouldMark }: { projectId: string; shouldMark: boolean }) {
  useEffect(() => {
    if (!shouldMark) return
    void markRemovalReviewDecisionsSeenAction(projectId)
  }, [projectId, shouldMark])
  return null
}
