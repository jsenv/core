export const ensureRelativePathsInCoverage = (coverageMap) => {
  const coverageMapRelative = {}
  Object.keys(coverageMap).forEach((key) => {
    const coverageForFile = coverageMap[key]
    coverageMapRelative[key] = coverageForFile.path.startsWith("./")
      ? coverageForFile
      : {
          ...coverageForFile,
          path: `./${coverageForFile.path}`,
        }
  })
  return coverageMapRelative
}
