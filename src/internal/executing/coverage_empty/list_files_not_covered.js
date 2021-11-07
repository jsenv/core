import { collectFiles } from "@jsenv/filesystem"

export const listRelativeFileUrlToCover = async ({
  multipleExecutionsOperation,
  projectDirectoryUrl,
  coverageConfig,
}) => {
  const structuredMetaMapForCoverage = {
    cover: coverageConfig,
  }

  const matchingFileResultArray = await collectFiles({
    signal: multipleExecutionsOperation.signal,
    directoryUrl: projectDirectoryUrl,
    structuredMetaMap: structuredMetaMapForCoverage,
    predicate: ({ cover }) => cover,
  })

  return matchingFileResultArray.map(({ relativeUrl }) => relativeUrl)
}
