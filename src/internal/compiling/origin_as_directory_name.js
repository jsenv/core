// https://stackoverflow.com/a/29676339

export const originAsDirectoryName = (origin) => {
  let directoryName = ""
  let i = 0
  while (i < origin.length) {
    const char = origin[i]
    i++
    const charAsDirectoryChar = convertChar(char)
    if (charAsDirectoryChar !== null) {
      directoryName += charAsDirectoryChar
    }
  }
  return directoryName
}

const convertChar = (char) => {
  if (/[a-zA-Z0-9_- \.]/.test(char)) {
    return char
  }
  return null
}
