export const coverageMapToAbsolute = (relativeCoverageMap, projectPath) => {
  const absoluteCoverageMap = {}
  Object.keys(relativeCoverageMap).forEach((coverage) => {
    return {
      ...coverage,
      path: `${projectPath}/${coverage.path}`,
    }
  })
  return absoluteCoverageMap
}
