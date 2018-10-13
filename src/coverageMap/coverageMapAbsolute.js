import { objectMapKey } from './objectHelper.js'

// make path absolute because relative path may not work, to be verified
export const coverageMapAbsolute = (relativeCoverageMap, root) => {
  return objectMapKey(relativeCoverageMap, (relativeName) => `${root}/${relativeName}`)
}
