// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-core/src/tools/build-external-helpers.js
// the list of possible helpers:
// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-helpers/src/helpers.js#L13
const babelHelperClientDirectoryUrl = new URL("../node_modules/@jsenv/babel-plugins/src/babel_helpers/", import.meta.url).href; // we cannot use "@jsenv/core/src/*" because babel helper might be injected
// into node_modules not depending on "@jsenv/core"

export const getBabelHelperFileUrl = babelHelperName => {
  const babelHelperFileUrl = new URL(`./${babelHelperName}/${babelHelperName}.js`, babelHelperClientDirectoryUrl).href;
  return babelHelperFileUrl;
};
export const babelHelperNameFromUrl = url => {
  if (!url.startsWith(babelHelperClientDirectoryUrl)) {
    return null;
  }

  const afterBabelHelperDirectory = url.slice(babelHelperClientDirectoryUrl.length);
  const babelHelperName = afterBabelHelperDirectory.slice(0, afterBabelHelperDirectory.indexOf("/"));
  return babelHelperName;
};