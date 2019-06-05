import { operatingSystemPathToPathname } from "@jsenv/operating-system-path"
import { createNodeSystem } from "../../../src/node-platform-service/node-platform/create-node-system.js"

export const nodeImportSystemJsBundle = async ({
  projectPath,
  bundleIntoRelativePath,
  mainRelativePath,
}) => {
  const projectPathname = operatingSystemPathToPathname(projectPath)
  const mainHref = `file://${projectPathname}${bundleIntoRelativePath}${mainRelativePath}`
  const nodeSystem = createNodeSystem()
  const namespace = await nodeSystem.import(mainHref)

  return { namespace: normalizeNamespace(namespace) }
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
