export const compilationResultToTransformResult = ({ compiledSource, assets, assetsContent }) => {
  const code = compiledSource

  const sourceMapAssetIndex = assets.findIndex((asset) => asset.endsWith(".map"))
  const map =
    sourceMapAssetIndex === -1 ? undefined : JSON.parse(assetsContent[sourceMapAssetIndex])

  return { code, map }
}
