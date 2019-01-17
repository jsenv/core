// https://github.com/benmosher/eslint-plugin-import/blob/master/resolvers/node/index.js
// https://github.com/benmosher/eslint-plugin-import/tree/master/resolvers
// https://github.com/olalonde/eslint-import-resolver-babel-root-import

const path = require("path")
// eslint-disable-next-line
const nodeResolve = require("resolve")

const localRoot = __dirname

// il faut que / on le cherche dans localroot/
// que /node_nodules on cherche a le resoudre
// avec la logic node de node modules
const resolve = (source, file) => {
  console.log(`resolving "${source}" dependency inside ${file}`)
  if (nodeResolve.isCore(source)) {
    console.log(`-> core`)
    return { found: true, path: null }
  }
  if (source[0] === "/") {
    source = source.slice(1)
  }
  if (source.startsWith("node_modules/")) {
    source = source.slice("node_modules/".length)
  }

  try {
    const basedir = path.dirname(path.resolve(file))
    console.log(`search node module from ${basedir}`)
    const sourceResolved = nodeResolve.sync(source, {
      extensions: [".mjs", ".js", ".json"],
      basedir,
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

exports.interfaceVersion = 2

exports.resolve = resolve
