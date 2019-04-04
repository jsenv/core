const { addNamed } = import.meta.require("@babel/helper-module-imports")

// for reference this is how it's done to reference
// a global babel helper object instead of using
// a named import
// https://github.com/babel/babel/blob/master/packages/babel-plugin-external-helpers/src/index.js

// named import approach found here:
// https://github.com/rollup/rollup-plugin-babel/blob/18e4232a450f320f44c651aa8c495f21c74d59ac/src/helperPlugin.js#L1
export const createReplaceBabelHelperByNamedImportBabelPlugin = ({ HELPER_FILENAME }) => {
  return {
    pre: (file) => {
      const cachedHelpers = {}
      file.set("helperGenerator", (name) => {
        if (!file.availableHelper(name)) {
          return undefined
        }

        if (cachedHelpers[name]) {
          return cachedHelpers[name]
        }

        // https://github.com/babel/babel/tree/master/packages/babel-helper-module-imports
        const helper = addNamed(file.path, name, HELPER_FILENAME)
        cachedHelpers[name] = helper
        return helper
      })
    },
  }
}
