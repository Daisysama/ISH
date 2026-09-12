/** Stable comment permalink: the discussion page resolves the root's current page before scrolling. */
export function commentPermalink(projectId: string, updateId: string | null, commentId: string) {
  const params = new URLSearchParams({ comment: commentId })
  if (updateId) params.set('update', updateId)
  return `/projects/${projectId}/discussion?${params}#comment-${commentId}`
}
