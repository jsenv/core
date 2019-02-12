import { objectMapValue } from "../objectHelper.js"

// make path absolute because relative path may not work, to be verified
export const coverageMapToAbsolute = (relativeCoverageMap, rootname) => {
  return objectMapValue(relativeCoverageMap, (coverage) => {
    return {
      ...coverage,
      path: `${rootname}/${coverage.path}`,
    }
  })
}
