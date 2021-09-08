import { urlToFilename } from "@jsenv/filesystem"

export const urlIsCompilationAsset = (url) => {
  const filename = urlToFilename(url)

  // sourcemap are not inside the asset folder because
  // of https://github.com/microsoft/vscode-chrome-debug-core/issues/544
  if (filename.endsWith(".map")) {
    return true
  }

  return filename.includes("__asset__")
}

export const getMetaJsonFileUrl = (compileFileUrl) =>
  generateCompiledFileAssetUrl(compileFileUrl, "meta.json")

export const generateCompiledFileAssetUrl = (compiledFileUrl, assetName) => {
  return `${compiledFileUrl}__asset__${assetName}`
}
