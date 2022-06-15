export const getCommonPathname = (pathname, otherPathname) => {
  const firstDifferentCharacterIndex = findFirstDifferentCharacterIndex(
    pathname,
    otherPathname,
  )

  // pathname and otherpathname are exactly the same
  if (firstDifferentCharacterIndex === -1) {
    return pathname
  }

  const commonString = pathname.slice(0, firstDifferentCharacterIndex + 1)
  // the first different char is at firstDifferentCharacterIndex
  if (pathname.charAt(firstDifferentCharacterIndex) === "/") {
    return commonString
  }

  if (otherPathname.charAt(firstDifferentCharacterIndex) === "/") {
    return commonString
  }

  const firstDifferentSlashIndex = commonString.lastIndexOf("/")
  return pathname.slice(0, firstDifferentSlashIndex + 1)
}

const findFirstDifferentCharacterIndex = (string, otherString) => {
  const maxCommonLength = Math.min(string.length, otherString.length)
  let i = 0
  while (i < maxCommonLength) {
    const char = string.charAt(i)
    const otherChar = otherString.charAt(i)
    if (char !== otherChar) {
      return i
    }
    i++
  }
  if (string.length === otherString.length) {
    return -1
  }
  // they differ at maxCommonLength
  return maxCommonLength
}
