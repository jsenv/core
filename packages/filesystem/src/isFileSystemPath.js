export const isFileSystemPath = (value) => {
  if (typeof value !== "string") {
    throw new TypeError(
      `isFileSystemPath first arg must be a string, got ${value}`,
    )
  }

  if (value[0] === "/") {
    return true
  }

  return startsWithWindowsDriveLetter(value)
}

const startsWithWindowsDriveLetter = (string) => {
  const firstChar = string[0]
  if (!/[a-zA-Z]/.test(firstChar)) return false

  const secondChar = string[1]
  if (secondChar !== ":") return false

  return true
}
