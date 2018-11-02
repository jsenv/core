import { coverageMapCompose } from "./coverageMapCompose.js"

export const platformResultMapToCoverageMap = (platformResultMap) => {
  const coverageMaps = []

  Object.keys(platformResultMap).forEach((platformName) => {
    const fileResultMap = platformResultMap[platformName]
    Object.keys(fileResultMap).forEach((file) => {
      coverageMaps.push(fileResultMap[file].coverageMap)
    })
  })

  return coverageMapCompose(...coverageMaps)
}
