// https://github.com/benmosher/eslint-plugin-import/blob/master/resolvers/node/index.js
// https://github.com/benmosher/eslint-plugin-import/tree/master/resolvers
// https://github.com/olalonde/eslint-import-resolver-babel-root-import

const path = require("path")
const { existsSync } = require("fs")
const nodeResolve = require("resolve")

const localRoot = __dirname
const resolveNonRelativeWithNodeModule = true

const resolve = (source, file) => {
  console.log(`resolving "${source}" dependency inside ${file}`)

  if (nodeResolve.isCore(source)) {
    console.log(`-> core`)
    return { found: true, path: null }
  }

  // following to be deactived in a project using jsenv
  if (resolveNonRelativeWithNodeModule && source[0] !== "." && source[0] !== "/") {
    try {
      console.log(`resolve ${source}`)
      const sourceResolved = nodeResolve.sync(source, {
        extensions: [".mjs", ".js", ".json"],
        basedir: path.dirname(file),
      })
      console.log(`-> found at ${sourceResolved}`)
      return { found: true, path: sourceResolved }
    } catch (e) {
      if (e && e.code === "MODULE_NOT_FOUND") {
        console.log("-> not found")
        return { found: false }
      }
      console.log("-> error", e)
      throw e
    }
  }

  if (source[0] === "/") {
    source = `${localRoot}/${source.slice(1)}`
  }

  const sourceFile = path.resolve(path.dirname(file), source)
  const nodeModuleIndex = sourceFile.indexOf("node_modules/")
  if (nodeModuleIndex > -1) {
    const nodeModuleFolderParent = sourceFile.slice(0, nodeModuleIndex - 1)
    const nodeModuleImport = sourceFile.slice(nodeModuleIndex + "node_modules/".length)

    try {
      console.log(`resolve node module from ${nodeModuleFolderParent}`)
      const sourceResolved = nodeResolve.sync(nodeModuleImport, {
        extensions: [".mjs", ".js", ".json"],
        basedir: nodeModuleFolderParent,
      })
      console.log(`-> found at ${sourceResolved}`)
      return { found: true, path: sourceResolved }
    } catch (e) {
      if (e && e.code === "MODULE_NOT_FOUND") {
        console.log("-> not found")
        return { found: false }
      }
      console.log("-> error", e)
      throw e
    }
  }

  if (existsSync(sourceFile)) {
    console.log(`-> found at ${sourceFile}`)
    return {
      found: true,
      path: sourceFile,
    }
  }
  console.log(`-> not found at ${sourceFile}`)
  return {
    found: false,
    path: sourceFile,
  }
}

exports.interfaceVersion = 2

exports.resolve = resolve
