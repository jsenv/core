import { resolveImport } from "@jsenv/import-map"
import { resolveDirectoryUrl, resolveUrl } from "@jsenv/util"
import { createNodeSystem } from "../../src/internal/platform/createNodePlatform/createNodeSystem.js"

export const nodeImportSystemJsBundle = async ({
  projectDirectoryUrl,
  testDirectoryRelativeUrl,
  mainRelativeUrl,
}) => {
  const testDirectoryUrl = resolveDirectoryUrl(testDirectoryRelativeUrl, projectDirectoryUrl)
  const mainFileUrl = resolveUrl(mainRelativeUrl, testDirectoryUrl)
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
