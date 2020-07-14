export const urlIsAsset = (url) => {
  const pathname = new URL(url).pathname

  // sourcemap are not inside the asset folder because
  // of https://github.com/microsoft/vscode-chrome-debug-core/issues/544
  if (pathname.endsWith(".map")) return true

  return pathnameToBasename(pathname).includes("__asset__")
}

export const getMetaJsonFileUrl = (compileFileUrl) =>
  generateCompiledFileAssetUrl(compileFileUrl, "meta.json")

export const generateCompiledFileAssetUrl = (compiledFileUrl, assetName) => {
  return `${compiledFileUrl}__asset__${assetName}`
}

export const pathnameToBasename = (pathname) => {
  const slashLastIndex = pathname.lastIndexOf("/")
  if (slashLastIndex === -1) {
    return pathname
  }
  return pathname.slice(slashLastIndex + 1)
}
