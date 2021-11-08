import { collectFiles } from "@jsenv/filesystem"

export const listRelativeFileUrlToCover = async ({
  signal,
  projectDirectoryUrl,
  coverageConfig,
}) => {
  const structuredMetaMapForCoverage = {
    cover: coverageConfig,
  }

  const matchingFileResultArray = await collectFiles({
    signal,
    directoryUrl: projectDirectoryUrl,
    structuredMetaMap: structuredMetaMapForCoverage,
    predicate: ({ cover }) => cover,
  })

  return matchingFileResultArray.map(({ relativeUrl }) => relativeUrl)
}
