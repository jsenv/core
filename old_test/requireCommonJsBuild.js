import {
  resolveDirectoryUrl,
  resolveUrl,
  urlToFileSystemPath,
} from "@jsenv/filesystem"
import { require } from "@jsenv/core/src/internal/require.js"

export const requireCommonJsBuild = async ({
  projectDirectoryUrl,
  buildDirectoryRelativeUrl,
  mainRelativeUrl,
}) => {
  const buildDirectoryUrl = resolveDirectoryUrl(
    buildDirectoryRelativeUrl,
    projectDirectoryUrl,
  )
  const mainFileUrl = resolveUrl(mainRelativeUrl, buildDirectoryUrl)
  const mainFilePath = urlToFileSystemPath(mainFileUrl)
  // eslint-disable-next-line import/no-dynamic-require
  const namespace = require(mainFilePath)
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
