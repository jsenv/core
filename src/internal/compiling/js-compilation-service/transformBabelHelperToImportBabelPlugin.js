import { require } from "../../require.js"
import {
  filePathToBabelHelperName,
  babelHelperNameToImportSpecifier,
} from "./babelHelper.js"

// named import approach found here:
// https://github.com/rollup/rollup-plugin-babel/blob/18e4232a450f320f44c651aa8c495f21c74d59ac/src/helperPlugin.js#L1

// for reference this is how it's done to reference
// a global babel helper object instead of using
// a named import
// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-plugin-external-helpers/src/index.js

export const transformBabelHelperToImportBabelPlugin = (api) => {
  // https://github.com/babel/babel/tree/master/packages/babel-helper-module-imports
  const { addDefault } = require("@babel/helper-module-imports")

  api.assertVersion(7)

  return {
    pre: (file) => {
      const cachedHelpers = {}
      file.set("helperGenerator", (name) => {
        // the list of possible helpers name
        // https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-helpers/src/helpers.js#L13

        if (name === "interopRequireDefault") {
          // interopRequireDefault is used by "addDefault" which will call
          // helperGenerator creating an infinite call stack
          // for this specific helper we use the original babel helper code
          const t = api.types
          return t.memberExpression(
            t.identifier("babelHelpers"),
            t.identifier(name),
          )
        }

        if (!file.availableHelper(name)) {
          return undefined
        }

        if (cachedHelpers[name]) {
          return cachedHelpers[name]
        }

        const filePath = file.opts.filename
        const babelHelperImportSpecifier =
          babelHelperNameToImportSpecifier(name)

        if (filePathToBabelHelperName(filePath) === name) {
          return undefined
        }

        const helper = addDefault(file.path, babelHelperImportSpecifier, {
          nameHint: `_${name}`,
        })
        cachedHelpers[name] = helper
        return helper
      })
    },
  }
}
