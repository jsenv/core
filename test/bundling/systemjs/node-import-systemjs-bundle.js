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
  return { namespace }
}
