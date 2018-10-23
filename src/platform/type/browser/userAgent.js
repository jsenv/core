const firstMatch = (regexp, string) => {
  const match = string.match(regexp)
  return match && match.length > 0 ? match[1] || undefined : undefined
}

const secondMatch = (regexp, string) => {
  const match = string.match(regexp)
  return match && match.length > 1 ? match[2] || undefined : undefined
}

const commonVersionIdentifier = /version\/(\d+(\.?_?\d+)+)/i

const opera = (string) => {
  // opera below 13
  if (/opera/i.test(string)) {
    return {
      name: "opera",
      version:
        firstMatch(commonVersionIdentifier, string) ||
        firstMatch(/(?:opera)[\s/](\d+(\.?_?\d+)+)/i, string),
    }
  }

  // opera above 13
  if (/opr\/|opios/i.test(string)) {
    return {
      name: "opera",
      version:
        firstMatch(/(?:opr|opios)[\s/](\S+)/i, string) ||
        firstMatch(commonVersionIdentifier, string),
    }
  }

  return null
}

const ie = (string) => {
  if (/msie|trident/i.test(string)) {
    return {
      name: "ie",
      version: firstMatch(/(?:msie |rv:)(\d+(\.?_?\d+)+)/i, string),
    }
  }
  return null
}

const edge = (string) => {
  if (/edg([ea]|ios)/i.test(string)) {
    return {
      name: "edge",
      version: secondMatch(/edg([ea]|ios)\/(\d+(\.?_?\d+)+)/i, string),
    }
  }
  return null
}

const firefox = (string) => {
  if (/firefox|iceweasel|fxios/i.test(string)) {
    return {
      name: "firefox",
      version: firstMatch(/(?:firefox|iceweasel|fxios)[\s/](\d+(\.?_?\d+)+)/i, string),
    }
  }
  return null
}

const chrome = (string) => {
  if (/chromium/i.test(string)) {
    return {
      name: "chrome",
      version:
        firstMatch(/(?:chromium)[\s/](\d+(\.?_?\d+)+)/i, string) ||
        firstMatch(commonVersionIdentifier, string),
    }
  }

  if (/chrome|crios|crmo/i.test(string)) {
    return {
      name: "chrome",
      version: firstMatch(/(?:chrome|crios|crmo)\/(\d+(\.?_?\d+)+)/i, string),
    }
  }

  return null
}

const safari = (string) => {
  if (/safari|applewebkit/i.test(string)) {
    return {
      name: "safari",
      version: firstMatch(commonVersionIdentifier, string),
    }
  }
  return null
}

const parserCompose = (parsers) => (string) => {
  let i = 0
  while (i < parsers.length) {
    const parser = parsers[i]
    i++
    const result = parser(string)
    if (result) {
      return result
    }
  }
  return null
}

const parser = parserCompose([opera, ie, edge, firefox, chrome, safari])

const normalizeName = (name) => {
  return name.toLowerCase()
}

const normalizeVersion = (version) => {
  const parts = version.split(".")
  // remove extraneous .
  return parts.slice(0, 3).join(".")
}

export const parse = (string) => {
  const { name = "other", version = "unknown" } = parser(string) || {}

  return {
    name: normalizeName(name),
    version: normalizeVersion(version),
  }
}
