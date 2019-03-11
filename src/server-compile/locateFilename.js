import { resolveNodeModuleSpecifier } from "./resolveNodeModuleSpecifier.js"

const NODE_MODULE_FOLDER = "node_modules"

export const locateFilename = ({ rootHref, filenameRelative }) => {
  // request to "node_modules/foo/src/foo.js"
  // must be searched as "foo/src/foo.js"
  // from rootHref

  const nodeModuleSpecifier = moduleFilenameRelativeToNodeModuleSpecifier(filenameRelative)
  if (!nodeModuleSpecifier) return `${rootHref}/${filenameRelative}`

  return resolveNodeModuleSpecifier({
    rootHref,
    specifier: nodeModuleSpecifier,
  })
}

const moduleFilenameRelativeToNodeModuleSpecifier = (filenameRelative) => {
  const lastIndex = filenameRelative.lastIndexOf(`${NODE_MODULE_FOLDER}/`)
  if (lastIndex === -1) return ""

  const afterLastNodeModule = filenameRelative.slice(lastIndex + `${NODE_MODULE_FOLDER}/`.length)
  return afterLastNodeModule
}
