export const assertSpecifierMetaMap = (value, checkComposition = true) => {
  if (!isPlainObject(value)) {
    throw new TypeError(`specifierMetaMap must be a plain object, got ${value}`)
  }
  if (checkComposition) {
    const plainObject = value
    Object.keys(plainObject).forEach((key) => {
      assertUrlLike(key, "specifierMetaMap key")
      const value = plainObject[key]
      if (value !== null && !isPlainObject(value)) {
        throw new TypeError(
          `specifierMetaMap value must be a plain object or null, got ${value} under key ${key}`,
        )
      }
    })
  }
}

export const assertUrlLike = (value, name = "url") => {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a url string, got ${value}`)
  }
  if (isWindowsPathnameSpecifier(value)) {
    throw new TypeError(
      `${name} must be a url but looks like a windows pathname, got ${value}`,
    )
  }
  if (!hasScheme(value)) {
    throw new TypeError(
      `${name} must be a url and no scheme found, got ${value}`,
    )
  }
}

export const isPlainObject = (value) => {
  if (value === null) {
    return false
  }
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return false
    }
    return true
  }
  return false
}

const isWindowsPathnameSpecifier = (specifier) => {
  const firstChar = specifier[0]
  if (!/[a-zA-Z]/.test(firstChar)) return false
  const secondChar = specifier[1]
  if (secondChar !== ":") return false
  const thirdChar = specifier[2]
  return thirdChar === "/" || thirdChar === "\\"
}

const hasScheme = (specifier) => /^[a-zA-Z]+:/.test(specifier)
