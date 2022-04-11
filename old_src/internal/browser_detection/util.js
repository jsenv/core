export const firstMatch = (regexp, string) => {
  const match = string.match(regexp)
  return match && match.length > 0 ? match[1] || undefined : undefined
}

export const secondMatch = (regexp, string) => {
  const match = string.match(regexp)
  return match && match.length > 1 ? match[2] || undefined : undefined
}

export const userAgentToVersion = (userAgent) => {
  return firstMatch(/version\/(\d+(\.?_?\d+)+)/i, userAgent) || undefined
}
