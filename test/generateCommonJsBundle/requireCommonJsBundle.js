import { resolveDirectoryUrl, resolveUrl, fileUrlToPath } from "src/internal/urlUtils.js"

export const requireCommonJsBundle = async ({
  projectDirectoryUrl,
  bundleDirectoryRelativeUrl,
  mainRelativePath,
}) => {
  const bundleDirectoryUrl = resolveDirectoryUrl(bundleDirectoryRelativeUrl, projectDirectoryUrl)
  const mainFileUrl = resolveUrl(mainRelativePath, bundleDirectoryUrl)
  const mainFilePath = fileUrlToPath(mainFileUrl)
  const namespace = import.meta.require(mainFilePath)
  return {
    namespace: normalizeNamespace(namespace),
  }
}

const normalizeNamespace = (namespace) => {
  if (typeof namespace !== "object") return namespace
  if (Array.isArray(namespace)) return namespace
  if (namespace instanceof Promise) return namespace
  const normalized = {}
  // remove "__esModule" from values
  Object.keys(namespace).forEach((key) => {
    normalized[key] = namespace[key]
  })
  return normalized
}
