// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-core/src/tools/build-external-helpers.js
// the list of possible helpers:
// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-helpers/src/helpers.js#L13
import { pathToFileUrl } from "../../urlUtils.js"

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

const babelHelperDirectoryRelativePath = "@jsenv/core/helpers/babel/"
const abstractBabelHelperDirectoryRelativePath = `.jsenv/helpers/babel/`

export const listAbstractBabelHelpers = () => {
  return list.filter((babelHelperName) => !babelHelperIsInsideJsenvCore(babelHelperName))
}

export const babelHelperNameToImportSpecifier = (babelHelperName) => {
  if (babelHelperNameInsideJsenvCoreArray.includes(babelHelperName)) {
    return `${babelHelperDirectoryRelativePath}${babelHelperName}/${babelHelperName}.js`
  }
  return `${abstractBabelHelperDirectoryRelativePath}${babelHelperName}/${babelHelperName}.js`
}

export const filePathToBabelHelperName = (filePath) => {
  const fileUrl = pathToFileUrl(filePath)

  if (fileUrl.includes(babelHelperDirectoryRelativePath)) {
    const afterBabelHelperDirectory = fileUrl.slice(
      fileUrl.indexOf(babelHelperDirectoryRelativePath) + babelHelperDirectoryRelativePath.length,
    )
    return afterBabelHelperDirectory.slice(afterBabelHelperDirectory.indexOf("/") + 1)
  }

  if (fileUrl.includes(abstractBabelHelperDirectoryRelativePath)) {
    const afterBabelHelperDirectory = fileUrl.slice(
      fileUrl.indexOf(abstractBabelHelperDirectoryRelativePath) +
        abstractBabelHelperDirectoryRelativePath.length,
    )
    return afterBabelHelperDirectory.slice(
      abstractBabelHelperDirectoryRelativePath.indexOf("/") + 1,
    )
  }

  return null
}

export const babelHelperIsInsideJsenvCore = (babelHelperName) => {
  return babelHelperNameInsideJsenvCoreArray.includes(babelHelperName)
}
