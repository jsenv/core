export const ensureRelativePathsInCoverage = (coverageMap) => {
  const coverageMapRelative = {}
  Object.keys(coverageMap).forEach((key) => {
    const coverageForFile = coverageMap[key]
    if (coverageForFile.path.startsWith("./")) {
      return coverageForFile
    }
    return {
      ...coverageForFile,
      path: `./${coverageForFile.path}`,
    }
  })
  return coverageMapRelative
}
