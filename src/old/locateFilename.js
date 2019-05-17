import { resolveNodeModuleSpecifier } from "./resolveNodeModuleSpecifier.js"

const NODE_MODULE_FOLDER = "node_modules"

export const locateFilename = ({ rootHref, pathnameRelative }) => {
  // request to "node_modules/foo/src/foo.js"
  // must be searched as "foo/src/foo.js"
  // from rootHref

  const nodeModuleSpecifier = modulepathnameRelativeToNodeModuleSpecifier(pathnameRelative)
  if (!nodeModuleSpecifier) return `${rootHref}/${pathnameRelative}`

  try {
    return resolveNodeModuleSpecifier({
      rootHref,
      specifier: nodeModuleSpecifier,
    })
  } catch (e) {
    if (e && e.code === "MODULE_NOT_FOUND") {
      // return an empty string, it will return 404 to client
      return ""
    }
    throw e
  }
}

const modulepathnameRelativeToNodeModuleSpecifier = (pathnameRelative) => {
  const lastIndex = pathnameRelative.lastIndexOf(`${NODE_MODULE_FOLDER}/`)
  if (lastIndex === -1) return ""

  const afterLastNodeModule = pathnameRelative.slice(lastIndex + `${NODE_MODULE_FOLDER}/`.length)
  return afterLastNodeModule
}
