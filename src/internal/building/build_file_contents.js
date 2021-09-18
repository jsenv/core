export const createBuildFileContents = ({ rollupBuild }) => {
  const buildFileContents = {}
  Object.keys(rollupBuild).forEach((buildRelativeUrl) => {
    const { type, source, code } = rollupBuild[buildRelativeUrl]

    buildFileContents[buildRelativeUrl] = type === "asset" ? source : code
  })
  return buildFileContents
}
