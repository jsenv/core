import { sync } from "resolve"
import { hrefToPathname, pathnameToDirname } from "/node_modules/@jsenv/module-resolution/index.js"

export const resolveNodeModuleSpecifier = ({ rootHref, importer, specifier }) => {
  try {
    const nodeModuleFilePathname = sync(specifier, {
      extensions: [".mjs", ".js", ".json"],
      basedir: importer ? pathnameToDirname(hrefToPathname(importer)) : hrefToPathname(rootHref),
    })
    return `file://${nodeModuleFilePathname}`
  } catch (e) {
    if (e && e.code === "MODULE_NOT_FOUND") {
      throw createNodeModuleNotFoundError({
        rootHref,
        importer,
        specifier,
      })
    }
    throw e
  }
}

const createNodeModuleNotFoundError = ({ rootHref, importer, specifier }) => {
  const error = new Error(`node module not found.
  rootHref: ${rootHref}
importer: ${importer}
specifier: ${specifier}`)
  error.code = "MODULE_NOT_FOUND"
  return error
}

/*
we could also consider this

import path from "path"
import Module from "module"

export const projectFileToNodeModuleFile = ({ moduleSpecifier, file }) => {
  const baseFolder = fileToDirname(file)
  const requireContext = new Module(baseFolder)
  requireContext.paths = Module._nodeModulePaths(baseFolder)

  try {
    return Module._resolveFilename(moduleSpecifier, requireContext, true)
  } catch (e) {
    if (e && e.code === "MODULE_NOT_FOUND") {
      return ""
    }
    throw e
  }
}
*/
