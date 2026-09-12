/** Only internal pages are accepted by the public-profile return link. */
export function publicUserHref(userId: string | number, returnTo: string) {
  return `/users/${userId}?${new URLSearchParams({ returnTo })}`
}

export function safePublicProfileReturn(candidate: string | string[] | undefined) {
  if (typeof candidate !== 'string' || !candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return '/projects'
  try {
    const url = new URL(candidate, 'https://fromish.invalid')
    if (url.origin !== 'https://fromish.invalid') return '/projects'
    if (url.pathname === '/' || url.pathname === '/dashboard' || url.pathname === '/projects' ||
      /^\/projects\/[a-f0-9-]{36}(?:\/(?:discussion|team))?$/.test(url.pathname)) {
      return `${url.pathname}${url.search}${url.hash}`
    }
  } catch { /* invalid return path */ }
  return '/projects'
}
