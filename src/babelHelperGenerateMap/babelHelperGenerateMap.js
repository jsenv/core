// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-core/src/tools/build-external-helpers.js
// the list of possible helpers:
// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-helpers/src/helpers.js#L13
const { buildExternalHelpers } = import.meta.require("@babel/core")
const { list } = import.meta.require("@babel/helpers")

const babelHelperGenerateMap = {}
list.forEach((name) => {
  babelHelperGenerateMap[`/.jsenv/babel-helpers/${name}.js`] = () =>
    buildExternalHelpers([name], "module")
})
export { babelHelperGenerateMap }
