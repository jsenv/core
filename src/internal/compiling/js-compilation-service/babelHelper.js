// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-core/src/tools/build-external-helpers.js
// the list of possible helpers:
// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-helpers/src/helpers.js#L13
import { fileSystemPathToUrl } from "@jsenv/util"
import { require } from "../../require.js"

const { list } = require("@babel/helpers")

const babelHelperNameInsideJsenvCoreArray = [
  "applyDecoratedDescriptor",
  "arrayLikeToArray",
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
  "createForOfIterableHelper",
  "createForOfIterableHelperLoose",
  "createSuper",
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
  "isNativeReflectConstruct",
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
  "unsupportedIterableToArray",
  "wrapAsyncGenerator",
  "wrapNativeSuper",
  "wrapRegExp",
]

const babelHelperScope = "@jsenv/core/helpers/babel/"
// maybe we can put back / in front of .jsenv here because we will
// "redirect" or at least transform everything inside .jsenv
// not only everything inside .dist
const babelHelperAbstractScope = `.jsenv/helpers/babel/`

export const listAbstractBabelHelpers = () => {
  return list.filter((babelHelperName) => !babelHelperIsInsideJsenvCore(babelHelperName))
}

export const babelHelperNameToImportSpecifier = (babelHelperName) => {
  if (babelHelperNameInsideJsenvCoreArray.includes(babelHelperName)) {
    return `${babelHelperScope}${babelHelperName}/${babelHelperName}.js`
  }
  return `${babelHelperAbstractScope}${babelHelperName}/${babelHelperName}.js`
}

export const filePathToBabelHelperName = (filePath) => {
  const fileUrl = fileSystemPathToUrl(filePath)

  const babelHelperPrefix = "core/helpers/babel/"
  if (fileUrl.includes(babelHelperPrefix)) {
    const afterBabelHelper = fileUrl.slice(
      fileUrl.indexOf(babelHelperPrefix) + babelHelperPrefix.length,
    )
    return afterBabelHelper.slice(0, afterBabelHelper.indexOf("/"))
  }

  if (fileUrl.includes(babelHelperAbstractScope)) {
    const afterBabelHelper = fileUrl.slice(
      fileUrl.indexOf(babelHelperAbstractScope) + babelHelperAbstractScope.length,
    )
    return afterBabelHelper.slice(0, afterBabelHelper.indexOf("/"))
  }

  return null
}

export const babelHelperIsInsideJsenvCore = (babelHelperName) => {
  return babelHelperNameInsideJsenvCoreArray.includes(babelHelperName)
}
