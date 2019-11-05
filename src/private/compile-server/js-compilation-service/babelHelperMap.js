// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-core/src/tools/build-external-helpers.js
// the list of possible helpers:
// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-helpers/src/helpers.js#L13
import { jsenvCoreDirectoryUrl } from "../../jsenvCoreDirectoryUrl.js"
import { resolveFileUrl, pathToFileUrl } from "../../urlUtils.js"

const { list } = import.meta.require("@babel/helpers")

const babelHelperNameInsideJsenvCoreArray = [
  "applyDecoratedDescriptor",
  "arrayWithHoles",
  "arrayWithoutHoles",
  "assertThisInitialized",
  "AsyncGenerator",
  "asyncGeneratorDelegate",
  "asyncIterator",
  "asyncToGenerator",
  "awaitAsyncGenerator",
  "AwaitValue",
  "classCallCheck",
  "classNameTDZError",
  "classPrivateFieldDestructureSet",
  "classPrivateFieldGet",
  "classPrivateFieldLooseBase",
  "classPrivateFieldLooseKey",
  "classPrivateFieldSet",
  "classPrivateMethodGet",
  "classPrivateMethodSet",
  "classStaticPrivateFieldSpecGet",
  "classStaticPrivateFieldSpecSet",
  "classStaticPrivateMethodGet",
  "classStaticPrivateMethodSet",
  "construct",
  "createClass",
  "decorate",
  "defaults",
  "defineEnumerableProperties",
  "defineProperty",
  "extends",
  "get",
  "getPrototypeOf",
  "inherits",
  "inheritsLoose",
  "initializerDefineProperty",
  "initializerWarningHelper",
  "instanceof",
  "interopRequireDefault",
  "interopRequireWildcard",
  "isNativeFunction",
  "iterableToArray",
  "iterableToArrayLimit",
  "iterableToArrayLimitLoose",
  "jsx",
  "newArrowCheck",
  "nonIterableRest",
  "nonIterableSpread",
  "objectDestructuringEmpty",
  "objectSpread",
  "objectSpread2",
  "objectWithoutProperties",
  "objectWithoutPropertiesLoose",
  "possibleConstructorReturn",
  "readOnlyError",
  "set",
  "setPrototypeOf",
  "skipFirstGeneratorNext",
  "slicedToArray",
  "slicedToArrayLoose",
  "superPropBase",
  "taggedTemplateLiteral",
  "taggedTemplateLiteralLoose",
  "tdz",
  "temporalRef",
  "temporalUndefined",
  "toArray",
  "toConsumableArray",
  "toPrimitive",
  "toPropertyKey",
  "typeof",
  "wrapAsyncGenerator",
  "wrapNativeSuper",
  "wrapRegExp",
]

const babelHelperMap = {}
list.forEach((babelHelperName) => {
  if (babelHelperNameInsideJsenvCoreArray.includes(babelHelperName)) {
    babelHelperMap[babelHelperName] = resolveFileUrl(
      `./helpers/babel/${babelHelperName}/${babelHelperName}.js`,
      jsenvCoreDirectoryUrl,
    )
    // `@jsenv/core/helpers/babel/${babelHelperName}/${babelHelperName}.js`
  } else {
    babelHelperMap[babelHelperName] = `${jsenvCoreDirectoryUrl}.babel-helpers/${babelHelperName}.js`
  }
})
export { babelHelperMap }

export const pathToBabelHelperName = (filePath) => {
  const fileUrl = pathToFileUrl(filePath)
  return Object.keys(babelHelperMap).find((babelHelperName) => {
    return fileUrl === babelHelperMap[babelHelperName]
  })
}

export const babelHelperIsInsideJsenvCore = (babelHelperName) => {
  return babelHelperNameInsideJsenvCoreArray.includes(babelHelperName)
}
