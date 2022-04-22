import { pathToFileURL } from "node:url"

import { injectImport } from "@jsenv/utils/js_ast/babel_utils.js"
import {
  getBabelHelperFileUrl,
  babelHelperNameFromUrl,
} from "@jsenv/babel-plugins/main.js"

// named import approach found here:
// https://github.com/rollup/rollup-plugin-babel/blob/18e4232a450f320f44c651aa8c495f21c74d59ac/src/helperPlugin.js#L1

// for reference this is how it's done to reference
// a global babel helper object instead of using
// a named import
// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-plugin-external-helpers/src/index.js

export const babelPluginBabelHelpersAsJsenvImports = (
  babel,
  { getImportSpecifier },
) => {
  return {
    name: "babel-helper-as-jsenv-import",
    pre: (file) => {
      const cachedHelpers = {}
      file.set("helperGenerator", (name) => {
        // the list of possible helpers name
        // https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-helpers/src/helpers.js#L13
        if (!file.availableHelper(name)) {
          return undefined
        }
        if (cachedHelpers[name]) {
          return cachedHelpers[name]
        }
        const filePath = file.opts.filename
        const fileUrl = pathToFileURL(filePath).href
        if (babelHelperNameFromUrl(fileUrl) === name) {
          return undefined
        }
        const babelHelperImportSpecifier = getBabelHelperFileUrl(name)
        const helper = injectImport({
          programPath: file.path,
          from: getImportSpecifier(babelHelperImportSpecifier),
          nameHint: `_${name}`,
          // disable interop, useless as we work only with js modules
          importedType: "es6",
          // importedInterop: "uncompiled",
        })
        cachedHelpers[name] = helper
        return helper
      })
    },
  }
}
