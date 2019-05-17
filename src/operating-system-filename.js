// https://url.spec.whatwg.org/#example-start-with-a-widows-drive-letter

export const operatingSystemFilenameToPathname = (operatingSystemFilename) => {
  if (isWindowsFilename(operatingSystemFilename)) {
    return `/${replaceBackSlashWithSlash(operatingSystemFilename)}`
  }

  // linux and mac operatingSystemFilename === pathname
  return operatingSystemFilename
}

export const pathnameToOperatingSystemFilename = (pathname) => {
  if (pathname[0] !== "/") throw new Error(`pathname must start with /`)

  const pathnameWithoutLeadingSlash = pathname.slice(1)
  if (
    startsWithWindowsDriveLetter(pathnameWithoutLeadingSlash) &&
    pathnameWithoutLeadingSlash[2] === "/"
  ) {
    return replaceSlashWithBackSlash(pathnameWithoutLeadingSlash)
  }

  // linux mac pathname === operatingSystemFilename
  return pathname
}

export const pathnameIsInside = (pathname, otherPathname) => {
  return pathname.startsWith(`${otherPathname}/`)
}

export const pathnameToRelativePathname = (pathname, otherPathname) => {
  const pathnameWithoutLeadingSlash = pathname.slice(1)
  return pathnameWithoutLeadingSlash.slice(otherPathname.length)
}

export const appendpathnameRelative = (filename, pathnameRelative) => {
  if (isWindowsFilename(filename)) {
    return `${filename}${replaceSlashWithBackSlash(`/${pathnameRelative}`)}`
  }

  return `${filename}/${pathnameRelative}`
}

const replaceSlashWithBackSlash = (string) => string.replace(/\//g, "\\")

const replaceBackSlashWithSlash = (string) => string.replace(/\\/g, "/")

const isWindowsFilename = (filename) => {
  return startsWithWindowsDriveLetter(filename) && filename[2] === "\\"
}

const startsWithWindowsDriveLetter = (string) => {
  const firstChar = string[0]
  if (!/[a-zA-Z]/.test(firstChar)) return false

  const secondChar = string[1]
  if (secondChar !== ":") return false

  return true
}
