// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-core/src/tools/build-external-helpers.js
// the list of possible helpers:
// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-helpers/src/helpers.js#L13
import { jsenvCorePathname } from "../jsenvCorePath/jsenvCorePath.js"

const { list } = import.meta.require("@babel/helpers")

const babelHelperMap = {}
list.forEach((name) => {
  babelHelperMap[name] = `${jsenvCorePathname}/.babel-helpers/${name}.js`
})
export { babelHelperMap }
