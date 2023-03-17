/*
 * Generated helpers
 * - https://github.com/babel/babel/commits/main/packages/babel-helpers/src/helpers.ts
 * File helpers
 * - https://github.com/babel/babel/tree/main/packages/babel-helpers/src/helpers
 *
 */
export const babelHelperClientDirectoryUrl = new URL(
  "./babel_helpers/",
  import.meta.url,
).href

// we cannot use "@jsenv/core/src/*" because babel helper might be injected
// into node_modules not depending on "@jsenv/core"
export const getBabelHelperFileUrl = (babelHelperName) => {
  const babelHelperFileUrl = new URL(
    `./${babelHelperName}/${babelHelperName}.js`,
    babelHelperClientDirectoryUrl,
  ).href
  return babelHelperFileUrl
}

export const babelHelperNameFromUrl = (url) => {
  if (!url.startsWith(babelHelperClientDirectoryUrl)) {
    return null
  }
  const afterBabelHelperDirectory = url.slice(
    babelHelperClientDirectoryUrl.length,
  )
  const babelHelperName = afterBabelHelperDirectory.slice(
    0,
    afterBabelHelperDirectory.indexOf("/"),
  )
  return babelHelperName
}
