export const isWindowsFilePath = (path) => startsWithWindowsDriveLetter(path) && path[2] === "\\"

export const startsWithWindowsDriveLetter = (string) => {
  const firstChar = string[0]
  if (!/[a-zA-Z]/.test(firstChar)) return false

  const secondChar = string[1]
  if (secondChar !== ":") return false

  return true
}

export const windowsFilePathToUrl = (windowsFilePath) => {
  return `file:///${replaceBackSlashesWithSlashes(windowsFilePath)}`
}

export const replaceBackSlashesWithSlashes = (string) => string.replace(/\\/g, "/")
