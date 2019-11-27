import { resolveImport } from "@jsenv/import-map"
import { createNodeSystem } from "internal/platform/createNodePlatform/createNodeSystem.js"
import { resolveDirectoryUrl, resolveUrl } from "src/internal/urlUtils.js"

export const nodeImportSystemJsBundle = async ({
  projectDirectoryUrl,
  testDirectoryRelativePath,
  mainRelativePath,
}) => {
  const testDirectoryUrl = resolveDirectoryUrl(testDirectoryRelativePath, projectDirectoryUrl)
  const mainFileUrl = resolveUrl(mainRelativePath, testDirectoryUrl)
  const nodeSystem = createNodeSystem({
    resolveImport: (specifier, importer) => {
      return resolveImport({ specifier, importer })
    },
  })
  const namespace = await nodeSystem.import(mainFileUrl)

  return {
    namespace: normalizeNamespace(namespace),
  }
}

const normalizeNamespace = (namespace) => {
  if (typeof namespace !== "object") return namespace
  const normalized = {}
  // remove Symbol.toStringTag from values
  Object.keys(namespace).forEach((key) => {
    normalized[key] = namespace[key]
  })
  return normalized
}
