import { coverageMapCompose } from "./coverageMapCompose.js"

export const platformResultMapToCoverageMap = (platformResultMap) => {
  const coverageMapList = []

  Object.keys(platformResultMap).forEach((platformName) => {
    const fileResultMap = platformResultMap[platformName]
    Object.keys(fileResultMap).forEach((file) => {
      const fileResult = fileResultMap[file]
      const fileCoverageMap = fileResult.coverageMap
      if (fileCoverageMap) {
        coverageMapList.push(fileCoverageMap)
      }
    })
  })

  return coverageMapCompose(...coverageMapList)
}
