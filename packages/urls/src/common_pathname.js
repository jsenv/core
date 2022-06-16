export const getCommonPathname = (pathname, otherPathname) => {
  if (pathname === otherPathname) {
    return pathname
  }
  let commonPart = ""
  let commonPathname = ""
  let i = 0
  const length = pathname.length
  const otherLength = otherPathname.length
  while (i < pathname.length) {
    const char = pathname.charAt(i)
    const otherChar = otherPathname.charAt(i)
    if (char === otherChar) {
      if (char === "/") {
        commonPart += "/"
        commonPathname += commonPart
        commonPart = ""
      } else {
        commonPart += char
      }
    } else {
      return commonPathname
    }
    i++
  }
  if (length === otherLength) {
    commonPathname += commonPart
  } else if (otherPathname.charAt(i) === "/") {
    commonPathname += commonPart
  }
  return commonPathname
}
