import { createNodeSystem } from "@jsenv/core/src/internal/node_launcher/node_system.js"
import { fetchSource } from "@jsenv/core/src/internal/node_launcher/fetch_source.js"

export const executeUsingNodeSystem = async ({
  projectDirectoryUrl,
  compileServerOrigin,
  compileDirectoryRelativeUrl,
  jsFileRelativeUrl,
}) => {
  const mainFileUrl = `${compileServerOrigin}/${compileDirectoryRelativeUrl}${jsFileRelativeUrl}`
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
