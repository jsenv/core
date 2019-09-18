// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-core/src/tools/build-external-helpers.js
// the list of possible helpers:
// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-helpers/src/helpers.js#L13
import { jsenvCorePathname } from "../jsenvCorePath/jsenvCorePath.js"

const { list } = import.meta.require("@babel/helpers")

const babelHelperNameInsideJsenvCoreArray = [
  "arrayWithHoles",
  "arrayWithoutHoles",
  "assertThisInitialized",
  "classCallCheck",
  "createClass",
  "defineProperty",
  "getPrototypeOf",
  "inherits",
  "iterableToArray",
  "iterableToArrayLimit",
  "nonIterableRest",
  "nonIterableSpread",
  "objectDestructuringEmpty",
  "objectSpread",
  "objectSpread2",
  "objectWithoutProperties",
  "objectWithoutPropertiesLoose",
  "possibleConstructorReturn",
  "setPrototypeOf",
  "slicedToArray",
  "toArray",
  "toConsumableArray",
  "typeof",
]

const babelHelperMap = {}
list.forEach((babelHelperName) => {
  if (babelHelperNameInsideJsenvCoreArray.includes(babelHelperName)) {
    babelHelperMap[
      babelHelperName
    ] = `@jsenv/core/helpers/babel/${babelHelperName}/${babelHelperName}.js`
  } else {
    babelHelperMap[
      babelHelperName
    ] = `file://${jsenvCorePathname}/.babel-helpers/${babelHelperName}.js`
  }
})
export { babelHelperMap }
