import { objectMapValue } from "../../objectHelper.js"

export const coverageMapToAbsolute = (relativeCoverageMap, projectPath) => {
  return objectMapValue(relativeCoverageMap, (coverage) => {
    return {
      ...coverage,
      path: `${projectPath}/${coverage.path}`,
    }
  })
}
