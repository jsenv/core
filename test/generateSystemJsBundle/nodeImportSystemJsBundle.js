import { resolveDirectoryUrl, resolveUrl } from "@jsenv/util"
import { createNodeSystem } from "../../src/internal/runtime/createNodeRuntime/createNodeSystem.js"
import { fetchSource } from "../../src/internal/runtime/createNodeRuntime/fetchSource.js"

export const nodeImportSystemJsBundle = async ({
  projectDirectoryUrl,
  testDirectoryRelativeUrl,
  mainRelativeUrl,
}) => {
  const testDirectoryUrl = resolveDirectoryUrl(testDirectoryRelativeUrl, projectDirectoryUrl)
  const mainFileUrl = resolveUrl(mainRelativeUrl, testDirectoryUrl)
  const nodeSystem = await createNodeSystem({
    fetchSource,
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
