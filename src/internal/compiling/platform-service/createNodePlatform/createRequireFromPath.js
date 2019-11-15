import { Module } from "module"
import { pathnameToDirname } from "@jsenv/href"

// https://nodejs.org/api/modules.html#modules_module_createrequirefrompath_filename
export const createRequireFromPath =
  typeof Module.createRequireFromPath === "function"
    ? Module.createRequireFromPath
    : (filePath) => {
        const dirname = pathnameToDirname(filePath)
        const moduleObject = new Module(filePath)
        moduleObject.filename = filePath
        moduleObject.paths = Module._nodeModulePaths(dirname)

        // https://github.com/nodejs/node/blob/f76ce0a75641991bfc235775a4747c978e0e281b/lib/module.js#L506
        const resolve = (specifier) => Module._resolveFilename(specifier, moduleObject)

        const __require = import.meta.require

        // eslint-disable-next-line import/no-dynamic-require
        const scopedRequire = (specifier) => __require(resolve(specifier))

        scopedRequire.main = __require.main
        scopedRequire.extensions = __require.extensions
        scopedRequire.cache = __require.cache
        scopedRequire.resolve = resolve

        return scopedRequire
      }
