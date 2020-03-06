import { composeCoverageMap } from "./composeCoverageMap.js"

export const runtimeResultMapToCoverageMap = (runtimeResultMap) => {
  const coverageMapList = []

  Object.keys(runtimeResultMap).forEach((runtimeName) => {
    const fileResultMap = runtimeResultMap[runtimeName]
    Object.keys(fileResultMap).forEach((file) => {
      const fileResult = fileResultMap[file]
      const fileCoverageMap = fileResult.coverageMap
      if (fileCoverageMap) {
        coverageMapList.push(fileCoverageMap)
      }
    })
  })

  return composeCoverageMap(...coverageMapList)
}
