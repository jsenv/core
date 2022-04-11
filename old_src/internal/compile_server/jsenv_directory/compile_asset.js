import { urlToFilename, urlToOrigin, urlToPathname } from "@jsenv/filesystem"

export const inferCompilationAssetFromUrl = (url) => {
  const filename = urlToFilename(url)
  // sourcemap are not inside the asset folder because
  // of https://github.com/microsoft/vscode-chrome-debug-core/issues/544
  if (filename.endsWith(".map")) {
    return {
      type: "sourcemap",
    }
  }
  if (filename.includes("__asset__")) {
    return {
      type: "something",
    }
  }
  return null
}

export const getMetaJsonFileUrl = (compileFileUrl) =>
  generateCompilationAssetUrl(compileFileUrl, "meta.json")

export const generateCompilationAssetUrl = (compiledFileUrl, assetName) => {
  // we want to remove eventual search params from url
  const origin = urlToOrigin(compiledFileUrl)
  const pathname = urlToPathname(compiledFileUrl)
  const compilationAssetUrl = `${origin}${pathname}__asset__${assetName}`
  return compilationAssetUrl
}
