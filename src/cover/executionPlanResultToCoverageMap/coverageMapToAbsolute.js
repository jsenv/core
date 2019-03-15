import { objectMapValue } from "../../objectHelper.js"

export const coverageMapToAbsolute = (relativeCoverageMap, projectFolder) => {
  return objectMapValue(relativeCoverageMap, (coverage) => {
    return {
      ...coverage,
      path: `${projectFolder}/${coverage.path}`,
    }
  })
}
