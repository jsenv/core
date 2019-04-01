const semver = (version) => {
  if (typeof version === "number") {
    return {
      major: version,
      minor: 0,
      patch: 0,
    }
  }
  if (typeof version === "string") {
    if (version.indexOf(".") > -1) {
      const parts = version.split(".")
      return {
        major: Number(parts[0]),
        minor: parts[1] ? Number(parts[1]) : 0,
        patch: parts[2] ? Number(parts[2]) : 0,
      }
    }
    if (isNaN(version)) {
      return {
        major: 0,
        minor: 0,
        patch: 0,
      }
    }
    return {
      major: Number(version),
      minor: 0,
      patch: 0,
    }
  }
  throw new TypeError(`version must be a number or a string, got: ${typeof version}`)
}

export const versionCompare = (versionA, versionB) => {
  const semanticVersionA = semver(versionA)
  const semanticVersionB = semver(versionB)

  const majorDiff = semanticVersionA.major - semanticVersionB.major
  if (majorDiff > 0) {
    return majorDiff
  }
  if (majorDiff < 0) {
    return majorDiff
  }

  const minorDiff = semanticVersionA.minor - semanticVersionB.minor
  if (minorDiff > 0) {
    return minorDiff
  }
  if (minorDiff < 0) {
    return minorDiff
  }

  const patchDiff = semanticVersionA.patch - semanticVersionB.patch
  if (patchDiff > 0) {
    return patchDiff
  }
  if (patchDiff < 0) {
    return patchDiff
  }

  return 0
}

export const versionEqual = (versionA, versionB) => {
  return String(versionA) === String(versionB)
}

export const versionIsAbove = (versionSupposedAbove, versionSupposedBelow) => {
  return versionCompare(versionSupposedAbove, versionSupposedBelow) > 0
}

export const versionIsBelow = (versionSupposedBelow, versionSupposedAbove) => {
  return versionCompare(versionSupposedBelow, versionSupposedAbove) < 0
}

export const versionIsBelowOrEqual = (versionSupposedBelow, versionSupposedAbove) => {
  return (
    versionEqual(versionSupposedBelow, versionSupposedAbove) ||
    versionIsBelow(versionSupposedBelow, versionSupposedAbove)
  )
}

export const versionHighest = (versionA, versionB) => {
  return versionIsAbove(versionA, versionB) ? versionA : versionB
}

export const versionLowest = (versionA, versionB) => {
  return versionIsBelow(versionA, versionB) ? versionA : versionB
}
