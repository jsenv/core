// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-core/src/tools/build-external-helpers.js
// the list of possible helpers:
// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-helpers/src/helpers.js#L13

const babelHelperDirectory =
  "@jsenv/core/omega/plugins/babel/babel_helper/client/"

export const babelHelperNameToImportSpecifier = (babelHelperName) => {
  return `${babelHelperDirectory}${babelHelperName}/${babelHelperName}.js`
}

export const babelHelperNameFromUrl = (url) => {
  if (!url.startsWith("file:")) {
    return null
  }
  const babelHelperPrefix = "/plugins/babel/babel_helper/client/"
  if (!url.includes(babelHelperPrefix)) {
    return null
  }
  const afterBabelHelper = url.slice(
    url.indexOf(babelHelperPrefix) + babelHelperPrefix.length,
  )
  const babelHelperName = afterBabelHelper.slice(
    0,
    afterBabelHelper.indexOf("/"),
  )
  return babelHelperName
}
