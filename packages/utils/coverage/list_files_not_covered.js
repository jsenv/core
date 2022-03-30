import { collectFiles } from "@jsenv/filesystem"

export const listRelativeFileUrlToCover = async ({
  signal,
  rootDirectoryUrl,
  coverageConfig,
}) => {
  const structuredMetaMapForCoverage = {
    cover: coverageConfig,
  }
  const matchingFileResultArray = await collectFiles({
    signal,
    directoryUrl: rootDirectoryUrl,
    structuredMetaMap: structuredMetaMapForCoverage,
    predicate: ({ cover }) => cover,
  })
  return matchingFileResultArray.map(({ relativeUrl }) => relativeUrl)
}
