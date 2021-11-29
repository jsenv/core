import { createNodeSystem } from "@jsenv/core/src/internal/node_runtime/node_system.js"
import { fetchSource } from "@jsenv/core/src/internal/node_runtime/fetchSource.js"

export const nodeImportSystemJsBuild = async ({
  projectDirectoryUrl,
  compileServerOrigin,
  compileDirectoryRelativeUrl,
  mainRelativeUrl,
}) => {
  const mainFileUrl = `${compileServerOrigin}/${compileDirectoryRelativeUrl}${mainRelativeUrl}`
  const nodeSystem = await createNodeSystem({
    fetchSource,
    projectDirectoryUrl,
    compileServerOrigin,
    compileDirectoryRelativeUrl,
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
