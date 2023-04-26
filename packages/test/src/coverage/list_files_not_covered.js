import { collectFiles } from "@jsenv/filesystem"

export const listRelativeFileUrlToCover = async ({
  signal,
  rootDirectoryUrl,
  coverageConfig,
}) => {
  const matchingFileResultArray = await collectFiles({
    signal,
    directoryUrl: rootDirectoryUrl,
    associations: { cover: coverageConfig },
    predicate: ({ cover }) => cover,
  })
  return matchingFileResultArray.map(({ relativeUrl }) => relativeUrl)
}
